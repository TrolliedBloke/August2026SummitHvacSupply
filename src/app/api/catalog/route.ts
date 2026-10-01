import { NextResponse } from "next/server";
import { getStorefrontSkus, productHref } from "@/lib/storefront/catalog";
import { applyLiveInventoryAll, getLiveInventoryResult } from "@/lib/storefront/live-inventory";
import { parseCatalogFilters } from "@/lib/storefront/filter-codec";
import { CATALOG_PAGE_SIZE, queryCatalog } from "@/lib/storefront/catalog-query";
import { presentCommerceState, publicCommerceState } from "@/lib/commerce/state";

/**
 * The catalog query contract over HTTP: the same filters the page URL carries,
 * plus `cursor` and `limit`. Returns one page of items, the total, the applied
 * (normalized) filters, the next cursor, the count of rejected records, and
 * whether stock counts are live -- everything the grid needs once paging moves
 * off the client.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? CATALOG_PAGE_SIZE);
  const live = await getLiveInventoryResult();
  const page = queryCatalog(applyLiveInventoryAll(getStorefrontSkus(), live.inventory), parseCatalogFilters(searchParams), {
    cursor: searchParams.get("cursor"),
    limit: Number.isFinite(limit) ? limit : CATALOG_PAGE_SIZE,
  });
  return NextResponse.json({
    ok: true,
    total: page.total,
    applied: page.applied,
    nextCursor: page.nextCursor,
    rejected: page.rejected.length,
    inventory: live.status,
    items: page.items.map((sku) => {
      const view = presentCommerceState(publicCommerceState(sku));
      return {
        id: sku.id,
        sku: sku.sku,
        title: sku.title,
        brand: sku.brand,
        href: productHref(sku),
        image: sku.imageVerified ? sku.image : null,
        price: view.priceText,
        priceQualifier: view.priceQualifier,
        status: view.statusLabel,
        action: view.action.label,
      };
    }),
  });
}
