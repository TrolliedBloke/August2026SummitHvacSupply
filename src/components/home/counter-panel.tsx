"use client";

import { ChevronDown, ClipboardList, List, Upload } from "lucide-react";
import * as React from "react";
import { QuickOrderReview, useQuickOrderReview } from "@/components/quick-order-review";
import { Notice } from "@/components/state";
import { parseQuickOrderText, QUICK_ORDER_ROW_LIMIT } from "@/lib/quick-order";
import { CSV_MAX_BYTES, parseQuickOrderCsv } from "@/lib/csv";

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
            <p className="counter-heading whitespace-nowrap text-base leading-none text-ink-1">Contractor ordering</p>
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

/* Both tabs feed the same pipeline: parse locally (lib/quick-order.ts or
   lib/csv.ts) into one row model, resolve every row in one batch request, show
   the review table, and commit accepted rows in one cart update. Nothing is
   added before the user confirms. */

function QuickOrderTab() {
  const [value, setValue] = React.useState("");
  const review = useQuickOrderReview();
  const parsed = React.useMemo(() => parseQuickOrderText(value), [value]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (parsed.rows.length === 0) return;
    review.load(parsed.rows, parsed.overLimit);
  }

  // The review table sits outside the form: Enter in a row's input must not
  // re-parse the textarea and discard corrections.
  return (
    <>
    <form onSubmit={submit} data-conversion-hook="homepage-bulk-order">
      <p id="quick-order-help" className="text-sm leading-6 text-ink-2">
        One part per line: the part number, a comma, then the quantity. Up to {QUICK_ORDER_ROW_LIMIT} lines.
      </p>
      <label htmlFor="quick-order" className="sr-only">
        Part numbers and quantities
      </label>
      <textarea
        id="quick-order"
        rows={5}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-describedby="quick-order-help"
        placeholder={"TCL24KAHU, 2\nTOS12KODU, 1"}
        className="mt-3 w-full resize-y rounded-(--r-sm) border border-line-strong bg-surface-1 p-3 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={parsed.rows.length === 0}
          className="h-11 rounded-(--r-sm) border border-ink-1 bg-surface-1 px-6 text-sm font-medium text-ink-1 transition-colors duration-150 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
        >
          Review lines
        </button>
        <span className="part-number text-sm text-ink-3">
          {parsed.rows.length} {parsed.rows.length === 1 ? "line" : "lines"}
          {parsed.overLimit > 0 ? ` · ${parsed.overLimit} over the limit` : ""}
        </span>
      </div>
    </form>
    <QuickOrderReview review={review} />
    </>
  );
}

function UploadTab() {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [rowCount, setRowCount] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string | null>(null);
  const review = useQuickOrderReview();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setNotes(null);
    setRowCount(null);
    review.reset();
    setFileName(file.name);
    if (file.size > CSV_MAX_BYTES) {
      setError("That file is larger than 2 MB. Upload a part list, not a catalog export.");
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("That file could not be read. Save it as CSV UTF-8 and try again.");
      return;
    }
    const result = parseQuickOrderCsv(text, file.size);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (result.rows.length === 0) {
      setError("The file has a header but no part lines.");
      return;
    }
    setRowCount(result.rows.length);
    if (result.ignoredColumns.length > 0) setNotes(`Ignored columns: ${result.ignoredColumns.join(", ")}.`);
    review.load(result.rows, result.overLimit);
  }

  return (
    <div>
      <p className="text-sm leading-6 text-ink-2">
        Upload a CSV with a <span className="part-number">sku</span> column and a{" "}
        <span className="part-number">quantity</span> column, comma or tab separated.{" "}
        <a href="/templates/quick-order-template.csv" download className="font-medium text-ink-1 underline underline-offset-4">
          Download the template
        </a>
      </p>
      <label
        htmlFor="csv-upload"
        className="mt-3 flex cursor-pointer items-center justify-center gap-2.5 rounded-(--r-sm) border border-dashed border-line-strong bg-surface-2 px-4 py-7 text-sm text-ink-2 transition-colors duration-150 hover:border-ink-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"
      >
        <Upload size={17} strokeWidth={1.7} aria-hidden="true" />
        {fileName ? <span className="part-number break-all text-ink-1">{fileName}</span> : "Choose a CSV file"}
      </label>
      <input id="csv-upload" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={onFile} className="sr-only" />
      {rowCount !== null && (
        <p className="part-number mt-3 text-sm text-ink-3">{rowCount} {rowCount === 1 ? "line" : "lines"}</p>
      )}
      {notes && <p className="mt-1 text-meta text-ink-3">{notes}</p>}
      {error && (
        <Notice tone="danger" role="alert" className="mt-3">
          {error}
        </Notice>
      )}
      <QuickOrderReview review={review} />
    </div>
  );
}
