"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Upload } from "lucide-react";
import * as React from "react";
import { useQuote } from "@/components/quote-context";

/* The landing panel: one surface, three ways in. Search is the default because
   most visitors arrive with a part number. Quick order and CSV upload exist
   because a contractor arrives with a job list, not a single SKU. */

const TABS = ["Search", "Quick order", "Upload CSV"] as const;
type Tab = (typeof TABS)[number];

const EXAMPLES = ["TCL09KIDU", "TOS12KODU", "Carrier 3 ton", "line set"];

function tabId(name: string) {
  return name.replace(/\s/g, "-");
}

export function CounterPanel() {
  const [tab, setTab] = React.useState<Tab>("Search");

  return (
    <div className="overflow-hidden rounded-(--r-md) border border-line bg-surface-1">
      <div role="tablist" aria-label="How to order" className="flex gap-1 border-b border-line px-2 pt-2">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            type="button"
            id={`counter-tab-${tabId(name)}`}
            aria-selected={tab === name}
            aria-controls={`counter-panel-${tabId(name)}`}
            onClick={() => setTab(name)}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm transition-colors duration-150 ${
              tab === name
                ? "border-brand font-medium text-ink-1"
                : "border-transparent text-ink-2 hover:text-ink-1"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`counter-panel-${tabId(tab)}`}
        aria-labelledby={`counter-tab-${tabId(tab)}`}
        className="p-5"
      >
        {tab === "Search" && <SearchTab />}
        {tab === "Quick order" && <QuickOrderTab />}
        {tab === "Upload CSV" && <UploadTab />}
      </div>
    </div>
  );
}

/* Search + compatibility --------------------------------------------------- */

function SearchTab() {
  return (
    <div className="grid gap-7 md:grid-cols-2 md:gap-8">
      <section className="min-w-0">
        <h2 className="text-[0.95rem] font-medium text-ink-1">Find a product</h2>
        <form action="/products" className="mt-3 flex gap-2.5" data-conversion-hook="homepage-search-start">
          <label htmlFor="counter-search" className="sr-only">
            Search by part number, model number, or product
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-(--r-sm) border border-line-strong bg-surface-1 px-2.5">
            <Search size={17} strokeWidth={1.8} className="shrink-0 text-ink-3" aria-hidden="true" />
            <input
              id="counter-search"
              name="q"
              type="search"
              placeholder="Part #, model #, or product"
              className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-[12px] text-ink-1 outline-none placeholder:text-ink-4"
            />
          </div>
          <button
            type="submit"
            className="h-11 shrink-0 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink transition-colors duration-150 hover:bg-brand-hover"
          >
            Search
          </button>
        </form>

        <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
          <span className="w-full">Popular parts:</span>
          {EXAMPLES.map((example) => (
            <Link
              key={example}
              href={`/products?q=${encodeURIComponent(example)}`}
              className="part-number rounded-(--r-sm) border border-line px-1.5 py-1 text-[11px] text-ink-1 transition-colors duration-150 hover:border-line-strong"
            >
              {example}
            </Link>
          ))}
        </div>
      </section>

      <section className="min-w-0 md:border-l md:border-line md:pl-4">
        <h2 className="text-[0.95rem] font-medium text-ink-1">Verify compatibility</h2>
        <p className="mt-1.5 text-sm leading-6 text-ink-2">
          Enter the model number from the equipment nameplate.
        </p>
        <form action="/products" className="mt-3 flex flex-col gap-2.5 sm:flex-row" data-conversion-hook="homepage-compat-start">
          <label htmlFor="counter-compat" className="sr-only">
            Equipment model number
          </label>
          <input
            id="counter-compat"
            name="q"
            type="search"
            placeholder="Equipment model number"
            className="min-w-0 flex-1 rounded-(--r-sm) border border-line-strong bg-surface-1 px-2 py-2.5 font-mono text-[12px] text-ink-1 outline-none placeholder:text-ink-4"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-(--r-sm) border border-line-strong bg-surface-1 px-2 text-[12px] font-medium text-ink-1 transition-colors duration-150 hover:bg-surface-2"
          >
            Find matching parts
          </button>
        </form>
        <Link
          href="/tools/model-number-decoder"
          className="mt-3 inline-block text-sm text-ink-1 underline underline-offset-4"
        >
          Where do I find the model number?
        </Link>
      </section>
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
          {error && <p className="mt-2 text-sm text-ink-1">{error}</p>}
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
        <p className="mt-3 text-sm leading-6 text-ink-1">
          Not matched: <span className="part-number">{misses.join(", ")}</span>. Search these by
          hand or send the list to the counter.
        </p>
      )}
    </form>
  );
}
