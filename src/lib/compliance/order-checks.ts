import { caResidentialStatus, type CaResidentialStatus } from "@/lib/catalog/compliance";
import { isR410a, R410A_POLICY } from "@/lib/refrigerant-policy";
import type { CatalogCategory, StorefrontSku } from "@/lib/storefront/catalog";

/**
 * What an order or quote must carry before Summit can sell the equipment in it
 * (docs/LIABILITY-REMEDIATION-PLAN.md, Phase 3). Pure: checkout, the quote
 * check and the tests all call this with the same inputs.
 *
 * Three answers per line:
 *  - restricted: this buyer can't order it online (a line error, so checkout
 *    stops and offers the quote/counter path);
 *  - acknowledgement: the buyer must tick a box whose exact text and version
 *    are stored on the order;
 *  - review: the order is placed but held, or annotated, for staff.
 *
 * The acknowledgement wording is PROVISIONAL until counsel answers C-6, and
 * the R-410A rule follows R410A_POLICY until C-2 is answered. Changing either
 * answer is a one-value change here.
 */

export type Acknowledgement = {
  id: "install" | "r410a";
  /** Stored with the order; bump it whenever the text changes. */
  version: string;
  text: string;
  status: "draft_pending_counsel" | "approved";
};

// TODO(counsel C-6): replace with the approved wording and set status "approved".
export const INSTALL_ACKNOWLEDGEMENT: Acknowledgement = {
  id: "install",
  version: "install-2026-10-05-draft",
  status: "draft_pending_counsel",
  text:
    "This equipment must be installed by a licensed HVAC contractor, with any permit the job requires. The manufacturer's warranty can be limited or void if it isn't. I have read the warranty terms for these products.",
};

// TODO(counsel C-2): retire once R410A_POLICY.status is settled.
export const R410A_ATTESTATION: Acknowledgement = {
  id: "r410a",
  version: "r410a-2026-10-05-draft",
  status: "draft_pending_counsel",
  text:
    "I'm ordering this R-410A equipment for an installation that is permitted under current California rules, and I'll confirm the manufacture date for the job.",
};

/** Equipment whose warranty depends on a licensed install. Supplies, line sets and controls are not. */
const EQUIPMENT_CATEGORIES: ReadonlySet<CatalogCategory> = new Set<CatalogCategory>([
  "mini-splits",
  "air-handlers",
  "central-heat-pumps",
  "central-air-conditioners",
  "central-systems",
  "evaporator-coils",
  "furnaces",
  "cassettes",
]);

export function isEquipment(sku: Pick<StorefrontSku, "category">): boolean {
  return EQUIPMENT_CATEGORIES.has(sku.category);
}

/**
 * Refrigerant sold as a product (a cylinder or jug), as opposed to equipment
 * charged with it or a line set that carries it. Refrigerant sales need EPA
 * Section 608 certification (C-3). No current catalog record matches; the
 * test suite asserts that, so the first one added is noticed.
 */
export function isRefrigerantProduct(sku: Pick<StorefrontSku, "title" | "category"> & { productType?: string }): boolean {
  if (sku.category === "line-sets") return false;
  const text = `${sku.title} ${sku.productType ?? ""}`;
  const names = /\b(refrigerant|r-?\d{2,3}[a-z]?)\b/i.test(text);
  const container = /\b(cylinder|jug|tank|\d+(\.\d+)?\s?(lb|lbs|pound|pounds|kg))\b/i.test(text);
  return names && container;
}

export type BuyerFacts = {
  /** An approved trade account (dealer or installer). */
  trade: boolean;
  /** accounts.epa608_on_file, when known. */
  epa608OnFile: boolean;
};

export type ComplianceLineInput = Pick<StorefrontSku, "id" | "title" | "category" | "specifications" | "ahri" | "btu"> & {
  refrigerant: string | null;
  productType?: string;
};

export type LineRestriction = { code: "r410a_contractor_only" | "refrigerant_needs_epa608"; message: string };
export type ReviewNote = { skuId: string; code: "ca_efficiency_noncompliant" | "ca_efficiency_unconfirmed" | "r410a_install_eligibility"; message: string; hold: boolean };

export type OrderCompliance = {
  restricted: Map<string, LineRestriction>;
  acknowledgements: Acknowledgement[];
  review: ReviewNote[];
  /** True when a review note must hold the order until staff release it. */
  hold: boolean;
};

const UNCONFIRMED: ReadonlySet<CaResidentialStatus> = new Set<CaResidentialStatus>(["unknown", "requires_matched_combination"]);

export function evaluateOrderCompliance(lines: ComplianceLineInput[], buyer: BuyerFacts): OrderCompliance {
  const restricted = new Map<string, LineRestriction>();
  const review: ReviewNote[] = [];
  let needsInstall = false;
  let needsR410a = false;

  for (const sku of lines) {
    if (isRefrigerantProduct(sku) && !(buyer.trade && buyer.epa608OnFile)) {
      restricted.set(sku.id, {
        code: "refrigerant_needs_epa608",
        message: "Refrigerant is sold only to approved trade accounts with an EPA 608 certification on file. Call the counter.",
      });
      continue;
    }
    if (isR410a(sku.refrigerant) && R410A_POLICY.status !== "confirmed_installable") {
      if (R410A_POLICY.status === "not_installable" || !buyer.trade) {
        restricted.set(sku.id, {
          code: "r410a_contractor_only",
          message: "R-410A equipment is available to approved contractor accounts only while California install rules are confirmed. Call the counter about this unit.",
        });
        continue;
      }
      needsR410a = true;
      review.push({ skuId: sku.id, code: "r410a_install_eligibility", message: `${sku.title}: R-410A. Contractor attested to California install eligibility.`, hold: false });
    }
    if (isEquipment(sku)) needsInstall = true;
    if (!buyer.trade) {
      const status = caResidentialStatus(sku);
      if (status === "noncompliant") {
        review.push({ skuId: sku.id, code: "ca_efficiency_noncompliant", message: `${sku.title}: below the California regional efficiency minimum for a new residential install. Confirm the application with the buyer before releasing.`, hold: true });
      } else if (UNCONFIRMED.has(status)) {
        review.push({ skuId: sku.id, code: "ca_efficiency_unconfirmed", message: `${sku.title}: efficiency rating or AHRI pairing not on file. Confirm it before charging.`, hold: false });
      }
    }
  }

  const acknowledgements: Acknowledgement[] = [];
  if (needsInstall) acknowledgements.push(INSTALL_ACKNOWLEDGEMENT);
  if (needsR410a) acknowledgements.push(R410A_ATTESTATION);
  return { restricted, acknowledgements, review, hold: review.some((note) => note.hold) };
}

/** Acknowledgement versions the buyer ticked, checked against what the order requires. */
export function missingAcknowledgements(required: Acknowledgement[], accepted: readonly string[] | undefined): Acknowledgement[] {
  const given = new Set(accepted ?? []);
  return required.filter((ack) => !given.has(ack.version));
}

/** The evidence stored on the order: what was shown, in which version, and when. */
export function acknowledgementRecord(required: Acknowledgement[], review: ReviewNote[], at: Date) {
  return {
    acceptedAt: at.toISOString(),
    accepted: required.map(({ id, version, text, status }) => ({ id, version, text, status })),
    review: review.map(({ skuId, code, message, hold }) => ({ skuId, code, message, hold })),
  };
}
