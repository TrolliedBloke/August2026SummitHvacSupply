/**
 * California residential eligibility report: which records clear the regional
 * efficiency minimum, which AHRI-certified systems the homeowner finder may
 * recommend, and what blocks the rest. Run: npm run catalog:compliance
 */
import {
  complianceSummary,
  INELIGIBLE_REASON_LABEL,
  matchedSystems,
  systemHomeownerEligibility,
} from "../src/lib/catalog/compliance";

const summary = complianceSummary();
console.log("Equipment records:", summary.equipmentRecords);
console.log("By status:", summary.byStatus);
console.log("R-410A records:", summary.r410aRecords);
console.log(`Matched systems: ${summary.matchedSystems} · homeowner eligible: ${summary.homeownerEligibleSystems}`);
console.log("");
for (const system of matchedSystems()) {
  const result = systemHomeownerEligibility(system);
  const parts = system.components.map((sku) => sku.sku).join(" + ");
  console.log(`${result.eligible ? "ELIGIBLE " : "blocked  "} AHRI ${system.ahriReference}  ${parts}  ${system.btu.toLocaleString()} BTU ${system.refrigerant} ${system.lane}`);
  for (const reason of result.reasons) console.log(`           - ${INELIGIBLE_REASON_LABEL[reason]}`);
}
