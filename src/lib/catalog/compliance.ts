import { brandPolicy } from "@/lib/brand-policy";
import { airConditionerBand, EFFICIENCY_POLICY, type EfficiencyPolicy } from "@/lib/efficiency-policy";
import { isR410a, r410aPromotable } from "@/lib/refrigerant-policy";
import { getStorefrontSkus, type CatalogCategory, type StorefrontSku } from "@/lib/storefront/catalog";

/**
 * California residential eligibility, derived from the catalog record and the
 * three policies (efficiency, brand, refrigerant). Nothing here is stored: the
 * status follows the research the moment a record gains a rating.
 *
 * THE RULE THIS MODULE EXISTS TO KEEP: a missing rating is never compliant.
 * 27 records publish efficiency only for a matched indoor/outdoor pairing, and
 * most records carry no rating at all. Counting any of those as compliant to
 * lengthen a homeowner shortlist is the same mistake the sellability gate
 * exists to prevent.
 */

export type CaResidentialStatus =
  /** Rating on file, AHRI-certified pairing, clears the regional minimum. */
  | "compliant"
  /** Ratings depend on the indoor/outdoor pairing and no certified pairing is on file. */
  | "requires_matched_combination"
  /** Rating on file and below the regional minimum. */
  | "noncompliant"
  /** Equipment, but no rating on file. */
  | "unknown"
  /** Not rated equipment under this standard (supplies, controls, furnaces, tools). */
  | "not_applicable";

/** Customer-facing wording for a product page. not_applicable renders nothing. */
export const CA_STATUS_PUBLIC_LABEL: Record<CaResidentialStatus, string | null> = {
  compliant: "Meets the California regional minimum when installed as its AHRI-certified pairing",
  requires_matched_combination: "Depends on the indoor and outdoor pairing. We confirm the AHRI match before quoting.",
  noncompliant: "Below the California regional minimum for new installations",
  unknown: "Efficiency rating not yet on file. We confirm it before quoting.",
  not_applicable: null,
};

export type EquipmentKind = "heat_pump" | "air_conditioner" | "unrated";

export type Ratings = { seer2: number | null; eer2: number | null; hspf2: number | null };

export type SystemLane = "ducted" | "ductless";

/** Categories this standard rates. Everything else is not_applicable. */
const RATED_CATEGORIES: ReadonlySet<CatalogCategory> = new Set<CatalogCategory>([
  "mini-splits",
  "central-heat-pumps",
  "central-air-conditioners",
  "central-systems",
  "air-handlers",
  "evaporator-coils",
  "cassettes",
]);

const DUCTED_CATEGORIES: ReadonlySet<CatalogCategory> = new Set<CatalogCategory>([
  "central-heat-pumps",
  "central-air-conditioners",
  "central-systems",
  "air-handlers",
  "evaporator-coils",
]);

type RatedInput = Pick<StorefrontSku, "category" | "specifications" | "ahri" | "btu">;

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function ratingsOf(sku: Pick<StorefrontSku, "specifications">): Ratings {
  const specs = sku.specifications ?? {};
  return { seer2: numberOrNull(specs.seer2), eer2: numberOrNull(specs.eer2), hspf2: numberOrNull(specs.hspf2) };
}

export function equipmentKind(sku: Pick<StorefrontSku, "category" | "specifications">): EquipmentKind {
  if (!RATED_CATEGORIES.has(sku.category)) return "unrated";
  if (sku.category === "central-air-conditioners") return "air_conditioner";
  if (sku.category === "central-heat-pumps" || ratingsOf(sku).hspf2 !== null) return "heat_pump";
  return "unrated";
}

/**
 * Whether a rating clears the regional minimum. Returns null when the rating
 * needed to decide is missing -- "can't tell" is a third answer, not a pass.
 */
export function meetsMinimum(
  kind: EquipmentKind,
  btu: number,
  ratings: Ratings,
  policy: EfficiencyPolicy = EFFICIENCY_POLICY
): boolean | null {
  if (kind === "heat_pump") {
    if (ratings.seer2 === null || ratings.hspf2 === null) return null;
    return ratings.seer2 >= policy.splitHeatPump.minSeer2 && ratings.hspf2 >= policy.splitHeatPump.minHspf2;
  }
  if (kind === "air_conditioner") {
    if (ratings.seer2 === null || ratings.eer2 === null || btu <= 0) return null;
    const band = airConditionerBand(btu, policy);
    return ratings.seer2 >= band.minSeer2 && ratings.eer2 >= band.minEer2;
  }
  return null;
}

