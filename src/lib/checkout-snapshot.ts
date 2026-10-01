/**
 * Builds the checkout snapshot from already-resolved inputs. Pure, so the
 * whole pricing/stock/fulfillment matrix is testable without a database; the
 * server wrapper (lib/backend/checkout-snapshot.ts) resolves the session,
 * live stock, trade pricing and DB fees, then hashes and signs the result.
 */
import { estimateTax, round2 } from "@/lib/backend/pricing";
import { fulfillmentOptions, fulfillmentWindows, resolveZone, localDeliveryFee, WAREHOUSE, type FulfillmentMethod } from "@/lib/backend/fulfillment";
import { presentCommerceState, resolveCommerceState, type PricingLookup } from "@/lib/commerce/state";
import { isTradeContext, type AccountContext } from "@/lib/commerce/price-presentation";
import type { StorefrontSku } from "@/lib/storefront/catalog";
import type { CheckoutSnapshot, SnapshotLine, SnapshotMethod } from "./checkout-snapshot-types";

export const SNAPSHOT_TTL_MS = 15 * 60_000;

export type SnapshotInputs = {
  items: Array<{ skuId: string; qty: number }>;
  method: FulfillmentMethod;
  zip: string | null;
  resolveSku: (skuId: string) => StorefrontSku | undefined;
  account: AccountContext;
  /** Per-SKU account pricing for an approved trade account, or an outage. */
  pricing: { status: "ok"; prices: Map<string, number> } | { status: "error" } | null;
  /** Authoritative delivery fee when the DB has one; null falls back to the policy zone. */
  deliveryFee: (subtotal: number) => number | null;
  now?: Date;
};

export function buildSnapshot(inputs: SnapshotInputs): Omit<CheckoutSnapshot, "digest" | "token"> & { digestSource: string } {
  const now = inputs.now ?? new Date();
  const asOf = now.toISOString();
  const expiresAt = new Date(now.getTime() + SNAPSHOT_TTL_MS).toISOString();

  const lines: SnapshotLine[] = inputs.items.map(({ skuId, qty }) => {
    const sku = inputs.resolveSku(skuId);
    if (!sku) {
      return { skuId, sku: skuId, title: "Item no longer listed", qty, state: "unknown", unitPrice: null, lineTotal: null, provenance: "", error: { code: "unknown_sku", message: "No longer in the catalog. Remove it to continue." } };
    }
    const pricing: PricingLookup | undefined = inputs.pricing
      ? inputs.pricing.status === "ok"
        ? { status: "ok", accountAmount: inputs.pricing.prices.get(sku.id), asOf, expiresAt }
        : { status: "error" }
      : undefined;
    const state = resolveCommerceState(sku, { account: inputs.account, pricing });
    const view = presentCommerceState(state);
    if (state.kind === "pricingUnavailable") {
      return { skuId, sku: sku.sku, title: sku.title, qty, state: state.kind, unitPrice: null, lineTotal: null, provenance: "", error: { code: "price_unavailable", message: "Your account price could not be confirmed. Retry, or request a quote." } };
    }
    if (state.kind !== "purchasable") {
      return { skuId, sku: sku.sku, title: sku.title, qty, state: state.kind, unitPrice: null, lineTotal: null, provenance: "", error: { code: "not_purchasable", message: `${view.statusLabel}. Move it to a quote request to continue.` } };
    }
    const unit = state.price.amount ?? 0;
    if (qty > state.stock.quantity) {
      return { skuId, sku: sku.sku, title: sku.title, qty, state: state.kind, unitPrice: unit, lineTotal: null, provenance: state.price.tierLabel, error: { code: "exceeds_stock", message: `Only ${state.stock.quantity} counted in Newark. Lower the quantity to continue.` } };
    }
    return { skuId, sku: sku.sku, title: sku.title, qty, state: state.kind, unitPrice: unit, lineTotal: round2(unit * qty), provenance: state.price.tierLabel, error: null };
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + (line.error ? 0 : line.lineTotal ?? 0), 0));
  const options = fulfillmentOptions(inputs.zip, subtotal, now);
  const zone = resolveZone(inputs.zip);
  const methods: SnapshotMethod[] = options.map((option) => {
    const fee = option.method === "local_delivery" && option.available ? inputs.deliveryFee(subtotal) ?? (zone ? localDeliveryFee(zone, subtotal) : 0) : option.method === "freight" ? null : 0;
    return {
      method: option.method,
      label: option.label,
      available: option.available,
      fee,
      detail: option.detail,
      windows: option.available ? fulfillmentWindows(option.method, inputs.zip, now) : [],
    };
  });
  const chosen = methods.find((entry) => entry.method === inputs.method);
  const methodAvailable = Boolean(chosen?.available);
  const tradeAccount = isTradeContext(inputs.account) ? inputs.account : null;
  const trade = Boolean(tradeAccount);
  const payment: CheckoutSnapshot["payment"] = inputs.method === "freight" ? "freight_quote" : trade ? "net_terms" : "card";
  const fee = methodAvailable && inputs.method === "local_delivery" ? chosen?.fee ?? 0 : 0;

  let tax: CheckoutSnapshot["tax"];
  if (payment === "net_terms") tax = { status: "invoice", amount: 0 };
  else if (payment === "freight_quote") tax = { status: "quoted", amount: 0 };
  else {
    const destination = inputs.method === "pickup" ? WAREHOUSE.zip : inputs.zip;
    const computed = estimateTax(subtotal, destination);
    tax = computed === null ? { status: "unavailable", amount: 0 } : { status: "estimated", amount: computed };
  }
  const total = round2(subtotal + fee + tax.amount);
  const accountLabel = tradeAccount?.tierLabel ?? null;

  const digestSource = JSON.stringify({
    lines: lines.map((line) => [line.skuId, line.qty, line.unitPrice, line.error?.code ?? null]),
    method: inputs.method,
    methodAvailable,
    zip: inputs.zip,
    fee,
    tax,
    total,
    payment,
    account: tradeAccount?.accountId ?? inputs.account.kind,
  });

  return {
    version: 1,
    issuedAt: asOf,
    expiresAt,
    account: { kind: inputs.account.kind, label: accountLabel },
    zip: inputs.zip,
    method: inputs.method,
    methodAvailable,
    methods,
    lines,
    subtotal,
    fee,
    tax,
    total,
    payment,
    digestSource,
  };
}
