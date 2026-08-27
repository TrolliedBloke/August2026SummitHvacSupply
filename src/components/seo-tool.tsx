"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CustomSelect } from "@/components/custom-select";
import type { SeoTool } from "@/lib/seo/tools";

type SearchSku = { sku: string; modelNumber: string; title: string; btu: number; voltage: string; refrigerant: string; ahriReference: string; href: string; available: number };

export function SeoToolPanel({ tool, skus }: { tool: SeoTool; skus: SearchSku[] }) {
  if (tool.slug === "model-number-decoder") return <ModelLookup skus={skus} />;
  if (tool.slug === "rebate-lookup") return <RebateLookup />;
  if (tool.slug === "ahri-match-finder") return <AhriLookup skus={skus} />;
  if (tool.slug === "system-sizing-estimator") return <SizingEstimator />;
  return <CostComparison />;
}

function ModelLookup({ skus }: { skus: SearchSku[] }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => findMatches(query, skus, false), [query, skus]);
  return <ToolForm label="Model or part number" value={query} onChange={setQuery} placeholder="Example: TSC-09HA2/I3TI23"><Results matches={matches} empty={query.length >= 3 ? "No catalog match. Send a nameplate photo or the full code to the Summit counter." : "Enter at least three characters."} /></ToolForm>;
}

function AhriLookup({ skus }: { skus: SearchSku[] }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => findMatches(query, skus, true), [query, skus]);
  return <ToolForm label="AHRI reference, model, or part number" value={query} onChange={setQuery} placeholder="Enter the complete reference"><Results matches={matches} empty={query.length >= 3 ? "No local record matched. Search the official AHRI Directory or ask Summit to verify the combination." : "Enter at least three characters."} /><a href="https://www.ahridirectory.org/" target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm text-ink-1 underline underline-offset-4">Open the official AHRI Directory</a></ToolForm>;
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
function Results({ matches, empty }: { matches: SearchSku[]; empty: string }) { return <div aria-live="polite" className="mt-5">{matches.length ? <ul className="grid gap-2">{matches.map((sku) => <li key={sku.sku}><Link href={sku.href} className="block rounded-(--r-sm) border border-line p-4"><span className="part-number text-sm text-ink-1">{sku.sku}</span><span className="mt-1 block text-sm text-ink-2">{sku.title} · {sku.btu.toLocaleString()} BTU · {sku.refrigerant}</span><span className={`mt-2 block text-xs ${sku.available > 0 ? "text-stock-ready" : "text-ink-3"}`}>{sku.available > 0 ? `${sku.available} on the shelf in Newark` : "Contact Summit for lead time"}</span></Link></li>)}</ul> : <p className="text-sm text-ink-3">{empty}</p>}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-ink-1">{label}<span className="mt-2 block">{children}</span></label>; }
function Cost({ label, value }: { label: string; value: number }) { return <div className="rounded-(--r-sm) border border-line bg-page p-4"><p className="text-sm text-ink-3">{label}</p><p className="part-number mt-1 text-2xl font-medium text-ink-1">{Number.isFinite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "-"}<span className="ml-1 text-sm text-ink-3">/year</span></p></div>; }
function findMatches(query: string, skus: SearchSku[], includeAhri: boolean) { const normalized = query.toLowerCase().replace(/[^a-z0-9]/g, ""); if (normalized.length < 3) return []; return skus.filter((sku) => [sku.sku, sku.modelNumber, ...(includeAhri ? [sku.ahriReference] : [])].some((value) => value.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normalized))).slice(0, 6); }