/**
 * Status of one record. "compliant" on a single record always means
 * "compliant when installed as its AHRI-certified pairing" -- ratings belong
 * to the pairing, never to either unit installed with something else.
 */
export function caResidentialStatus(sku: RatedInput, policy: EfficiencyPolicy = EFFICIENCY_POLICY): CaResidentialStatus {
  if (!RATED_CATEGORIES.has(sku.category)) return "not_applicable";
  const ratings = ratingsOf(sku);
  const kind = equipmentKind(sku);
  const verdict = kind === "unrated" ? null : meetsMinimum(kind, sku.btu, ratings, policy);
  // A published rating that fails the minimum fails whatever it is paired with.
  if (verdict === false) return "noncompliant";
  const certified = sku.ahri?.status === "certified" && Boolean(sku.ahri.referenceNumber);
  if (certified) return verdict === true ? "compliant" : "unknown";
  if (sku.ahri?.status === "requires_matched_combination") return "requires_matched_combination";
  return "unknown";
}

/* ------------------------------------------------------------ matched systems */

export type MatchedSystem = {
  /** The AHRI reference number that ties the components together. */
  ahriReference: string;
  certifiedModel: string | null;
  brand: string;
  lane: SystemLane;
  kind: EquipmentKind;
  btu: number;
  refrigerant: string;
  ratings: Ratings;
  status: CaResidentialStatus;
  components: StorefrontSku[];
  /** Sum of component retail prices when every component is priced; else null. */
  retailTotal: number | null;
};

/**
 * Systems are built only from AHRI-certified pairings: records that share a
 * certificate number. Two records that merely look compatible are not a
 * system -- that is a staff call against the AHRI directory.
 */
export function matchedSystems(skus: StorefrontSku[] = getStorefrontSkus(), policy: EfficiencyPolicy = EFFICIENCY_POLICY): MatchedSystem[] {
  const byReference = new Map<string, StorefrontSku[]>();
  for (const sku of skus) {
    const reference = sku.ahri?.status === "certified" ? sku.ahri.referenceNumber : null;
    if (!reference) continue;
    byReference.set(reference, [...(byReference.get(reference) ?? []), sku]);
  }
  const systems: MatchedSystem[] = [];
  for (const [reference, components] of byReference) {
    if (components.length < 2) continue;
    const sorted = [...components].sort((a, b) => componentOrder(a) - componentOrder(b) || a.sku.localeCompare(b.sku));
    const rated = sorted.find((sku) => ratingsOf(sku).seer2 !== null) ?? sorted[0];
    const statuses = sorted.map((sku) => caResidentialStatus(sku, policy));
    // The certificate rates the pairing, so one rated component speaks for the
    // system -- unless any published rating fails the minimum.
    const status: CaResidentialStatus = statuses.includes("noncompliant")
      ? "noncompliant"
      : statuses.includes("compliant")
        ? "compliant"
        : "unknown";
    const prices = sorted.map((sku) => sku.retailPrice);
    systems.push({
      ahriReference: reference,
      certifiedModel: sorted[0].ahri?.certifiedModel ?? null,
      brand: sorted[0].brand,
      lane: sorted.some((sku) => DUCTED_CATEGORIES.has(sku.category)) ? "ducted" : "ductless",
      kind: sorted.map(equipmentKind).find((kind) => kind !== "unrated") ?? "unrated",
      btu: Math.max(...sorted.map((sku) => sku.btu)),
      refrigerant: sorted.find((sku) => sku.refrigerant)?.refrigerant ?? "",
      ratings: ratingsOf(rated),
      status,
      components: sorted,
      retailTotal: prices.every((price): price is number => typeof price === "number" && price > 0)
        ? prices.reduce((sum, price) => sum + price, 0)
        : null,
    });
  }
  return systems.sort((a, b) => a.btu - b.btu || a.ahriReference.localeCompare(b.ahriReference));
}

/** Outdoor unit first, then the indoor side -- the order an installer reads a pairing. */
function componentOrder(sku: StorefrontSku): number {
  if (/outdoor/i.test(sku.productType)) return 0;
  if (/air handler|indoor|cassette|coil/i.test(sku.productType)) return 1;
  return 2;
}

/* ------------------------------------------------------- homeowner eligibility */

