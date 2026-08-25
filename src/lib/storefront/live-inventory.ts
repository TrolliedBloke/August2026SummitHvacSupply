import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/backend/supabase";
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
 * On-hand quantity is the one field that moves hourly, and it is now written to
 * catalog_products by the QuickBooks sync (supabase/functions/
 * quickbooks-inventory-sync). This module reads those counts and overlays them
 * onto the build-time records, so a number that changed in QuickBooks fifteen
 * minutes ago shows on the site without a deploy.
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

async function fetchLiveInventory(): Promise<LiveInventory> {
  try {
    // The anon client, deliberately. catalog_products already carries a public
    // read policy for quote_only and published rows, so the render path needs
    // no service-role key -- and a leaked build artifact cannot contain one.
    const supabase = createServerSupabaseClient();
    if (!supabase) return {};

    const { data, error } = await supabase
      .from("catalog_products")
      .select("id, inventory_quantity, inventory_status")
      .neq("inventory_status", "unknown");

    if (error || !data) return {};

    const live: LiveInventory = {};
    for (const row of data) {
      const quantity = row.inventory_quantity;
      const status = row.inventory_status;
      // A row claiming a status without a count is not a stock claim we can
      // stand behind, so it is dropped rather than shown as zero.
      if (typeof quantity !== "number" || !VALID_STATUSES.has(status)) continue;
      live[row.id] = { quantity, status: status as CatalogAvailability };
    }
    return live;
  } catch {
    return {};
  }
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
