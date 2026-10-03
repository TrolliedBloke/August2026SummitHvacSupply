import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui";
import { requireStaff } from "@/lib/backend/auth";
import { catalogHealth, catalogReconciliation } from "@/lib/catalog/reconciliation";
import { complianceSummary, INELIGIBLE_REASON_LABEL, matchedSystems, systemHomeownerEligibility } from "@/lib/catalog/compliance";

export const metadata = { title: "Catalog Reconciliation" };

export default async function CatalogAdminPage() {
  await requireStaff("/admin/catalog");
  const health = catalogHealth();
  const compliance = complianceSummary();
  const systems = matchedSystems().map((system) => ({ system, eligibility: systemHomeownerEligibility(system) }));
  return <Container className="py-10 lg:py-14">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-3xl font-semibold text-ink-1">Catalog reconciliation</h1><p className="mt-2 text-ink-2">Row-level coverage and production-readiness gates for the inventory CSV.</p></div><Link href="/products" className="text-sm font-medium text-brand">View public catalog</Link></div>
    <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Kpi label="Source rows" value={health.sourceRows} good={health.sourceRows === health.generatedRecords} /><Kpi label="Generated records" value={health.generatedRecords} good={health.generatedRecords === health.sourceRows} /><Kpi label="Collision groups" value={health.collisionGroups} good={health.collisionGroups === 0} /><Kpi label="Research started" value={health.researchInProgress + health.researchVerified} good={health.researchCsvOnly === 0} /><Kpi label="Manufacturer images" value={health.manufacturerImageCoverage} good={health.manufacturerImageCoverage > 0} /><Kpi label="Purchase eligible" value={health.purchaseEligible} good={health.purchaseEligible > 0} /></section>
    <section className="mt-8 rounded-(--r-md) border border-line bg-surface-1 p-5"><h2 className="font-display text-xl font-semibold text-ink-1">Launch gates</h2><ul className="mt-4 grid gap-2 text-sm text-ink-2"><Gate ok={health.unknownInventory === health.sourceRows} label={`${health.unknownInventory} records intentionally use non-quantity-tracked ordering`} /><Gate ok={health.collisionGroups === 0} label={`${health.collisionGroups} normalized identifier groups remain distinct, traceable variants`} /><Gate ok={health.researchConflicts === 0} label={`${health.researchCsvOnly} records remain CSV-only; ${health.researchConflicts} research conflicts`} /><Gate ok={health.manufacturerImageCoverage === 77} label={`${health.exactModelImageCoverage} of 77 branded products have exact SKU-mapped manufacturer media; no family fallback is published`} /><Gate ok={health.needsReview === 0} label={`${health.needsReview} records require basic identity review`} /><Gate ok={health.purchaseEligible === health.pricedRecords} label={`${health.purchaseEligible} of ${health.pricedRecords} positively priced records are purchase eligible`} /><Gate ok={health.sourceRows === health.generatedRecords} label="Every CSV row maps to a catalog record" /></ul></section>
    <section className="mt-8 rounded-(--r-md) border border-line bg-surface-1 p-5">
      <h2 className="font-display text-xl font-semibold text-ink-1">California residential eligibility</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-2">The homeowner finder recommends only AHRI-certified systems whose rating is on file and clears the DOE Southwest minimum, under a brand policy that allows homeowner sales. A missing rating never counts as compliant. Run <span className="part-number">npm run catalog:compliance</span> for the full list.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Rated and compliant" value={compliance.byStatus.compliant} good={compliance.byStatus.compliant > 0} />
        <Kpi label="Needs matched pairing" value={compliance.byStatus.requires_matched_combination} good={compliance.byStatus.requires_matched_combination === 0} />
        <Kpi label="No rating on file" value={compliance.byStatus.unknown} good={compliance.byStatus.unknown === 0} />
        <Kpi label="R-410A records" value={compliance.r410aRecords} good={compliance.r410aRecords === 0} />
        <Kpi label="Homeowner systems" value={compliance.homeownerEligibleSystems} good={compliance.homeownerEligibleSystems > 0} />
      </div>
      <ul className="mt-5 grid gap-2 text-sm text-ink-2">
        {systems.map(({ system, eligibility }) => (
          <li key={system.ahriReference} className="rounded-(--r-sm) bg-surface-2 p-3">
            <span className="flex flex-wrap items-center gap-2 text-ink-1">{eligibility.eligible ? <CheckCircle2 className="text-eco" size={16} /> : <AlertTriangle className="text-copper" size={16} />}<span className="part-number">AHRI {system.ahriReference}</span> · {system.components.map((sku) => sku.sku).join(" + ")} · {system.btu.toLocaleString()} BTU {system.refrigerant}</span>
            {eligibility.reasons.length > 0 && <span className="mt-1 block text-ink-3">{eligibility.reasons.map((reason) => INELIGIBLE_REASON_LABEL[reason]).join(" · ")}</span>}
          </li>
        ))}
      </ul>
    </section>
    <section className="mt-8"><h2 className="font-display text-xl font-semibold text-ink-1">Collision queue</h2><div className="mt-3 overflow-x-auto rounded-(--r-md) border border-line"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-surface-2 text-xs uppercase tracking-wider text-ink-3"><tr><th className="px-4 py-3">Identifier</th><th className="px-4 py-3">Rows</th><th className="px-4 py-3">Generated variants</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-line">{catalogReconciliation.collisionRows.map((collision) => <tr key={collision.normalizedSku}><td className="px-4 py-3 font-mono">{collision.normalizedSku}</td><td className="px-4 py-3">{collision.sourceRows.join(", ")}</td><td className="px-4 py-3 font-mono text-xs">{collision.generatedSkus.join(" · ")}</td><td className="px-4 py-3">Human confirmation required</td></tr>)}</tbody></table></div></section>
  </Container>;
}

function Kpi({ label, value, good }: { label: string; value: number; good: boolean }) { return <div className="rounded-(--r-md) border border-line bg-surface-1 p-4"><p className="text-xs uppercase tracking-wider text-ink-3">{label}</p><div className="mt-2 flex items-center justify-between"><p className="text-2xl font-semibold text-ink-1">{value}</p>{good ? <CheckCircle2 className="text-eco" size={18} /> : <AlertTriangle className="text-copper" size={18} />}</div></div>; }
function Gate({ ok, label }: { ok: boolean; label: string }) { return <li className="flex items-center gap-2">{ok ? <CheckCircle2 className="text-eco" size={16} /> : <AlertTriangle className="text-copper" size={16} />}<span>{label}</span></li>; }
