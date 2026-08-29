"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, ClipboardList, List, Upload } from "lucide-react";
import * as React from "react";
import { useQuote } from "@/components/quote-context";

/* Search lives in the shared header. This panel is deliberately limited to the
   two bulk-order workflows that are distinct from search: a contractor arrives
   with either a pasted job list or a CSV, and neither should compete with the
   category-led shopping choices above it. */

const TOOLS = ["Quick order", "Upload CSV"] as const;
type Tool = (typeof TOOLS)[number];

export function CounterPanel() {
  const [activeTool, setActiveTool] = React.useState<Tool | null>(null);

  return (
    <div className="overflow-hidden rounded-(--r-sm) border border-line bg-surface-1">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <ClipboardList size={32} strokeWidth={1.4} className="shrink-0 text-ink-1" aria-hidden="true" />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-7">
            <p className="counter-heading whitespace-nowrap text-[1.05rem] leading-none text-ink-1">Contractor ordering</p>
            <p className="text-sm text-ink-2">Order by SKU or upload your material list.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[430px]" aria-label="Contractor ordering tools">
          {TOOLS.map((name) => {
            const expanded = activeTool === name;
            return (
              <button
                key={name}
                type="button"
                id={`contractor-tool-${name === "Quick order" ? "quick" : "csv"}`}
                aria-expanded={expanded}
                aria-controls="contractor-order-panel"
                onClick={() => setActiveTool(expanded ? null : name)}
                className={`inline-flex h-11 items-center justify-center gap-2.5 rounded-(--r-sm) border px-4 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                  expanded
                    ? "border-ink-1 bg-surface-2 text-ink-1"
                    : "border-line-strong bg-surface-1 text-ink-1 hover:bg-surface-2"
                }`}
              >
                {name === "Quick order" ? <List size={17} aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}
                {name}
                <ChevronDown
                  size={15}
                  strokeWidth={1.8}
                  className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      {activeTool && (
        <div
          role="region"
          id="contractor-order-panel"
          aria-labelledby={`contractor-tool-${activeTool === "Quick order" ? "quick" : "csv"}`}
          className="border-t border-line p-5"
        >
          {activeTool === "Quick order" ? <QuickOrderTab /> : <UploadTab />}
        </div>
      )}
    </div>
  );
}

/* Quick order + CSV -------------------------------------------------------- */

type Parsed = { sku: string; qty: number };

/** Accepts "SKU, 2" / "SKU 2" / "SKU" per line. Quantity defaults to 1. */
function parseLines(raw: string): Parsed[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t]|\s+/).filter(Boolean);
      const sku = parts[0] ?? "";
      const qty = Number.parseInt(parts[1] ?? "1", 10);
      return { sku, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 };
    })
    .filter((entry) => entry.sku.length > 0);
}

function QuickOrderTab() {
  const [value, setValue] = React.useState("");
  return (
    <BulkForm
      label="Paste one part number per line. Add a quantity after a comma."
      parsed={parseLines(value)}
      control={
        <>
          <label htmlFor="quick-order" className="sr-only">
            Part numbers and quantities
          </label>
          <textarea
            id="quick-order"
            rows={5}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={"TCL24KAHU, 2\nTOS12KODU, 1"}
            className="w-full resize-y rounded-(--r-sm) border border-line-strong bg-surface-1 p-3 font-mono text-sm text-ink-1 outline-none placeholder:text-ink-4"
          />
        </>
      }
    />
  );
}

function UploadTab() {
  const [value, setValue] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    // 2 MB is far past any plausible job list; past that it is the wrong file.
    if (file.size > 2_000_000) {
      setError("That file is larger than 2 MB. Upload a part list, not a catalog export.");
      return;
    }
    try {
      const text = await file.text();
      setFileName(file.name);
      // Drop a header row if the first cell is obviously a label.
      const lines = text.split(/\r?\n/);
      const body = /sku|part|item/i.test(lines[0] ?? "") ? lines.slice(1) : lines;
      setValue(body.join("\n"));
    } catch {
      setError("That file could not be read. Save it as CSV and try again.");
    }
  }

  return (
    <BulkForm
      label="Upload a CSV with a part number in the first column and a quantity in the second."
      parsed={parseLines(value)}
      control={
        <>
          <label
            htmlFor="csv-upload"
            className="flex cursor-pointer items-center justify-center gap-2.5 rounded-(--r-sm) border border-dashed border-line-strong bg-surface-2 px-4 py-7 text-sm text-ink-2 transition-colors duration-150 hover:border-ink-4"
          >
            <Upload size={17} strokeWidth={1.7} aria-hidden="true" />
            {fileName ? <span className="part-number text-ink-1">{fileName}</span> : "Choose a CSV file"}
          </label>
          <input id="csv-upload" type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
          {error && <p role="alert" className="mt-2 text-sm text-ink-1">{error}</p>}
        </>
      }
    />
  );
}

/* Shared submit path for both bulk tabs. Every pasted line is resolved against
   the real catalog before anything is added -- an unmatched part number is
   reported back rather than silently dropped. */
function BulkForm({
  label,
  control,
  parsed,
}: {
  label: string;
  control: React.ReactNode;
  parsed: Parsed[];
}) {
  const { add, open } = useQuote();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [misses, setMisses] = React.useState<string[]>([]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (parsed.length === 0 || busy) return;
    setBusy(true);
    setMisses([]);
    const notFound: string[] = [];
    let added = 0;

    for (const entry of parsed.slice(0, 50)) {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(entry.sku)}`);
        const payload = await res.json();
        const hit = payload.results?.[0];
        if (!hit) {
          notFound.push(entry.sku);
          continue;
        }
        for (let i = 0; i < entry.qty; i += 1) {
          add({
            skuId: hit.id,
            sku: hit.sku,
            modelNumber: hit.modelNumber,
            title: hit.title,
            image: "/logo-summit.svg",
            unitPrice: 0,
            available: hit.available ?? 0,
          });
        }
        added += 1;
      } catch {
        notFound.push(entry.sku);
      }
    }

    setBusy(false);
    setMisses(notFound);
    if (added > 0) open();
    else if (notFound.length > 0) router.push(`/products?q=${encodeURIComponent(notFound[0])}`);
  }

  return (
    <form onSubmit={submit} data-conversion-hook="homepage-bulk-order">
      <p className="text-sm leading-6 text-ink-2">{label}</p>
      <div className="mt-3">{control}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={parsed.length === 0 || busy}
          className="h-11 rounded-(--r-sm) bg-brand px-6 text-sm font-medium text-brand-ink transition-colors duration-150 hover:bg-brand-hover disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? "Matching..." : "Add to order"}
        </button>
        <span className="part-number text-sm text-ink-3">
          {parsed.length} {parsed.length === 1 ? "line" : "lines"}
        </span>
      </div>
      {misses.length > 0 && (
        <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-ink-1">
          Not matched: <span className="part-number">{misses.join(", ")}</span>. Search these by
          hand or send the list to the counter.
        </p>
      )}
    </form>
  );
}
