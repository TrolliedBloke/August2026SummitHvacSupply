/**
 * A deliberately constrained CSV reader for quick-order files.
 *
 * Supports exactly what the published template promises: UTF-8 (with or
 * without a byte-order mark), CRLF or LF line endings, comma or tab
 * delimiters, quoted fields with embedded delimiters and newlines, and escaped
 * quotes (""). Anything else -- UTF-16, an unterminated quote, missing or
 * duplicate headers -- is rejected with a specific message rather than parsed
 * into shape. The output is the same row model as pasted quick order.
 */

import { buildRow, QUICK_ORDER_ROW_LIMIT, type ParseResult } from "./quick-order";

export const CSV_MAX_BYTES = 2_000_000;

export type CsvError =
  | { code: "too_large"; message: string }
  | { code: "encoding"; message: string }
  | { code: "malformed_quote"; message: string; line: number }
  | { code: "missing_header"; message: string }
  | { code: "duplicate_header"; message: string }
  | { code: "empty"; message: string };

export type CsvResult = (ParseResult & { ok: true; delimiter: "," | "\t"; ignoredColumns: string[] }) | { ok: false; error: CsvError };

const SKU_HEADERS = new Set(["sku", "part", "part number", "partnumber", "part_number", "model", "model number"]);
const QUANTITY_HEADERS = new Set(["quantity", "qty"]);

/** Split CSV text into records of cells. Throws on an unterminated quote. */
export function tokenizeCsv(text: string, delimiter: "," | "\t"): Array<{ line: number; cells: string[] }> {
  const records: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let quoteStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      if (cell.trim() !== "") throw Object.assign(new Error("quote"), { line });
      cell = "";
      quoted = true;
      quoteStart = line;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      cells.push(cell);
      records.push({ line: recordLine, cells });
      cells = [];
      cell = "";
      line += 1;
      recordLine = line;
    } else {
      cell += char;
    }
  }
  if (quoted) throw Object.assign(new Error("quote"), { line: quoteStart });
  if (cell !== "" || cells.length > 0) {
    cells.push(cell);
    records.push({ line: recordLine, cells });
  }
  return records;
}

export function parseQuickOrderCsv(text: string, byteLength = text.length, limit = QUICK_ORDER_ROW_LIMIT): CsvResult {
  if (byteLength > CSV_MAX_BYTES) {
    return { ok: false, error: { code: "too_large", message: "That file is larger than 2 MB. Upload a part list, not a catalog export." } };
  }
  if (text.includes("\u0000") || text.includes("�")) {
    return { ok: false, error: { code: "encoding", message: "That file is not UTF-8 text. Save it as “CSV UTF-8” and upload it again." } };
  }
  const body = text.replace(/^﻿/, "");
  if (!body.trim()) return { ok: false, error: { code: "empty", message: "That file is empty." } };

  const firstLine = body.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const delimiter: "," | "\t" = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";

  let records: Array<{ line: number; cells: string[] }>;
  try {
    records = tokenizeCsv(body, delimiter);
  } catch (error) {
    const line = (error as { line?: number }).line ?? 1;
    return { ok: false, error: { code: "malformed_quote", line, message: `Line ${line} has a quote that is never closed. Check that cell and upload again.` } };
  }

  const header = records[0]?.cells.map((cell) => cell.trim().toLowerCase()) ?? [];
  const skuColumns = header.flatMap((name, index) => (SKU_HEADERS.has(name) ? [index] : []));
  const quantityColumns = header.flatMap((name, index) => (QUANTITY_HEADERS.has(name) ? [index] : []));
  if (skuColumns.length > 1 || quantityColumns.length > 1) {
    return { ok: false, error: { code: "duplicate_header", message: "The header names more than one part-number or quantity column. Keep one “sku” and one “quantity” column." } };
  }
  if (skuColumns.length === 0 || quantityColumns.length === 0) {
    return { ok: false, error: { code: "missing_header", message: "The first row must name a “sku” column and a “quantity” column. Download the template to start from the right format." } };
  }
  const [skuColumn] = skuColumns;
  const [quantityColumn] = quantityColumns;
  const ignoredColumns = header.filter((name, index) => index !== skuColumn && index !== quantityColumn && name);

  const rows = [];
  let overLimit = 0;
  for (const record of records.slice(1)) {
    if (record.cells.every((cell) => !cell.trim())) continue;
    if (rows.length >= limit) {
      overLimit += 1;
      continue;
    }
    const skuCell = record.cells[skuColumn] ?? "";
    const quantityCell = record.cells[quantityColumn] ?? "";
    rows.push(buildRow(record.line, record.cells.join(delimiter === "," ? ", " : "\t"), skuCell, quantityCell));
  }
  return { ok: true, rows, overLimit, delimiter, ignoredColumns };
}
