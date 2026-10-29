/**
 * Federal regional efficiency minimums that apply to a California residential
 * install, as one versioned record -- the same shape as fulfillment-policy.ts.
 *
 * California is in the DOE Southwest region. A split air conditioner below the
 * minimum "cannot be installed on or after January 1, 2023", so the homeowner
 * finder may only recommend a system whose rating is on file AND clears these
 * numbers. A missing rating is never treated as passing (lib/catalog/compliance.ts).
 *
 * Values follow the DOE regional standard and the manufacturer tables that
 * restate it (Rheem, Trane). One aggregator lists 15.2 SEER2 for split heat
 * pumps; that conflicts with both the regulation and the manufacturer tables,
 * so it is not used.
 */

export type EfficiencyReview = { status: "sourced" | "confirmed"; reviewedAt: string | null };

export type AirConditionerBand = {
  /** Applies below this nominal cooling capacity (BTU/h); null = no upper bound. */
  belowBtu: number | null;
  minSeer2: number;
  minEer2: number;
};

export type EfficiencyPolicy = {
  id: string;
  version: string;
  region: "southwest";
  states: readonly string[];
  source: { title: string; url: string; retrievedAt: string };
  splitAirConditioner: AirConditionerBand[];
  splitHeatPump: { minSeer2: number; minHspf2: number };
  review: EfficiencyReview;
};

export const EFFICIENCY_POLICY: EfficiencyPolicy = {
  id: "doe-regional-southwest",
  version: "2023.01",
  region: "southwest",
  states: ["CA", "AZ", "NV", "NM"],
  source: {
    title: "10 CFR 430.32(c) -- central air conditioner and heat pump energy conservation standards",
    url: "https://www.ecfr.gov/current/title-10/chapter-II/subchapter-D/part-430/subpart-C/section-430.32",
    retrievedAt: "2026-10-01",
  },
  splitAirConditioner: [
    { belowBtu: 45_000, minSeer2: 14.3, minEer2: 11.7 },
    { belowBtu: null, minSeer2: 13.8, minEer2: 11.2 },
  ],
  splitHeatPump: { minSeer2: 14.3, minHspf2: 7.5 },
  // TODO(summit-ops): a person should read the CFR table against these values
  // once and set status "confirmed" with the date.
  review: { status: "sourced", reviewedAt: null },
};

/** The AC band for a nominal capacity. Bands are ordered; the last is open-ended. */
export function airConditionerBand(btu: number, policy: EfficiencyPolicy = EFFICIENCY_POLICY): AirConditionerBand {
  return (
    policy.splitAirConditioner.find((band) => band.belowBtu === null || btu < band.belowBtu) ??
    policy.splitAirConditioner[policy.splitAirConditioner.length - 1]
  );
}
