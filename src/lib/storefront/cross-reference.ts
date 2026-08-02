/**
 * OEM cross-reference: competitor/predecessor model numbers → compatible
 * Summit SKU ids. Wired into search so a buyer holding an old unit's model
 * plate lands on the right replacement.
 *
 * ⚠️ SHIPS EMPTY BY DESIGN. Populating this is a catalog-content job that
 * must be done from verified AHRI match-ups — never guessed. Add entries as
 * `"competitor model": ["sku-id", ...]` (keys are normalized on lookup, so
 * dashes/case/spacing don't matter).
 */
export const CROSS_REFERENCES: Record<string, string[]> = {
  // e.g. "38MARBQ09AA3": ["sku-brz-09"],   // Carrier 9k single-zone
};

export function normalizeModelQuery(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const normalizedTable: Array<{ key: string; skuIds: string[] }> = Object.entries(
  CROSS_REFERENCES
).map(([key, skuIds]) => ({ key: normalizeModelQuery(key), skuIds }));

export function crossReferenceLookup(query: string): string[] {
  const q = normalizeModelQuery(query);
  if (q.length < 4) return [];
  const hit = normalizedTable.find((row) => row.key === q || row.key.startsWith(q));
  return hit?.skuIds ?? [];
}
