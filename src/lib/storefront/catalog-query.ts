/**
 * The catalog query boundary.
 *
 * The browser used to receive every SKU and page through them itself. That is
 * fine at 100 records and is the next scaling bottleneck at 10,000, so paging
 * now sits behind one contract: filters and a cursor in; the page's items, the
 * total, the applied (normalized) filters, the next cursor, and any records
 * rejected as unrenderable out. The catalog page and `/api/catalog` both call
 * this, so moving the pool server-side later changes where it runs, not what
 * the UI receives.
 */

import { filterStorefrontSkus, getCatalogFacets, rankBySearch, sortStorefrontSkus, type StorefrontSku } from "./catalog";
import { normalizeCatalogFilters, toCatalogFilters, type AppliedFilters } from "./filter-codec";

export const CATALOG_PAGE_SIZE = 24;
export const CATALOG_MAX_PAGE_SIZE = 96;

export type RejectedRecord = { id: string; reason: "missing_identity" | "missing_title" };

export type CatalogPage = {
  items: StorefrontSku[];
  total: number;
  applied: AppliedFilters;
  /** Opaque. Null on the last page. */
  nextCursor: string | null;
  /** Records dropped because they cannot be rendered safely. */
  rejected: RejectedRecord[];
};

export function encodeCursor(offset: number): string {
  return `o${offset.toString(36)}`;
}

/** Tolerant: an unreadable cursor restarts at the first page rather than failing. */
export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor || !/^o[0-9a-z]{1,8}$/.test(cursor)) return 0;
  const offset = Number.parseInt(cursor.slice(1), 36);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

/** A record the grid cannot show without inventing data. */
export function validateRecord(sku: StorefrontSku): RejectedRecord | null {
  if (!sku.id || !sku.sku || !sku.slug) return { id: sku.id || "(unknown)", reason: "missing_identity" };
  if (!sku.title || !sku.title.trim()) return { id: sku.id, reason: "missing_title" };
  return null;
}

/** Split a pool into renderable records and rejected ones, once. */
export function partitionRecords(pool: StorefrontSku[]): { valid: StorefrontSku[]; rejected: RejectedRecord[] } {
  const valid: StorefrontSku[] = [];
  const rejected: RejectedRecord[] = [];
  for (const sku of pool) {
    const problem = validateRecord(sku);
    if (problem) rejected.push(problem);
    else valid.push(sku);
  }
  return { valid, rejected };
}

export function queryCatalog(
  pool: StorefrontSku[],
  filters: AppliedFilters,
  { cursor, limit = CATALOG_PAGE_SIZE }: { cursor?: string | null; limit?: number } = {}
): CatalogPage {
  const { valid, rejected } = partitionRecords(pool);
  const applied = normalizeCatalogFilters(filters, getCatalogFacets());
  const filtered = filterStorefrontSkus(toCatalogFilters(applied), valid);
  // "Most relevant" with a query means match strength; any explicit sort wins.
  const matches = applied.q && applied.sort === "relevance" ? rankBySearch(filtered, applied.q) : sortStorefrontSkus(filtered, applied.sort);
  const size = Math.min(Math.max(1, Math.floor(limit)), CATALOG_MAX_PAGE_SIZE);
  const offset = Math.min(decodeCursor(cursor), matches.length);
  const end = offset + size;
  return {
    items: matches.slice(offset, end),
    total: matches.length,
    applied,
    nextCursor: end < matches.length ? encodeCursor(end) : null,
    rejected,
  };
}
