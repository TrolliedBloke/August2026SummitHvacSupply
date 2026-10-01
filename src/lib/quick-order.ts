/**
 * Quick-order rows: parsing, validation and merging, with no catalog or cart
 * access. Pasted text and CSV files both produce these rows, so identical
 * logical input yields identical rows and errors whichever way it arrived.
 *
 * The format is documented to the user: one part per line, "SKU, quantity",
 * with a comma or a tab between them. Nothing is coerced. A missing, zero,
 * negative, decimal or non-numeric quantity is a row error the user corrects,
 * not a silent 1; input past the row limit is reported, not sliced away.
 */

import { normalizeIdentifier } from "./model-identifier";

export const QUICK_ORDER_ROW_LIMIT = 100;
export const QUICK_ORDER_MAX_QUANTITY = 200;

export type RowErrorCode =
  | "missing_sku"
  | "missing_quantity"
  | "invalid_quantity"
  | "decimal_quantity"
  | "zero_quantity"
  | "negative_quantity"
  | "oversized_quantity";

export const ROW_ERROR_COPY: Record<RowErrorCode, string> = {
  missing_sku: "Add a part number.",
  missing_quantity: "Add a quantity after a comma, for example “TCL24KAHU, 2”.",
  invalid_quantity: "Quantity must be a whole number.",
  decimal_quantity: "Quantity must be a whole number, not a decimal.",
  zero_quantity: "Quantity must be at least 1.",
  negative_quantity: "Quantity cannot be negative.",
  oversized_quantity: `Quantity can be at most ${QUICK_ORDER_MAX_QUANTITY} per line. Call the counter for larger orders.`,
};

export type QuickOrderRow = {
  /** 1-based source line (or CSV data row) number. */
  line: number;
  original: string;
  /** The part number as typed, trimmed. */
  sku: string;
  normalized: string;
  rawQuantity: string;
  quantity: number | null;
  errors: RowErrorCode[];
};

export type ParseResult = {
  rows: QuickOrderRow[];
  /** Rows past the limit, reported instead of dropped silently. */
  overLimit: number;
};

export function parseQuantity(raw: string): { quantity: number | null; error: RowErrorCode | null } {
  const value = raw.trim();
  if (!value) return { quantity: null, error: "missing_quantity" };
  if (/^-\s*\d/.test(value)) return { quantity: null, error: "negative_quantity" };
  if (/^\d+[.,]\d+$/.test(value)) return { quantity: null, error: "decimal_quantity" };
  if (!/^\d+$/.test(value)) return { quantity: null, error: "invalid_quantity" };
  const quantity = Number(value);
  if (quantity === 0) return { quantity: null, error: "zero_quantity" };
  if (quantity > QUICK_ORDER_MAX_QUANTITY) return { quantity: null, error: "oversized_quantity" };
  return { quantity, error: null };
}

/** Build one validated row from its two cells. Shared by paste and CSV. */
export function buildRow(line: number, original: string, skuCell: string, quantityCell: string): QuickOrderRow {
  const sku = skuCell.trim();
  const errors: RowErrorCode[] = [];
  if (!normalizeIdentifier(sku)) errors.push("missing_sku");
  const { quantity, error } = parseQuantity(quantityCell);
  if (error) errors.push(error);
  return { line, original, sku, normalized: normalizeIdentifier(sku), rawQuantity: quantityCell.trim(), quantity, errors };
}

/** Pasted text -> rows. Blank lines are skipped; everything else is kept, valid or not. */
export function parseQuickOrderText(text: string, limit = QUICK_ORDER_ROW_LIMIT): ParseResult {
  const rows: QuickOrderRow[] = [];
  let overLimit = 0;
  const lines = text.replace(/^﻿/, "").split(/\r\n|\n|\r/);
  lines.forEach((rawLine, index) => {
    const original = rawLine.trim();
    if (!original) return;
    if (rows.length >= limit) {
      overLimit += 1;
      return;
    }
    const delimiter = original.includes("\t") ? "\t" : ",";
    const cut = original.indexOf(delimiter);
    const skuCell = cut === -1 ? original : original.slice(0, cut);
    const quantityCell = cut === -1 ? "" : original.slice(cut + 1);
    rows.push(buildRow(index + 1, original, skuCell, quantityCell));
  });
  return { rows, overLimit };
}

export function isRowValid(row: QuickOrderRow): row is QuickOrderRow & { quantity: number } {
  return row.errors.length === 0 && row.quantity !== null;
}

/**
 * Merge valid rows for the same part number, adding quantities arithmetically
 * and capping at the per-line maximum. Only runs after validation, so an
 * invalid row is never folded into a valid one.
 */
export function mergeDuplicateRows(rows: QuickOrderRow[]): Array<QuickOrderRow & { mergedLines: number[] }> {
  const merged = new Map<string, QuickOrderRow & { mergedLines: number[] }>();
  const out: Array<QuickOrderRow & { mergedLines: number[] }> = [];
  for (const row of rows) {
    if (!isRowValid(row)) {
      out.push({ ...row, mergedLines: [row.line] });
      continue;
    }
    const existing = merged.get(row.normalized);
    if (existing) {
      const total = (existing.quantity ?? 0) + row.quantity;
      existing.quantity = Math.min(QUICK_ORDER_MAX_QUANTITY, total);
      existing.rawQuantity = String(existing.quantity);
      existing.mergedLines.push(row.line);
      if (total > QUICK_ORDER_MAX_QUANTITY) existing.errors = ["oversized_quantity"];
      continue;
    }
    const copy = { ...row, mergedLines: [row.line] };
    merged.set(row.normalized, copy);
    out.push(copy);
  }
  return out;
}
