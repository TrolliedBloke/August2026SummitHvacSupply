/**
 * Pure matching logic for the QuickBooks inventory sync.
 *
 * Deliberately dependency-free and kept in its own file so the same code runs
 * in Deno (imported by ./index.ts) and under the Node test runner
 * (tests/inventory.test.ts imports it by relative path). Matching is the part
 * of this integration most likely to be quietly wrong -- a bad match publishes
 * a stock number against the wrong product -- so it is the part that must be
 * testable without a QuickBooks account.
 *
 * Nothing here performs I/O or reads the environment. Everything it decides is
 * a function of the two inputs.
 */

export type QboItem = {
  Id: string;
  Name?: string;
  Sku?: string;
  Type?: string;
  Active?: boolean;
  TrackQtyOnHand?: boolean;
  QtyOnHand?: number;
  UnitPrice?: number;
};

export type CatalogRow = {
  id: string;
  catalog_sku: string;
  source_sku: string | null;
  /** Carried only so the reconciliation lists are readable by a human. */
  name?: string | null;
};

/** A SKU plus enough context to find the thing it refers to. */
export type NamedSku = { sku: string; name: string };

/** Only the two fields the sync is permitted to move. */
export type InventoryUpdate = {
  id: string;
  qty: number;
  status: "in_stock" | "out_of_stock";
};

export type MatchReport = {
  updates: InventoryUpdate[];
  matched: number;
  /** Matched, but QuickBooks does not track a quantity. Left unknown. */
  untracked: NamedSku[];
  /** Catalog rows QuickBooks said nothing about. Left at their current value. */
  unmatchedCatalog: NamedSku[];
  /** QuickBooks items with no catalog row. */
  unmatchedQbo: NamedSku[];
  /**
   * One QuickBooks SKU resolving to several catalog rows. None are updated.
   * `catalogSkus` accompanies the ids because an id like "inventory-row-33"
   * tells the person who has to fix it nothing at all.
   */
  ambiguous: Array<{ sku: string; catalogIds: string[]; catalogSkus: string[] }>;
  /** QuickBooks items with no SKU set, which can never be matched. */
  skuless: NamedSku[];
};

/** Case- and punctuation-insensitive, matching the manual script's `key()`. */
export function normalizeSku(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function index(rows: CatalogRow[], pick: (row: CatalogRow) => string | null): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const key = normalizeSku(pick(row));
    if (!key) continue;
    const existing = map.get(key);
    if (existing) existing.push(row.id);
    else map.set(key, [row.id]);
  }
  return map;
}

/**
 * Resolve QuickBooks items against catalog rows.
 *
 * `catalog_sku` is tried before `source_sku` because the importer splits some
 * source rows into several variants (one sheet row for TCL-27K-MZ-ODU became
 * both an R-410A and an R-454B record). Those variants share a source_sku, so
 * a QuickBooks item still carrying the old shared identifier resolves to two
 * products at once -- and there is no honest way to divide one shelf count
 * between two refrigerants. Such an item updates nothing and is reported
 * instead, so somebody can split it in QuickBooks.
 */
export function matchInventory(items: QboItem[], rows: CatalogRow[]): MatchReport {
  const byCatalogSku = index(rows, (row) => row.catalog_sku);
  const bySourceSku = index(rows, (row) => row.source_sku);

  const byId = new Map(rows.map((row) => [row.id, row]));
  const label = (item: QboItem) => (item.Name ?? "").trim().slice(0, 120);

  const updates: InventoryUpdate[] = [];
  const untracked: NamedSku[] = [];
  const unmatchedQbo: NamedSku[] = [];
  const skuless: NamedSku[] = [];
  const ambiguous: MatchReport["ambiguous"] = [];
  const seen = new Set<string>();
  let matched = 0;

  for (const item of items) {
    const key = normalizeSku(item.Sku);
    if (!key) {
      skuless.push({ sku: "", name: label(item) });
      continue;
    }

    const candidates = byCatalogSku.get(key) ?? bySourceSku.get(key) ?? [];
    if (candidates.length === 0) {
      unmatchedQbo.push({ sku: key, name: label(item) });
      continue;
    }
    if (candidates.length > 1) {
      ambiguous.push({
        sku: key,
        catalogIds: [...candidates],
        catalogSkus: candidates.map((id) => byId.get(id)?.catalog_sku ?? id),
      });
      continue;
    }

    const [id] = candidates;
    matched += 1;
    seen.add(id);

    // An item QuickBooks does not track is not a zero -- it is an unknown.
    // Writing 0 here would publish it as out of stock.
    if (item.TrackQtyOnHand === false || typeof item.QtyOnHand !== "number" || !Number.isFinite(item.QtyOnHand)) {
      untracked.push({ sku: key, name: label(item) });
      continue;
    }

    // Oversold items go negative in QuickBooks. Clamp to zero: the column is a
    // non-negative integer, and "we owe more than we hold" displays as out of
    // stock, which is the truthful thing to tell a buyer.
    const qty = Math.max(0, Math.trunc(item.QtyOnHand));
    updates.push({ id, qty, status: qty > 0 ? "in_stock" : "out_of_stock" });
  }

  return {
    updates,
    matched,
    untracked,
    unmatchedCatalog: rows
      .filter((row) => !seen.has(row.id))
      .map((row) => ({ sku: row.catalog_sku, name: (row.name ?? "").trim().slice(0, 120) })),
    unmatchedQbo,
    ambiguous,
    skuless,
  };
}
