"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CustomSelect } from "@/components/custom-select";
import type { SeoTool } from "@/lib/seo/tools";
import {
  MATCH_LABEL,
  MAX_VISIBLE_CANDIDATES,
  resolveIdentifier,
  SUGGESTION_REASON,
  type Candidate,
  type IdentifierOutcome,
  type IdentifierRecord,
} from "@/lib/model-identifier";
import { CROSS_REFERENCES } from "@/lib/storefront/cross-reference";

type SearchSku = { id: string; sku: string; sourceSku: string; modelNumber: string; title: string; btu: number; voltage: string; refrigerant: string; ahriReference: string; href: string; available: number; stockVerified: boolean };

export function SeoToolPanel({ tool, skus }: { tool: SeoTool; skus: SearchSku[] }) {
  if (tool.slug === "model-number-decoder") return <ModelLookup skus={skus} />;
  if (tool.slug === "rebate-lookup") return <RebateLookup />;
  if (tool.slug === "ahri-match-finder") return <AhriLookup skus={skus} />;
  if (tool.slug === "system-sizing-estimator") return <SizingEstimator />;
  return <CostComparison />;
}

/* Both lookups run the shared identifier resolver (lib/model-identifier.ts),
   the same one quick order and the cross-reference table use, and render its
   typed outcome. Textual similarity is never presented as compatibility. */
function ModelLookup({ skus }: { skus: SearchSku[] }) {
  const [query, setQuery] = useState("");
  const outcome = useIdentifier(query, skus, false);
  return (
    <ToolForm label="Model or part number" value={query} onChange={setQuery} placeholder="Example: TSC-09HA2/I3TI23">
      <OutcomeView outcome={outcome} skus={skus} query={query} />
    </ToolForm>
  );
}

function AhriLookup({ skus }: { skus: SearchSku[] }) {
  const [query, setQuery] = useState("");
  const outcome = useIdentifier(query, skus, true);
  return (
    <ToolForm label="AHRI reference, model, or part number" value={query} onChange={setQuery} placeholder="Enter the complete reference">
      <OutcomeView outcome={outcome} skus={skus} query={query} />
      <a href="https://www.ahridirectory.org/" target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm text-ink-1 underline underline-offset-4">
        Open the official AHRI Directory<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </ToolForm>
  );
}

function useIdentifier(query: string, skus: SearchSku[], includeAhri: boolean): IdentifierOutcome {
  const records = useMemo<IdentifierRecord[]>(
    () =>
      skus.map((sku) => ({
        id: sku.id,
        codes: [
          { value: sku.sku, field: "sku" },
          { value: sku.modelNumber, field: "model" },
          { value: sku.sourceSku, field: "sourceSku" },
          ...(includeAhri && sku.ahriReference ? [{ value: sku.ahriReference, field: "ahri" as const }] : []),
        ],
      })),
    [skus, includeAhri]
  );
  return useMemo(() => resolveIdentifier(query, records, CROSS_REFERENCES), [query, records]);
}

function OutcomeView({ outcome, skus, query }: { outcome: IdentifierOutcome; skus: SearchSku[]; query: string }) {
  const byId = (id: string) => skus.find((sku) => sku.id === id)!;
  let body: React.ReactNode;
  switch (outcome.kind) {
    case "invalid":
      body = query ? <p className="text-sm text-ink-3">Use the letters and numbers printed on the nameplate.</p> : <p className="text-sm text-ink-3">Enter a model or part number from the nameplate.</p>;
      break;
    case "too_short":
      body = <p className="text-sm text-ink-3">Enter at least {outcome.minLength} letters or numbers.</p>;
      break;
    case "exact":
      body = (
        <>
          <p className="mb-2 text-sm font-medium text-ink-1">Exact match in our catalog</p>
          <ResultList candidates={[outcome.match]} byId={byId} />
          {outcome.others.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-sm font-medium text-ink-1">Other close results</p>
              <ResultList candidates={outcome.others} byId={byId} />
            </>
          )}
        </>
      );
      break;
    case "ambiguous":
      body = (
        <>
          <p className="mb-2 text-sm font-medium text-ink-1">
            {outcome.total} products start with or contain your entry
            {outcome.total > MAX_VISIBLE_CANDIDATES ? `. Showing ${MAX_VISIBLE_CANDIDATES} -- add more characters to narrow it.` : ". Pick the exact one."}
          </p>
          <ResultList candidates={outcome.candidates} byId={byId} />
        </>
      );
      break;
    case "cross_reference":
      body = (
        <>
          <p className="mb-2 text-sm font-medium text-ink-1">Verified cross-reference for {outcome.reference.sourceModel}</p>
          <p className="mb-3 text-xs text-ink-3">
            Verified by {outcome.reference.verifiedBy}.{" "}
            <a href={outcome.reference.evidenceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Evidence
            </a>
          </p>
          <ul className="grid gap-2">
            {outcome.reference.skuIds.map((id) => {
              const sku = skus.find((item) => item.id === id);
              return sku ? <ResultCard key={id} sku={sku} label="Verified replacement" /> : null;
            })}
          </ul>
        </>
      );
      break;
    case "no_coverage":
      body = (
        <>
          <p className="text-sm font-medium text-ink-1">No product in our catalog matches “{query.trim()}”.</p>
          {outcome.suggestions.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-sm text-ink-2">
                Did you mean one of these? <span className="text-ink-3">These are suggestions based on similar characters, not a confirmed match or compatibility.</span>
              </p>
              <ResultList candidates={outcome.suggestions} byId={byId} />
            </>
          )}
          <HowToFindModel />
        </>
      );
      break;
  }
  return (
    <div aria-live="polite" className="mt-5">
      {body}
    </div>
  );
}

