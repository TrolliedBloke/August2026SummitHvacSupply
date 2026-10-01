/**
 * The session-scoped commerce projection: CommerceState for a set of SKUs as
 * the signed-in account sees them. Server only -- it reads the session and,
 * for an approved trade account, protected pricing. Its responses are private
 * and uncacheable; public pages never embed its output.
 */

import { getStorefrontSku } from "@/lib/storefront/catalog";
import { applyLiveInventory, getLiveInventory } from "@/lib/storefront/live-inventory";
import { loadTradePricingResult } from "@/lib/backend/portal";
import { resolvePortalAccess, toAccountContext, toNavAccount } from "@/lib/backend/session-access";
import { intentFor, presentCommerceState, resolveCommerceState, type CommerceKind, type LineIntent } from "./state";
import type { AccountContext } from "./price-presentation";

export const PROJECTION_TTL_MS = 10 * 60_000;

export type ProjectedLine = {
  skuId: string;
  found: boolean;
  kind: CommerceKind | "unknown";
  intent: LineIntent;
  unitPrice: number;
  available: number;
  priceText: string | null;
  priceFallback: string;
  priceQualifier: string | null;
  statusLabel: string;
  statusDetail: string;
  actionLabel: string;
};

export async function projectCommerceLines(skuIds: string[], now = new Date()) {
  const access = await resolvePortalAccess();
  const account: AccountContext = toAccountContext(access);
  const live = await getLiveInventory();
  const unique = Array.from(new Set(skuIds)).slice(0, 100);
  const skus = unique.map((id) => getStorefrontSku(id)).map((sku) => (sku ? applyLiveInventory(sku, live) : null));
  const pricing =
    account.kind === "tradeApproved"
      ? await loadTradePricingResult(skus.flatMap((sku) => (sku ? [sku.id] : [])))
      : null;
  const asOf = now.toISOString();
  const expiresAt = new Date(now.getTime() + PROJECTION_TTL_MS).toISOString();

  const lines: ProjectedLine[] = unique.map((skuId, index) => {
    const sku = skus[index];
    if (!sku) {
      return {
        skuId, found: false, kind: "unknown", intent: "quote", unitPrice: 0, available: 0,
        priceText: null, priceFallback: "No longer listed", priceQualifier: null,
        statusLabel: "No longer in the catalog", statusDetail: "Remove it, or ask the counter for a replacement.",
        actionLabel: "Ask about this item",
      };
    }
    const state = resolveCommerceState(sku, {
      account,
      pricing: pricing
        ? pricing.status === "ok"
          ? { status: "ok", accountAmount: pricing.prices.get(sku.id), asOf, expiresAt }
          : { status: "error" }
        : undefined,
    });
    const view = presentCommerceState(state);
    const unitPrice =
      state.kind === "purchasable" || state.kind === "availabilityRequired"
        ? state.price.amount ?? 0
        : state.kind === "quoteRequired"
          ? state.indicative?.amount ?? 0
          : 0;
    return {
      skuId,
      found: true,
      kind: state.kind,
      intent: intentFor(state),
      unitPrice,
      available: sku.available,
      priceText: view.priceText,
      priceFallback: view.priceFallback,
      priceQualifier: view.priceQualifier,
      statusLabel: view.statusLabel,
      statusDetail: view.statusDetail,
      actionLabel: view.action.label,
    };
  });

  return { nav: toNavAccount(access), account: account.kind, asOf, expiresAt, lines };
}
