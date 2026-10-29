"use client";

import Link from "next/link";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import * as React from "react";
import { useQuote } from "@/components/quote-context";
import { CustomSelect } from "@/components/custom-select";
import { Notice } from "@/components/state";
import {
  buildRow,
  isRowValid,
  mergeDuplicateRows,
  QUICK_ORDER_ROW_LIMIT,
  ROW_ERROR_COPY,
  type QuickOrderRow,
} from "@/lib/quick-order";
import type { ResolvedProduct, ResolvedRow } from "@/lib/storefront/identifier-resolution";

/**
 * The review stage shared by pasted quick order and CSV import.
 *
 * Parsing, catalog resolution and the cart mutation are separate steps: rows
 * are parsed locally, resolved against the catalog in ONE batch request, shown
 * here for correction, and only then committed through ONE addMany call. The
 * commit is explicitly partial: resolved rows are added, rows with problems
 * stay in the table with their values for the user to fix or remove.
 */

type ReviewRow = {
  key: string;
  row: QuickOrderRow;
  mergedLines: number[];
  resolution: ResolvedRow | null;
  choice: string | null;
};

type Status = "idle" | "resolving" | "error";

function toReviewRows(rows: QuickOrderRow[]): ReviewRow[] {
  return mergeDuplicateRows(rows).map((row, index) => ({
    key: `${row.line}-${index}-${row.normalized}`,
    row,
    mergedLines: row.mergedLines,
    resolution: null,
    choice: null,
  }));
}

function acceptedProduct(item: ReviewRow): ResolvedProduct | null {
  if (!isRowValid(item.row) || !item.resolution) return null;
  if (item.resolution.status === "found") return item.resolution.product;
  if (item.resolution.status === "ambiguous" && item.choice) {
    return item.resolution.candidates.find((candidate) => candidate.id === item.choice) ?? null;
  }
  return null;
}

export function useQuickOrderReview() {
  const [items, setItems] = React.useState<ReviewRow[]>([]);
  const [status, setStatus] = React.useState<Status>("idle");
  const [overLimit, setOverLimit] = React.useState(0);
  const requestRef = React.useRef(0);

  const resolve = React.useCallback(async (targets: ReviewRow[]) => {
    const pending = targets.filter((item) => isRowValid(item.row) && !item.resolution);
    if (pending.length === 0) return;
    const requestId = ++requestRef.current;
    setStatus("resolving");
    try {
      const response = await fetch("/api/quick-order/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: pending.map((item) => ({ line: item.row.line, sku: item.row.sku })) }),
      });
      const payload = await response.json();
      if (requestRef.current !== requestId) return;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Lookup failed");
      const byLine = new Map<number, ResolvedRow>((payload.rows as ResolvedRow[]).map((row) => [row.line, row]));
      setItems((current) =>
        current.map((item) =>
          pending.some((target) => target.key === item.key) && byLine.has(item.row.line)
            ? { ...item, resolution: byLine.get(item.row.line)!, choice: null }
            : item
        )
      );
      setStatus("idle");
    } catch {
      if (requestRef.current === requestId) setStatus("error");
    }
  }, []);

  const load = React.useCallback(
    (rows: QuickOrderRow[], over: number) => {
      const next = toReviewRows(rows);
      setItems(next);
      setOverLimit(over);
      void resolve(next);
    },
    [resolve]
  );

  return { items, setItems, status, overLimit, load, resolve, reset: () => { setItems([]); setOverLimit(0); setStatus("idle"); } };
}