function ResultList({ candidates, byId }: { candidates: Candidate[]; byId: (id: string) => SearchSku }) {
  return (
    <ul className="grid gap-2">
      {candidates.map((candidate) => (
        <ResultCard
          key={candidate.id}
          sku={byId(candidate.id)}
          label={candidate.matchType === "suggestion" && candidate.reason ? `Suggestion · ${SUGGESTION_REASON[candidate.reason]}` : MATCH_LABEL[candidate.matchType]}
        />
      ))}
    </ul>
  );
}

function ResultCard({ sku, label }: { sku: SearchSku; label: string }) {
  return (
    <li>
      <Link href={sku.href} className="block rounded-(--r-sm) border border-line p-4 transition-colors hover:border-line-strong">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="part-number text-sm text-ink-1">{sku.sku}</span>
          <span className="text-xs text-ink-3">{label}</span>
        </span>
        <span className="mt-1 block text-sm text-ink-2">
          {sku.title}
          {sku.modelNumber ? ` · ${sku.modelNumber}` : ""}
          {sku.btu ? ` · ${sku.btu.toLocaleString()} BTU` : ""}
          {sku.refrigerant ? ` · ${sku.refrigerant}` : ""}
        </span>
        <span className="mt-2 block text-xs text-ink-3">
          {sku.stockVerified && sku.available > 0 ? `${sku.available} counted in Newark` : "Stock confirmed at order"}
        </span>
      </Link>
    </li>
  );
}

function HowToFindModel() {
  return (
    <details className="mt-5 rounded-(--r-sm) border border-line bg-surface-1">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-ink-1">How to find the model number</summary>
      <div className="border-t border-line px-4 py-3 text-sm leading-6 text-ink-2">
        <ul className="list-disc space-y-1 pl-5">
          <li>Outdoor units: the rating plate is usually on the side panel near the service valves.</li>
          <li>Indoor wall units: lift the front panel; the label is on the right side of the chassis.</li>
          <li>Air handlers and furnaces: inside the blower or burner door.</li>
          <li>Copy the full model, including any suffix after a dash or slash, and the serial number.</li>
        </ul>
        <p className="mt-3">
          Still stuck?{" "}
          <Link href="/contact?topic=product" className="font-medium text-ink-1 underline underline-offset-4">
            Send the nameplate to the counter
          </Link>{" "}
          and we will match it.
        </p>
      </div>
    </details>
  );
}

function RebateLookup() {
  const [zip, setZip] = useState("");
  const valid = /^9\d{4}$/.test(zip);
  return <ToolForm label="Project ZIP code" value={zip} onChange={(value) => setZip(value.replace(/\D/g, "").slice(0, 5))} placeholder="94560" inputMode="numeric">{valid ? <div aria-live="polite" className="mt-5 rounded-(--r-sm) border border-line bg-page p-5"><h2 className="font-medium text-ink-1">Programs to verify for {zip}</h2><ul className="mt-3 space-y-3 text-sm leading-6 text-ink-2"><li><strong className="font-medium text-ink-1">TECH Clean California:</strong> check active measure, contractor, and service-territory rules.</li><li><strong className="font-medium text-ink-1">BayREN:</strong> check current regional home-energy offerings and project requirements.</li><li><strong className="font-medium text-ink-1">Your electric utility:</strong> confirm service territory and current equipment list using the account address.</li><li><strong className="font-medium text-ink-1">Federal 25C:</strong> unavailable for property placed in service after December 31, 2025, according to the IRS.</li></ul><Link href={`/homeowners#homeowner-request`} className="mt-4 inline-flex text-sm text-ink-1 underline underline-offset-4">Send this ZIP for rebate-aware equipment help</Link></div> : <p className="mt-3 text-sm text-ink-3">Enter a five-digit California ZIP to see the verification checklist.</p>}</ToolForm>;
}

