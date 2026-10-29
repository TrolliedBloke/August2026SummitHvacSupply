/**
 * The checkout snapshot contract, shared by the server that issues it and the
 * client that renders it. The browser never computes a price, fee, tax or
 * total; it renders these and submits the snapshot's token.
 */
import type { CommerceKind } from "@/lib/commerce/state";
import type { FulfillmentMethod, FulfillmentWindow } from "@/lib/backend/fulfillment";

export type SnapshotLineError = { code: "unknown_sku" | "not_purchasable" | "exceeds_stock" | "price_unavailable" | "restricted"; message: string };

/** A box the buyer must tick; the version is submitted and stored with the order. */
export type SnapshotAcknowledgement = { id: "install" | "r410a"; version: string; text: string };

export type SnapshotLine = {
  skuId: string;
  sku: string;
  title: string;
  qty: number;
  state: CommerceKind | "unknown";
  unitPrice: number | null;
  lineTotal: number | null;
  /** "List price" or "Your account price · Preferred trade". */
  provenance: string;
  error: SnapshotLineError | null;
};

export type SnapshotMethod = {
  method: FulfillmentMethod;
  label: string;
  available: boolean;
  fee: number | null;
  detail: string;
  windows: FulfillmentWindow[];
};

export type CheckoutSnapshot = {
  version: 1;
  issuedAt: string;
  expiresAt: string;
  account: { kind: string; label: string | null };
  zip: string | null;
  method: FulfillmentMethod;
  /** False when the method the buyer chose is no longer offered -- never silently swapped. */
  methodAvailable: boolean;
  methods: SnapshotMethod[];
  lines: SnapshotLine[];
  subtotal: number;
  fee: number;
  tax: { status: "estimated" | "invoice" | "quoted" | "unavailable"; amount: number };
  total: number;
  payment: "card" | "net_terms" | "freight_quote";
  /** Acknowledgements this order needs (src/lib/compliance/order-checks.ts). */
  acknowledgements: SnapshotAcknowledgement[];
  /** Staff will review the order before it is released (notes are staff-only). */
  reviewRequired: boolean;
  /** Hash of everything that affects the charge. */
  digest: string;
  /** Signed, expiring; submitted with the order. */
  token: string;
};

export type SnapshotDiff = {
  kind: "price" | "availability" | "line_added" | "line_removed" | "fee" | "tax" | "total" | "method";
  skuId?: string;
  label: string;
  before: string;
  after: string;
};

const usd = (value: number | null) => (value === null ? "unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value));

/** What changed between the snapshot the buyer reviewed and the current one. */
export function diffSnapshots(before: CheckoutSnapshot, after: CheckoutSnapshot): SnapshotDiff[] {
  const diffs: SnapshotDiff[] = [];
  const old = new Map(before.lines.map((line) => [line.skuId, line]));
  const now = new Map(after.lines.map((line) => [line.skuId, line]));
  for (const [skuId, line] of now) {
    const prior = old.get(skuId);
    if (!prior) {
      diffs.push({ kind: "line_added", skuId, label: line.title, before: "not in order", after: `${line.qty} × ${usd(line.unitPrice)}` });
      continue;
    }
    if (prior.unitPrice !== line.unitPrice) diffs.push({ kind: "price", skuId, label: line.title, before: usd(prior.unitPrice), after: usd(line.unitPrice) });
    if ((prior.error === null) !== (line.error === null)) {
      diffs.push({ kind: "availability", skuId, label: line.title, before: prior.error ? prior.error.message : "available", after: line.error ? line.error.message : "available" });
    }
  }
  for (const [skuId, line] of old) if (!now.has(skuId)) diffs.push({ kind: "line_removed", skuId, label: line.title, before: `${line.qty} in order`, after: "removed" });
  if (before.methodAvailable !== after.methodAvailable) diffs.push({ kind: "method", label: "Fulfillment", before: before.methodAvailable ? "available" : "unavailable", after: after.methodAvailable ? "available" : "no longer available" });
  if (before.fee !== after.fee) diffs.push({ kind: "fee", label: "Delivery fee", before: usd(before.fee), after: usd(after.fee) });
  if (before.tax.amount !== after.tax.amount) diffs.push({ kind: "tax", label: "Sales tax", before: usd(before.tax.amount), after: usd(after.tax.amount) });
  if (before.total !== after.total) diffs.push({ kind: "total", label: "Total", before: usd(before.total), after: usd(after.total) });
  return diffs;
}
