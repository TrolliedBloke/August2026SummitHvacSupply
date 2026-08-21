import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Pull inventory counts and prices from QuickBooks Online into the catalog
 * source sheet.
 *
 * QuickBooks is the system of record for what Summit physically owns. This
 * script copies two fields per item -- QtyOnHand and UnitPrice -- into the
 * `Current Stock` and `Sell Price` columns of inventory-source.csv, which
 * `npm run catalog:import` then turns into the published catalog. Nothing else
 * in the sheet is touched: research, images, categories and costs all stay
 * exactly as they are.
 *
 * Run:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/sync-quickbooks-inventory.ts          # dry run, writes nothing
 *   npx tsx scripts/sync-quickbooks-inventory.ts --write  # applies changes
 *
 * Dry run is the default on purpose. This rewrites the one hand-maintained
 * file in the repository, and a bad SKU match would silently publish wrong
 * stock -- which, given `unknown inventory is never purchasable`, is the exact
 * failure mode the catalog rules exist to prevent.
 *
 * Required environment:
 *   QBO_CLIENT_ID       from the Intuit Developer app
 *   QBO_CLIENT_SECRET   from the Intuit Developer app
 *   QBO_REFRESH_TOKEN   from the OAuth 2.0 Playground or your auth callback
 *   QBO_REALM_ID        the company id ("Company ID" in QuickBooks settings)
 *   QBO_ENVIRONMENT     "production" (default) or "sandbox"
 */

type QboItem = {
  Id: string;
  Name?: string;
  Sku?: string;
  Type?: string;
  Active?: boolean;
  TrackQtyOnHand?: boolean;
  QtyOnHand?: number;
  UnitPrice?: number;
};