function SizingEstimator() {
  const [area, setArea] = useState("500");
  const [rooms, setRooms] = useState("1");
  const [ducts, setDucts] = useState("unknown");
  const squareFeet = Number(area);
  const estimate = Math.max(9000, Math.min(60000, Math.ceil((squareFeet * 25) / 6000) * 6000));
  return <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7"><div className="grid gap-5 sm:grid-cols-3"><Field label="Conditioned area"><input className="field" type="number" min="100" max="5000" step="50" value={area} onChange={(event) => setArea(event.target.value)} /></Field><Field label="Rooms or zones"><input className="field" type="number" min="1" max="8" value={rooms} onChange={(event) => setRooms(event.target.value)} /></Field><Field label="Existing ducts"><CustomSelect ariaLabel="Existing ducts" value={ducts} onChange={setDucts} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Not sure" }]} /></Field></div><div aria-live="polite" className="mt-6 rounded-(--r-sm) border border-line bg-page p-5"><p className="text-sm text-ink-3">Conversation starting point</p><p className="part-number mt-1 text-3xl font-medium text-ink-1">{Number.isFinite(estimate) ? estimate.toLocaleString() : "-"} BTU</p><p className="mt-2 text-sm leading-6 text-ink-2">For {rooms} room{rooms === "1" ? "" : "s"}, this suggests reviewing {ducts === "no" ? "ductless" : ducts === "yes" ? "ducted or ductless" : "ducted and ductless"} options near this capacity. Solar gain, insulation, ceiling height, leakage, climate, and occupancy can change the result substantially.</p><Link href={`/products?btu=${estimate <= 12000 ? "small" : estimate >= 36000 ? "large" : "mid"}`} className="mt-4 inline-flex text-sm text-ink-1 underline underline-offset-4">Review nearby equipment</Link></div></div>;
}

function CostComparison() {
  const [kwh, setKwh] = useState("3500"); const [electricRate, setElectricRate] = useState("0.38"); const [therms, setTherms] = useState("500"); const [gasRate, setGasRate] = useState("2.40");
  const electric = Number(kwh) * Number(electricRate); const gas = Number(therms) * Number(gasRate);
  return <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7"><div className="grid gap-5 sm:grid-cols-2"><Field label="Annual heat-pump electricity (kWh)"><input className="field" type="number" min="0" value={kwh} onChange={(event) => setKwh(event.target.value)} /></Field><Field label="Electricity rate ($/kWh)"><input className="field" type="number" min="0" step="0.01" value={electricRate} onChange={(event) => setElectricRate(event.target.value)} /></Field><Field label="Annual heating gas (therms)"><input className="field" type="number" min="0" value={therms} onChange={(event) => setTherms(event.target.value)} /></Field><Field label="Gas rate ($/therm)"><input className="field" type="number" min="0" step="0.01" value={gasRate} onChange={(event) => setGasRate(event.target.value)} /></Field></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Cost label="Heat pump electricity" value={electric} /><Cost label="Gas fuel only" value={gas} /></div><p className="mt-4 text-xs leading-5 text-ink-3">Gas total excludes fixed charges, furnace electricity, and maintenance. Heat-pump usage must come from an energy model, monitored data, or a documented estimate. Do not compare equipment using rates alone.</p></div>;
}

function ToolForm({ label, value, onChange, placeholder, inputMode, children }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; inputMode?: "numeric"; children: React.ReactNode }) { return <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7"><label className="block text-sm font-medium text-ink-1" htmlFor="seo-tool-input">{label}</label><input id="seo-tool-input" className="field mt-2" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} autoComplete="off" />{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-ink-1">{label}<span className="mt-2 block">{children}</span></label>; }
function Cost({ label, value }: { label: string; value: number }) { return <div className="rounded-(--r-sm) border border-line bg-page p-4"><p className="text-sm text-ink-3">{label}</p><p className="part-number mt-1 text-2xl font-medium text-ink-1">{Number.isFinite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "-"}<span className="ml-1 text-sm text-ink-3">/year</span></p></div>; }