export function QuickOrderReview({
  review,
  onDone,
}: {
  review: ReturnType<typeof useQuickOrderReview>;
  onDone?: () => void;
}) {
  const { addMany } = useQuote();
  const { items, setItems, status, overLimit, resolve } = review;
  const [committed, setCommitted] = React.useState<string | null>(null);
  const summaryRef = React.useRef<HTMLDivElement>(null);

  const accepted = items.flatMap((item) => {
    const product = acceptedProduct(item);
    return product ? [{ item, product }] : [];
  });
  const problems = items.length - accepted.length;
  const dirty = items.some((item) => isRowValid(item.row) && !item.resolution);

  function edit(key: string, patch: { sku?: string; quantity?: string }) {
    setCommitted(null);
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const sku = patch.sku ?? item.row.sku;
        const quantity = patch.quantity ?? item.row.rawQuantity;
        const row = buildRow(item.row.line, `${sku}, ${quantity}`, sku, quantity);
        // Only a changed part number needs a new lookup.
        const resolution = patch.sku !== undefined && patch.sku !== item.row.sku ? null : item.resolution;
        return { ...item, row, resolution, choice: resolution ? item.choice : null };
      })
    );
  }

  function choose(key: string, id: string) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, choice: id } : item)));
  }

  function removeRow(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function commit() {
    if (accepted.length === 0) return;
    addMany(
      accepted.map(({ item, product }) => ({
        skuId: product.id,
        sku: product.sku,
        modelNumber: product.modelNumber,
        title: product.title,
        image: product.image,
        unitPrice: product.unitPrice,
        available: product.available,
        intent: product.intent,
        qty: item.row.quantity ?? 1,
      }))
    );
    const added = new Set(accepted.map(({ item }) => item.key));
    setItems((current) => current.filter((item) => !added.has(item.key)));
    setCommitted(
      `${accepted.length} ${accepted.length === 1 ? "line" : "lines"} added to your order.${
        problems > 0 ? ` ${problems} still ${problems === 1 ? "needs" : "need"} attention below.` : ""
      }`
    );
    if (problems === 0) onDone?.();
  }

  if (items.length === 0 && !committed) return null;

  return (
    <section aria-labelledby="quick-order-review-title" className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="quick-order-review-title" className="text-base font-medium text-ink-1">
          Review lines
        </h3>
        <p className="text-meta text-ink-3" aria-live="polite">
          {status === "resolving" ? "Matching against the catalog…" : `${accepted.length} ready · ${problems} need attention`}
        </p>
      </div>

      <div ref={summaryRef} tabIndex={-1} className="outline-none">
        {committed && (
          <Notice tone="success" role="status" className="mt-3">
            {committed}
          </Notice>
        )}
        {overLimit > 0 && (
          <Notice tone="warning" className="mt-3" title={`Only the first ${QUICK_ORDER_ROW_LIMIT} lines were read`}>
            {overLimit} more {overLimit === 1 ? "line was" : "lines were"} left out. Split the list, or send it to the counter.
          </Notice>
        )}
        {status === "error" && (
          <Notice
            tone="danger"
            role="alert"
            className="mt-3"
            title="The catalog lookup did not finish"
            action={
              <button type="button" onClick={() => void resolve(items)} className="min-h-11 text-sm font-medium text-ink-1 underline underline-offset-4">
                Try the lookup again
              </button>
            }
          >
            Your lines are kept. Nothing was added to the order.
          </Notice>
        )}
      </div>

      {items.length > 0 && (
        <ol className="mt-3 divide-y divide-line rounded-(--r-sm) border border-line">
          {items.map((item) => (
            <ReviewLine
              key={item.key}
              item={item}
              onEdit={(patch) => edit(item.key, patch)}
              onChoose={(id) => choose(item.key, id)}
              onRemove={() => removeRow(item.key)}
            />
          ))}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {dirty && (
          <button
            type="button"
            onClick={() => void resolve(items)}
            disabled={status === "resolving"}
            className="h-11 rounded-(--r-sm) border border-line-strong bg-surface-1 px-5 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            Check changed lines
          </button>
        )}
        <button
          type="button"
          onClick={commit}
          disabled={accepted.length === 0 || status === "resolving"}
          className="h-11 rounded-(--r-sm) bg-brand px-6 text-sm font-medium text-brand-ink transition-colors duration-150 hover:bg-brand-hover disabled:pointer-events-none disabled:opacity-50"
        >
          {accepted.length === 0 ? "Add to order" : `Add ${accepted.length} ${accepted.length === 1 ? "line" : "lines"} to order`}
        </button>
        {problems > 0 && accepted.length > 0 && (
          <span className="text-meta text-ink-3">Lines that need attention are not added.</span>
        )}
      </div>
    </section>
  );
}

function ReviewLine({
  item,
  onEdit,
  onChoose,
  onRemove,
}: {
  item: ReviewRow;
  onEdit: (patch: { sku?: string; quantity?: string }) => void;
  onChoose: (id: string) => void;
  onRemove: () => void;
}) {
  const { row, resolution } = item;
  const id = `qo-${item.key}`;
  const errorId = `${id}-status`;
  const hasErrors = row.errors.length > 0;
  const skuInvalid = row.errors.includes("missing_sku") || resolution?.status === "unknown";
  const qtyInvalid = row.errors.some((code) => code !== "missing_sku");

  return (
    <li className="grid gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[2.5rem_minmax(8rem,1fr)_5.5rem_minmax(12rem,1.6fr)_2.75rem] sm:items-start">
      <span className="part-number pt-3 text-micro text-ink-3">
        <span className="sr-only">Line </span>
        {item.mergedLines.join(" + ")}
      </span>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2 sm:contents">
        <label className="min-w-0">
          <span className="sr-only">Part number, line {row.line}</span>
          <input
            value={row.sku}
            onChange={(event) => onEdit({ sku: event.target.value })}
            aria-invalid={skuInvalid || undefined}
            aria-describedby={errorId}
            className="part-number h-11 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-state-danger-ink"
          />
        </label>
        <label>
          <span className="sr-only">Quantity, line {row.line}</span>
          <input
            value={row.rawQuantity}
            inputMode="numeric"
            onChange={(event) => onEdit({ quantity: event.target.value })}
            aria-invalid={qtyInvalid || undefined}
            aria-describedby={errorId}
            className="tnum h-11 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-state-danger-ink"
          />
        </label>
      </div>
      <div id={errorId} className="min-w-0 text-sm leading-6">
        {hasErrors ? (
          <p className="flex items-start gap-2 text-state-danger-ink">
            <AlertTriangle size={15} className="mt-1 shrink-0" aria-hidden="true" />
            <span>{row.errors.map((code) => ROW_ERROR_COPY[code]).join(" ")}</span>
          </p>
        ) : !resolution ? (
          <p className="flex items-center gap-2 text-ink-3">
            <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" />
            Not checked yet
          </p>
        ) : resolution.status === "found" ? (
          <div className="flex items-start gap-2">
            <Check size={15} className="mt-1 shrink-0 text-brand" aria-hidden="true" />
            <div className="min-w-0">
              <Link href={resolution.product.href} className="font-medium text-ink-1 underline-offset-4 hover:underline">
                {resolution.product.title}
              </Link>
              <p className="text-meta text-ink-3">
                {resolution.product.priceText ? `${resolution.product.priceText} · ` : ""}
                {resolution.product.statusLabel}
                {item.mergedLines.length > 1 ? ` · lines ${item.mergedLines.join(", ")} combined` : ""}
              </p>
            </div>
          </div>
        ) : resolution.status === "ambiguous" ? (
          <div>
            <p className="text-state-warning-ink">Several products match. Choose the exact one.</p>
            <div className="mt-1.5">
              <CustomSelect
                ariaLabel={`Exact product for line ${row.line}`}
                value={item.choice ?? ""}
                placeholder="Choose a product…"
                onChange={onChoose}
                options={resolution.candidates.map((candidate) => ({ value: candidate.id, label: `${candidate.sku} · ${candidate.title}` }))}
              />
            </div>
          </div>
        ) : resolution.status === "unknown" ? (
          <div>
            <p className="flex items-start gap-2 text-state-danger-ink">
              <X size={15} className="mt-1 shrink-0" aria-hidden="true" />
              <span>
                Not in the catalog: <span className="part-number">{row.sku}</span>
              </span>
            </p>
            {resolution.suggestions.length > 0 && (
              <p className="mt-1 text-meta text-ink-2">
                Suggestion, not a match:{" "}
                {resolution.suggestions.map((suggestion, index) => (
                  <React.Fragment key={suggestion.id}>
                    {index > 0 && ", "}
                    <button
                      type="button"
                      onClick={() => onEdit({ sku: suggestion.sku })}
                      className="part-number min-h-11 font-medium text-ink-1 underline underline-offset-4 sm:min-h-0"
                    >
                      use {suggestion.sku}
                    </button>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>
        ) : (
          <p className="text-state-danger-ink">This line could not be read.</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove line ${row.line}, ${row.sku || "blank part number"}`}
        className="grid size-11 place-items-center justify-self-end rounded-(--r-sm) text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
