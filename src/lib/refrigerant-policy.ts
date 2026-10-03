/**
 * Refrigerant rules that change what Summit may recommend or advertise.
 *
 * R-410A residential split systems could not be manufactured or imported after
 * January 1, 2025 (AIM Act). EPA's rule effective July 27, 2026 removed the
 * federal installation deadline for systems whose components were all made
 * before 2025. In California, CARB's rule bans sale and installation of
 * equipment "manufactured after the effective date", which on its face leaves
 * pre-2025 inventory installable -- but CARB's definition of manufacture date
 * for systems "built-up and completed on site" can be read against
 * field-assembled splits, and Rheem treats a stand-alone R-410A condenser swap
 * in California as a new installation. No post-May-2026 CARB guidance settles it.
 *
 * Until written confirmation from CARB or the manufacturer is on file,
 * R-410A equipment stays visible to contractors with a notice, is left out of
 * homeowner recommendations, and is never featured in advertising.
 */

export type R410aStatus = "pending_confirmation" | "confirmed_installable" | "not_installable";

export const R410A_POLICY = {
  status: "pending_confirmation" as R410aStatus,
  // TODO(summit-owner): obtain written confirmation from CARB, TCL and Tosot
  // that pre-2025 split inventory may be installed in California; record the
  // document and date here.
  confirmation: null as null | { source: string; receivedAt: string },
  /** Shown beside R-410A equipment on contractor-facing surfaces. */
  contractorNotice:
    "R-410A equipment. Confirm the manufacture date and California install eligibility for the job before ordering.",
  /** California bans the sale of bulk virgin R-410A from this date (SB 1206). */
  bulkVirginSaleEndsCa: "2030-01-01",
} as const;

export function isR410a(refrigerant: string | null | undefined): boolean {
  return /r-?410a/i.test(refrigerant ?? "");
}

/** Whether an R-410A unit may be put in front of a homeowner or in an ad. */
export function r410aPromotable(): boolean {
  return R410A_POLICY.status === "confirmed_installable";
}
