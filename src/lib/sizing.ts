/**
 * The one sizing rule of thumb. The finder, the sizing estimator tool, the
 * emailed sizing match and the chat assistant all read this table, so no two
 * surfaces can disagree about what size a room needs.
 *
 * This replaced two rules that did: a band table in the (unrendered) system
 * sizer, and 25 BTU per square foot in the estimator, which put 1,000 sq ft at
 * 24,000 BTU in one place and 30,000 in the other.
 *
 * It is a starting lane for a mild Bay Area climate, not a load calculation.
 * Every surface that shows a result must also say that the installer confirms
 * the final size with a Manual J.
 */

export type CapacityBand = {
  /** Upper bound of conditioned floor area, square feet. */
  maxSqFt: number;
  btu: number;
};

export const CAPACITY_BANDS: readonly CapacityBand[] = [
  { maxSqFt: 400, btu: 9_000 },
  { maxSqFt: 550, btu: 12_000 },
  { maxSqFt: 750, btu: 18_000 },
  { maxSqFt: 1_000, btu: 24_000 },
  { maxSqFt: 1_250, btu: 30_000 },
  { maxSqFt: 1_500, btu: 36_000 },
  { maxSqFt: 1_750, btu: 42_000 },
  { maxSqFt: 2_000, btu: 48_000 },
  { maxSqFt: 2_500, btu: 60_000 },
];

/** Above the last band one system stops being a reasonable assumption. */
export const MAX_SINGLE_SYSTEM_SQFT = CAPACITY_BANDS[CAPACITY_BANDS.length - 1].maxSqFt;

export const MANUAL_J_CAVEAT =
  "Rule-of-thumb estimate. Your installer confirms the final size with a Manual J load calculation before anything is ordered.";

/**
 * Nominal capacity for an area, or null when the area is missing, implausible,
 * or too large for a single-system rule of thumb.
 */
export function estimateCapacityBtu(squareFeet: number): number | null {
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) return null;
  return CAPACITY_BANDS.find((band) => squareFeet <= band.maxSqFt)?.btu ?? null;
}

export function tonsFromBtu(btu: number): number {
  return Math.round((btu / 12_000) * 2) / 2;
}

export function capacityLabel(btu: number): string {
  const tons = tonsFromBtu(btu);
  return tons >= 1.5 ? `${btu.toLocaleString("en-US")} BTU (about ${tons} tons)` : `${btu.toLocaleString("en-US")} BTU`;
}

/** The band table as one line, for the chat prompt and printed copy. */
export function bandSummary(): string {
  return CAPACITY_BANDS.map((band) => `${band.btu.toLocaleString("en-US")} BTU ≈ up to ${band.maxSqFt.toLocaleString("en-US")} sq ft`).join(" · ");
}
