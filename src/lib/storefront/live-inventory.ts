import { unstable_cache } from "next/cache";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/backend/supabase";
import {
  stockStatusFor,
  type CatalogAvailability,
  type StorefrontSku,
} from "./catalog";

/**
 * Live stock overlay.
 *
 * The catalog itself is generated at build time from the inventory sheet and
 * baked into src/data/catalog.generated.json -- identity, specifications,
 * research provenance, price. None of that changes between deploys and none of
 * it belongs in a request-time query.
 *
 * On-hand quantity is the one field that moves between deploys. It lands in
 * catalog_products (today from `npm run catalog:sync`, which writes what the
 * CSV import generated), and this module reads those counts and overlays them
 * onto the build-time records -- so a corrected count shows on the site without
 * a rebuild.
 *
 * This is deliberately the seam an inventory source plugs into. Nothing here
 * knows or cares where a count came from; it reads two columns. The QuickBooks
 * sync that first wrote them was retired in migration 026, and the next system
 * writes the same two columns without touching this file.
 *
 * TWO PROPERTIES THIS MODULE MUST KEEP.
 *
 * 1. It never makes anything purchasable. The overlay writes availability
 *    fields only. `purchaseEligible`, `retailPrice` and `publicationStatus` are
 *    copied through untouched, so the catalog stays quote-only no matter what
 *    the warehouse reports. `hasOffer()` in lib/seo/catalog.ts gates on
 *    `purchaseEligible`, which means live stock also cannot cause a Product
 *    `offers` block to be published.
 *
 * 2. It fails to "unknown", never to an error. A database that is unreachable,
 *    unconfigured, or slow degrades the site to exactly the behaviour it had
 *    before this feature existed -- no stock claim -- rather than breaking a
 *    product page. This is also what keeps the Playwright suite deterministic:
 *    the e2e web server runs without Supabase credentials, so it sees the same
 *    unknown state the assertions were written against.
 */

export type LiveStock = {
  quantity: number;
  status: CatalogAvailability;
};

export type LiveInventory = Record<string, LiveStock>;

/** Cache tag, so a completed sync can invalidate this without waiting out the TTL. */
export const INVENTORY_TAG = "inventory";

const VALID_STATUSES: ReadonlySet<string> = new Set<CatalogAvailability>([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "lead_time",
]);

export type LiveInventoryResult = {
  inventory: LiveInventory;
  /**
   * `unconfigured` is the normal state without Supabase (local dev, e2e) and is
   * not shown to customers. `error` and `timeout` mean counts exist but could
   * not be read, which the catalog reports as a partial result.
   */
  status: "ok" | "unconfigured" | "error" | "timeout";
};

const LIVE_INVENTORY_TIMEOUT_MS = 2500;

type InventoryRow = { id: string; inventory_quantity: number | null; inventory_status: string };

type InventoryRead =
  | { kind: "ok"; rows: InventoryRow[] }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

async function readInventory(client: ReturnType<typeof createServerSupabaseClient>): Promise<InventoryRead> {
  if (!client) return { kind: "error", message: "client unavailable" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_INVENTORY_TIMEOUT_MS);
  try {
    const { data, error } = await client
      .from("catalog_products")
      .select("id, inventory_quantity, inventory_status")
      .neq("inventory_status", "unknown")
      .in("publication_status", ["quote_only", "published"])
      .abortSignal(controller.signal);
    if (error || !data) return { kind: "error", message: error?.message ?? "empty response" };
    return { kind: "ok", rows: data };
  } catch (error) {
    return controller.signal.aborted
      ? { kind: "timeout" }
      : { kind: "error", message: error instanceof Error ? error.message : "unknown error" };
  } finally {
    clearTimeout(timer);
  }
}

function inventoryFromRows(rows: InventoryRow[]): LiveInventory {
  const live: LiveInventory = {};
  for (const row of rows) {
    const quantity = row.inventory_quantity;
    const status = row.inventory_status;
    if (typeof quantity !== "number" || !VALID_STATUSES.has(status)) continue;
    live[row.id] = { quantity, status: status as CatalogAvailability };
  }
  return live;
}

async function fetchLiveInventoryResult(): Promise<LiveInventoryResult> {
  try {
    // The anon client, deliberately. catalog_products already carries a public
    // read policy for quote_only and published rows, so the render path needs
    // no service-role key -- and a leaked build artifact cannot contain one.
    const publicClient = createServerSupabaseClient();
    if (!publicClient) return { inventory: {}, status: "unconfigured" };

    const publicRead = await readInventory(publicClient);
    if (publicRead.kind === "ok") return { inventory: inventoryFromRows(publicRead.rows), status: "ok" };

    // Public catalog reads are the normal path. A server-only retry keeps a
    // temporary anon grant/schema issue from turning the entire catalog yellow,
    // without exposing unpublished rows or any service credential to the page.
    const serviceClient = createServiceRoleSupabaseClient();
    const serviceRead = serviceClient ? await readInventory(serviceClient) : null;
    if (serviceRead?.kind === "ok") return { inventory: inventoryFromRows(serviceRead.rows), status: "ok" };

    console.error("[live-inventory] catalog_products read failed", {
      public: publicRead.kind === "error" ? publicRead.message : publicRead.kind,
      service: serviceRead ? serviceRead.kind === "error" ? serviceRead.message : serviceRead.kind : "unconfigured",
    });
    return { inventory: {}, status: publicRead.kind === "timeout" || serviceRead?.kind === "timeout" ? "timeout" : "error" };
  } catch {
    console.error("[live-inventory] unexpected catalog_products read failure");
    return { inventory: {}, status: "error" };
  }
}

async function fetchLiveInventory(): Promise<LiveInventory> {
  return (await fetchLiveInventoryResult()).inventory;
}

/**
 * Request-time inventory map, cached for 60 seconds and shared across every
 * surface that renders in that window. The sync runs every 15 minutes, so this
 * TTL is what decides how quickly a change reaches the page once it has landed
 * in the database; the revalidate route drops it sooner.
 */
export const getLiveInventory = unstable_cache(fetchLiveInventory, ["live-inventory"], {
  tags: [INVENTORY_TAG],
  revalidate: 60,
});

/** The same read, with its outcome, for surfaces that report partial data. */
export const getLiveInventoryResult = unstable_cache(fetchLiveInventoryResult, ["live-inventory-result"], {
  tags: [INVENTORY_TAG],
  revalidate: 60,
});

/**
 * Overlay live stock onto one record.
 *
 * Returns the record unchanged when the warehouse has said nothing about it --
 * an absent entry means "not counted", which is not the same as zero and must
 * not be rendered as out of stock.
 */
export function applyLiveInventory(sku: StorefrontSku, live: LiveInventory): StorefrontSku {
  const stock = live[sku.id];
  if (!stock) return sku;

  return {
    ...sku,
    available: stock.quantity,
    availabilityStatus: stock.status,
    availabilityVerified: true,
    stockStatus: stockStatusFor(stock.status),
    // purchaseEligible, retailPrice and publicationStatus are intentionally not
    // listed. Knowing a quantity is not a decision to sell it self-service.
  };
}

export function applyLiveInventoryAll(skus: StorefrontSku[], live: LiveInventory): StorefrontSku[] {
  if (Object.keys(live).length === 0) return skus;
  return skus.map((sku) => applyLiveInventory(sku, live));
}
