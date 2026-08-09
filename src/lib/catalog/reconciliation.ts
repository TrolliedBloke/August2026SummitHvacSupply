import reportJson from "../../../data/catalog/reconciliation.generated.json";

export type CatalogReconciliationReport = {
  generatedAt: string;
  sourceFile: string;
  sourceSha256: string;
  sourceRows: number;
  generatedRecords: number;
  normalizedIdentifiers: number;
  collisionGroups: number;
  quoteEligible: number;
  purchaseEligible: number;
  positiveRetailPrices: number;
  unknownInventory: number;
  researchCsvOnly: number;
  researchInProgress: number;
  researchVerified: number;
  researchConflicts: number;
  manufacturerImageCoverage: number;
  exactModelImageCoverage: number;
  collisionRows: Array<{ normalizedSku: string; sourceRows: number[]; disposition: string; generatedSkus: string[] }>;
  needsReview: Array<{ sourceRow: number; sourceSku: string; catalogSku: string; issues: string[] }>;
  rowMapping: Array<{ sourceRow: number; sourceSku: string; catalogSku: string; manufacturer: string; model: string | null; product: string; category: string; productType: string; publicationStatus: string; websitePath: string }>;
};

export const catalogReconciliation = reportJson as CatalogReconciliationReport;

export function catalogHealth() {
  const report = catalogReconciliation;
  const completeMapping = report.sourceRows === report.generatedRecords && report.rowMapping.length === report.sourceRows;
  return {
    healthy: completeMapping,
    sourceRows: report.sourceRows,
    generatedRecords: report.generatedRecords,
    normalizedIdentifiers: report.normalizedIdentifiers,
    collisionGroups: report.collisionGroups,
    quoteEligible: report.quoteEligible,
    purchaseEligible: report.purchaseEligible,
    pricedRecords: report.positiveRetailPrices,
    unknownInventory: report.unknownInventory,
    researchCsvOnly: report.researchCsvOnly,
    researchInProgress: report.researchInProgress,
    researchVerified: report.researchVerified,
    researchConflicts: report.researchConflicts,
    manufacturerImageCoverage: report.manufacturerImageCoverage,
    exactModelImageCoverage: report.exactModelImageCoverage,
    needsReview: report.needsReview.length,
  };
}
