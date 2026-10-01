import { normalizeIdentifier, type VerifiedCrossReference } from "@/lib/model-identifier";

/**
 * OEM cross-reference: competitor/predecessor model numbers -> compatible
 * Summit SKU ids. Wired into search so a buyer holding an old unit's model
 * plate lands on the right replacement.
 *
 * SHIPS EMPTY BY DESIGN. Populating this is a catalog-content job that must be
 * done from verified AHRI match-ups -- never guessed. A row without
 * `verifiedBy` and `evidenceUrl` is ignored, because this table is the only
 * thing allowed to make a compatibility or replacement claim.
 *
 * Keys are compared with the shared identifier normalizer (lib/model-
 * identifier.ts), the same one the decoder and quick order use, so case,
 * dashes and spacing never change the answer.
 */
export const CROSS_REFERENCES: VerifiedCrossReference[] = [
  // { sourceModel: "38MARBQ09AA3", skuIds: ["catalog-0001"], verifiedBy: "AHRI 123456", evidenceUrl: "https://..." },
];

/** Kept for existing callers. Delegates to the shared normalizer. */
export function normalizeModelQuery(value: string): string {
  return normalizeIdentifier(value).toLowerCase();
}

/** Exact verified matches only. A prefix is not evidence of compatibility. */
export function crossReferenceLookup(query: string): string[] {
  const q = normalizeIdentifier(query);
  if (q.length < 4) return [];
  const hit = CROSS_REFERENCES.find(
    (row) => row.verifiedBy && row.evidenceUrl && normalizeIdentifier(row.sourceModel) === q
  );
  return hit?.skuIds ?? [];
}