export type IneligibleReason =
  | "rating_not_on_file"
  | "matched_combination_unverified"
  | "below_regional_minimum"
  | "r410a_install_unconfirmed"
  | "brand_not_sold_to_homeowners"
  | "brand_does_not_warrant_online_sales"
  | "not_rated_equipment";

export const INELIGIBLE_REASON_LABEL: Record<IneligibleReason, string> = {
  rating_not_on_file: "No efficiency rating on file",
  matched_combination_unverified: "Rating depends on an indoor/outdoor pairing that is not verified",
  below_regional_minimum: "Below the California regional efficiency minimum",
  r410a_install_unconfirmed: "R-410A: California install eligibility not yet confirmed in writing",
  brand_not_sold_to_homeowners: "Brand policy does not allow homeowner sales",
  brand_does_not_warrant_online_sales: "Manufacturer does not warrant online purchases",
  not_rated_equipment: "Not rated heating or cooling equipment",
};

export type Eligibility = { eligible: boolean; reasons: IneligibleReason[] };

function statusReason(status: CaResidentialStatus): IneligibleReason | null {
  switch (status) {
    case "compliant":
      return null;
    case "requires_matched_combination":
      return "matched_combination_unverified";
    case "noncompliant":
      return "below_regional_minimum";
    case "not_applicable":
      return "not_rated_equipment";
    default:
      return "rating_not_on_file";
  }
}

function policyReasons(brand: string, refrigerant: string): IneligibleReason[] {
  const reasons: IneligibleReason[] = [];
  if (isR410a(refrigerant) && !r410aPromotable()) reasons.push("r410a_install_unconfirmed");
  const policy = brandPolicy(brand);
  if (!policy.homeownerSaleAllowed) reasons.push("brand_not_sold_to_homeowners");
  if (policy.internetSaleWarranty === "not_covered") reasons.push("brand_does_not_warrant_online_sales");
  return reasons;
}

/**
 * Whether a matched system may be recommended to a California homeowner.
 * Every reason is reported, not just the first, so the staff report can show
 * what would have to change.
 */
export function systemHomeownerEligibility(system: MatchedSystem): Eligibility {
  const reasons: IneligibleReason[] = [];
  const fromStatus = statusReason(system.status);
  if (fromStatus) reasons.push(fromStatus);
  reasons.push(...policyReasons(system.brand, system.refrigerant));
  return { eligible: reasons.length === 0, reasons };
}

/** The same test for a single record (catalog report; finder recommends systems only). */
export function skuHomeownerEligibility(sku: StorefrontSku): Eligibility {
  const reasons: IneligibleReason[] = [];
  const fromStatus = statusReason(caResidentialStatus(sku));
  if (fromStatus) reasons.push(fromStatus);
  reasons.push(...policyReasons(sku.brand, sku.refrigerant));
  return { eligible: reasons.length === 0, reasons };
}

export function homeownerEligibleSystems(skus: StorefrontSku[] = getStorefrontSkus()): MatchedSystem[] {
  return matchedSystems(skus).filter((system) => systemHomeownerEligibility(system).eligible);
}

/* ------------------------------------------------------------------- reporting */

export type ComplianceSummary = {
  equipmentRecords: number;
  byStatus: Record<CaResidentialStatus, number>;
  r410aRecords: number;
  matchedSystems: number;
  homeownerEligibleSystems: number;
  blockedBy: Partial<Record<IneligibleReason, number>>;
};

/** Counts for /api/health/catalog and the staff catalog screen. */
export function complianceSummary(skus: StorefrontSku[] = getStorefrontSkus()): ComplianceSummary {
  const byStatus: Record<CaResidentialStatus, number> = {
    compliant: 0,
    requires_matched_combination: 0,
    noncompliant: 0,
    unknown: 0,
    not_applicable: 0,
  };
  for (const sku of skus) byStatus[caResidentialStatus(sku)] += 1;
  const systems = matchedSystems(skus);
  const blockedBy: Partial<Record<IneligibleReason, number>> = {};
  let eligible = 0;
  for (const system of systems) {
    const result = systemHomeownerEligibility(system);
    if (result.eligible) eligible += 1;
    for (const reason of result.reasons) blockedBy[reason] = (blockedBy[reason] ?? 0) + 1;
  }
  return {
    equipmentRecords: skus.length - byStatus.not_applicable,
    byStatus,
    r410aRecords: skus.filter((sku) => isR410a(sku.refrigerant)).length,
    matchedSystems: systems.length,
    homeownerEligibleSystems: eligible,
    blockedBy,
  };
}
