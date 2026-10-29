/**
 * Catalog-backed identifier resolution, shared by the batch quick-order
 * resolver, the model-number decoder and the AHRI lookup. Uses the one
 * normalizer in lib/model-identifier.ts.
 */

import { resolveIdentifier, type Candidate, type IdentifierOutcome, type IdentifierRecord } from "@/lib/model-identifier";
import { intentFor, presentCommerceState, publicCommerceState, type LineIntent } from "@/lib/commerce/state";
import { CROSS_REFERENCES } from "./cross-reference";
import { productHref, type StorefrontSku } from "./catalog";

export function identifierRecords(skus: StorefrontSku[], { includeAhri = false } = {}): IdentifierRecord[] {
  return skus.map((sku) => ({
    id: sku.id,
    codes: [
      { value: sku.sku, field: "sku" as const },
      { value: sku.modelNumber, field: "model" as const },
      { value: sku.sourceSku, field: "sourceSku" as const },
      ...(includeAhri && sku.ahriReference ? [{ value: sku.ahriReference, field: "ahri" as const }] : []),
    ],
  }));
}

export type ResolvedProduct = {
  id: string;
  sku: string;
  modelNumber: string;
  title: string;
  image: string;
  href: string;
  unitPrice: number;
  available: number;
  intent: LineIntent;
  priceText: string | null;
  statusLabel: string;
  match?: Pick<Candidate, "matchType" | "field" | "code" | "reason">;
};

export function toResolvedProduct(sku: StorefrontSku, candidate?: Candidate): ResolvedProduct {
  const state = publicCommerceState(sku);
  const view = presentCommerceState(state);
  const price =
    state.kind === "purchasable" || state.kind === "availabilityRequired"
      ? state.price.amount
      : state.kind === "quoteRequired"
        ? state.indicative?.amount ?? null
        : null;
  return {
    id: sku.id,
    sku: sku.sku,
    modelNumber: sku.modelNumber,
    title: sku.title,
    image: sku.imageVerified ? sku.image : "/logo-summit.svg",
    href: productHref(sku),
    unitPrice: price ?? 0,
    available: sku.available,
    intent: intentFor(state),
    priceText: view.priceText,
    statusLabel: view.statusLabel,
    match: candidate ? { matchType: candidate.matchType, field: candidate.field, code: candidate.code, reason: candidate.reason } : undefined,
  };
}

export type ResolvedRow =
  | { line: number; status: "found"; product: ResolvedProduct }
  | { line: number; status: "ambiguous"; candidates: ResolvedProduct[] }
  | { line: number; status: "unknown"; suggestions: ResolvedProduct[] }
  | { line: number; status: "invalid" };

/**
 * Exact canonical matching only. A row resolves to a product only when exactly
 * one SKU or model matches as written (ignoring case and punctuation). Partial
 * matches are returned as choices for the user -- the first fuzzy result is
 * never selected for them.
 */
export function resolveRows(rows: Array<{ line: number; sku: string }>, pool: StorefrontSku[]): ResolvedRow[] {
  const records = identifierRecords(pool);
  const byId = new Map(pool.map((sku) => [sku.id, sku]));
  const product = (candidate: Candidate) => toResolvedProduct(byId.get(candidate.id)!, candidate);
  return rows.map(({ line, sku }) => {
    const outcome: IdentifierOutcome = resolveIdentifier(sku, records, CROSS_REFERENCES);
    switch (outcome.kind) {
      case "exact":
        return { line, status: "found", product: product(outcome.match) };
      case "ambiguous":
        return { line, status: "ambiguous", candidates: outcome.candidates.map(product) };
      case "no_coverage":
        return { line, status: "unknown", suggestions: outcome.suggestions.map(product) };
      case "cross_reference":
        // A verified cross-reference names its replacement SKUs; with exactly
        // one it is a match, with several the user chooses.
        return outcome.reference.skuIds.length === 1 && byId.has(outcome.reference.skuIds[0])
          ? { line, status: "found", product: toResolvedProduct(byId.get(outcome.reference.skuIds[0])!) }
          : {
              line,
              status: "ambiguous",
              candidates: outcome.reference.skuIds.flatMap((id) => (byId.has(id) ? [toResolvedProduct(byId.get(id)!)] : [])),
            };
      default:
        return { line, status: "invalid" };
    }
  });
}
