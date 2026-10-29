/**
 * What each brand allows when equipment is sold to a homeowner, and what its
 * warranty does when the unit was bought online. One record per brand, read by
 * the homeowner finder, the chat assistant and lifecycle email, so no surface
 * states a warranty rule this file does not support.
 *
 * Two different questions, kept apart on purpose:
 *
 *  - homeownerSaleAllowed: may Summit sell this brand to a homeowner at all?
 *    That is a dealer-agreement question. The owner holds the agreements and
 *    confirmed on 2026-10-01 that Summit may sell TCL, Tosot and Carrier to
 *    homeowners.
 *
 *  - internetSaleWarranty: does the manufacturer still honor its warranty when
 *    the homeowner bought the unit online? Some brands refuse (Mitsubishi
 *    treats it as resale), some require a licensed dealer install (Daikin).
 *    Nobody has read these three brands' terms on this point yet, so they stay
 *    "unknown". Unknown never becomes a claim in either direction: surfaces
 *    show the neutral disclosure below instead.
 */

export type InternetSaleWarranty = "covered" | "requires_licensed_install" | "not_covered" | "unknown";

export type BrandPolicy = {
  brand: string;
  /** Equipment brands carry install-sensitive warranties; accessory brands do not. */
  kind: "equipment" | "accessory";
  homeownerSaleAllowed: boolean;
  homeownerSaleSource: string;
  internetSaleWarranty: InternetSaleWarranty;
  internetSaleWarrantySource: string | null;
  reviewedAt: string | null;
};

const OWNER_CONFIRMED = "Owner, who holds the dealer agreements (stated 2026-10-01)";

export const BRAND_POLICIES: readonly BrandPolicy[] = [
  {
    brand: "TCL",
    kind: "equipment",
    homeownerSaleAllowed: true,
    homeownerSaleSource: OWNER_CONFIRMED,
    // TODO(summit-ops): read TCL's residential warranty for an online-purchase clause.
    internetSaleWarranty: "unknown",
    internetSaleWarrantySource: null,
    reviewedAt: null,
  },
  {
    brand: "Tosot",
    kind: "equipment",
    homeownerSaleAllowed: true,
    homeownerSaleSource: OWNER_CONFIRMED,
    // TODO(summit-ops): read Tosot (Gree) warranty terms for an online-purchase clause.
    internetSaleWarranty: "unknown",
    internetSaleWarrantySource: null,
    reviewedAt: null,
  },
  {
    brand: "Carrier",
    kind: "equipment",
    homeownerSaleAllowed: true,
    homeownerSaleSource: OWNER_CONFIRMED,
    // TODO(summit-ops): read Carrier's residential limited warranty for an online-purchase clause.
    internetSaleWarranty: "unknown",
    internetSaleWarrantySource: null,
    reviewedAt: null,
  },
  {
    brand: "Unbranded",
    kind: "accessory",
    homeownerSaleAllowed: true,
    homeownerSaleSource: "Summit-labelled installation supplies",
    internetSaleWarranty: "unknown",
    internetSaleWarrantySource: null,
    reviewedAt: null,
  },
  {
    brand: "DEWALT",
    kind: "accessory",
    homeownerSaleAllowed: true,
    homeownerSaleSource: "Hand tool; no install-sensitive warranty",
    internetSaleWarranty: "unknown",
    internetSaleWarrantySource: null,
    reviewedAt: null,
  },
];

/** Unlisted brands get the most restrictive answer, never a permissive default. */
const UNLISTED: Omit<BrandPolicy, "brand"> = {
  kind: "equipment",
  homeownerSaleAllowed: false,
  homeownerSaleSource: "No policy on file",
  internetSaleWarranty: "unknown",
  internetSaleWarrantySource: null,
  reviewedAt: null,
};

export function brandPolicy(brand: string): BrandPolicy {
  const key = brand.trim().toLowerCase();
  return BRAND_POLICIES.find((policy) => policy.brand.toLowerCase() === key) ?? { brand, ...UNLISTED };
}

/**
 * The sentence any homeowner-facing surface may say about warranty and permits.
 * It is the memo's recommended disclosure: true for every brand, whatever its
 * terms turn out to be, and it promises nothing.
 */
export const WARRANTY_DISCLOSURE = "Check local permit requirements. Warranty terms vary by brand and installer.";

/** What the warranty does for an online purchase, in words, or null when unknown. */
export function internetSaleWarrantyLine(brand: string): string | null {
  const policy = brandPolicy(brand);
  switch (policy.internetSaleWarranty) {
    case "covered":
      return `${policy.brand} honors its warranty on equipment bought online.`;
    case "requires_licensed_install":
      return `${policy.brand} honors its warranty on equipment bought online when a licensed contractor installs it.`;
    case "not_covered":
      return `${policy.brand} does not warrant equipment bought online.`;
    default:
      return null;
  }
}