const SOURCE = "data/catalog/inventory-source.csv";
const STOCK_COLUMN = "Current Stock";
const PRICE_COLUMN = "Sell Price";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Load credentials first: set -a; source .env.local; set +a`
    );
  }
  return value;
}

/**
 * Exchange the refresh token for an access token.
 *
 * Intuit ROTATES the refresh token on most exchanges and the old one stops
 * working, so the new value is surfaced loudly. A rotated token that is not
 * saved means the next run fails with an opaque 400, typically long after
 * anyone remembers running this.
 */
async function accessToken(): Promise<string> {
  const clientId = required("QBO_CLIENT_ID");
  const clientSecret = required("QBO_CLIENT_SECRET");
  const refreshToken = required("QBO_REFRESH_TOKEN");

  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      `QuickBooks token exchange failed (${response.status}): ${body.error ?? ""} ${body.error_description ?? ""}`.trim()
    );
  }

  if (body.refresh_token && body.refresh_token !== refreshToken) {
    console.log("\n  ⚠  QuickBooks issued a NEW refresh token. The old one is now dead.");
    console.log("     Update QBO_REFRESH_TOKEN in .env.local to:");
    console.log(`     ${body.refresh_token}\n`);
  }

  return body.access_token;
}

/** Page through every inventory item. QuickBooks caps a query at 1000 rows. */
async function fetchItems(token: string): Promise<QboItem[]> {
  const realmId = required("QBO_REALM_ID");
  const host =
    (process.env.QBO_ENVIRONMENT?.trim() || "production") === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";

  const items: QboItem[] = [];
  const pageSize = 500;
  for (let start = 1; ; start += pageSize) {
    const query = `SELECT * FROM Item WHERE Type = 'Inventory' STARTPOSITION ${start} MAXRESULTS ${pageSize}`;
    const url = `${host}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`QuickBooks query failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }
    const body = (await response.json()) as { QueryResponse?: { Item?: QboItem[] } };
    const page = body.QueryResponse?.Item ?? [];
    items.push(...page);
    if (page.length < pageSize) return items;
  }
}

/** Match on SKU, case- and whitespace-insensitively. */
function key(value: string | undefined | null): string {
  return (value ?? "").trim().toUpperCase();
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

/**
 * Serialise back out, preserving the source file's line ending.
 *
 * The sheet is CRLF (it comes out of Google Sheets/Excel) while parseCsv strips
 * the \r. Writing "\n" unconditionally rewrites all 100 lines, turning a
 * two-cell update into a whole-file diff and changing a file people still edit
 * in a spreadsheet. Verified by round-tripping the real file: LF output differed
 * from the original by exactly one byte per line.
 */
function toCsv(matrix: string[][], eol: string, trailingNewline: boolean): string {
  const body = matrix
    .map((row) =>
      row
        .map((cell) => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell))
        .join(",")
    )
    .join(eol);
  return trailingNewline ? body + eol : body;
}

/** Whatever the file already uses, so a sync never reformats it. */
function detectEol(input: string): string {
  return input.includes("\r\n") ? "\r\n" : "\n";
}

async function main() {
  const write = process.argv.includes("--write");
  const root = process.cwd();
  const sourcePath = path.join(root, SOURCE);

  const raw = await readFile(sourcePath, "utf8");
  const eol = detectEol(raw);
  const matrix = parseCsv(raw);
  const header = matrix[0];
  const stockAt = header.indexOf(STOCK_COLUMN);
  const priceAt = header.indexOf(PRICE_COLUMN);
  const skuAt = header.indexOf("SKU");
  if (stockAt < 0 || priceAt < 0 || skuAt < 0) {
    throw new Error(`${SOURCE} is missing one of: SKU, ${STOCK_COLUMN}, ${PRICE_COLUMN}`);
  }

  console.log("Fetching inventory items from QuickBooks…");
  const items = await fetchItems(await accessToken());
  console.log(`  ${items.length} inventory item(s) returned\n`);

  const bySku = new Map<string, QboItem>();
  const skuless: QboItem[] = [];
  for (const item of items) {
    if (!key(item.Sku)) { skuless.push(item); continue; }
    bySku.set(key(item.Sku), item);
  }

  const changes: string[] = [];
  const untracked: string[] = [];
  const unmatchedRows: string[] = [];
  const matched = new Set<string>();

  for (let index = 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    if (!row[skuAt]?.trim()) continue;
    const sku = key(row[skuAt]);
    const item = bySku.get(sku);
    if (!item) { unmatchedRows.push(row[skuAt].trim()); continue; }
    matched.add(sku);

    // An item QuickBooks does not track is not a zero -- it is an unknown, and
    // writing 0 would publish it as out_of_stock rather than leaving it in the
    // quote-only state the catalog rules intend.
    if (item.TrackQtyOnHand === false || typeof item.QtyOnHand !== "number") {
      untracked.push(`${row[skuAt].trim()} (${item.Name ?? "unnamed"})`);
      continue;
    }

    const stock = String(item.QtyOnHand);
    if (row[stockAt] !== stock) {
      changes.push(`  ${row[skuAt].trim()}: ${STOCK_COLUMN} ${row[stockAt] || "(blank)"} -> ${stock}`);
      row[stockAt] = stock;
    }

    if (typeof item.UnitPrice === "number" && item.UnitPrice > 0) {
      const price = String(item.UnitPrice);
      if (row[priceAt] !== price) {
        changes.push(`  ${row[skuAt].trim()}: ${PRICE_COLUMN} ${row[priceAt] || "(blank)"} -> ${price}`);
        row[priceAt] = price;
      }
    }
  }

  const unmatchedItems = [...bySku.entries()].filter(([sku]) => !matched.has(sku));

  console.log(`Matched ${matched.size} of ${matrix.length - 1} catalog row(s).\n`);
  if (changes.length) {
    console.log(`Changes (${changes.length}):`);
    for (const line of changes.slice(0, 40)) console.log(line);
    if (changes.length > 40) console.log(`  … and ${changes.length - 40} more`);
    console.log();
  } else {
    console.log("No changes: catalog already matches QuickBooks.\n");
  }

  // These three lists are the whole point of the dry run. Silent non-matches
  // are how a catalog drifts away from the warehouse without anyone noticing.
  if (untracked.length) {
    console.log(`Matched but NOT quantity-tracked in QuickBooks (left unknown, stays quote-only): ${untracked.length}`);
    for (const line of untracked.slice(0, 15)) console.log(`  ${line}`);
    console.log();
  }
  if (unmatchedRows.length) {
    console.log(`Catalog SKUs with no QuickBooks item: ${unmatchedRows.length}`);
    for (const line of unmatchedRows.slice(0, 15)) console.log(`  ${line}`);
    console.log();
  }
  if (unmatchedItems.length) {
    console.log(`QuickBooks items with no catalog row: ${unmatchedItems.length}`);
    for (const [sku, item] of unmatchedItems.slice(0, 15)) console.log(`  ${sku} (${item.Name ?? "unnamed"})`);
    console.log();
  }
  if (skuless.length) {
    console.log(`QuickBooks items with no SKU set (cannot be matched): ${skuless.length}`);
    for (const item of skuless.slice(0, 15)) console.log(`  ${item.Name ?? item.Id}`);
    console.log();
  }

  if (!write) {
    console.log("Dry run. Nothing written. Re-run with --write to apply, then `npm run catalog:import`.");
    return;
  }
  if (!changes.length) {
    console.log("Nothing to write.");
    return;
  }

  await writeFile(sourcePath, toCsv(matrix, eol, raw.endsWith("\n")));
  console.log(`Wrote ${SOURCE}. Now run: npm run catalog:import`);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
