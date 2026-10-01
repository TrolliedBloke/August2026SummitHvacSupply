import { NextResponse } from "next/server";
import { catalogCategoryDestinations, productHref, searchStorefrontSkus } from "@/lib/storefront/catalog";
import { applyLiveInventory, getLiveInventory } from "@/lib/storefront/live-inventory";
import { matchIdentifier } from "@/lib/model-identifier";
import { recordEvent } from "@/lib/backend/events";

/**
 * Header typeahead. Results carry a taxonomy so the listbox can group and
 * label them: an exact SKU or model match, a category, or a product that
 * matched by name or specification. Exact identifier matches always sort
 * first, so a pasted model number lands on its product.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 120);
  const normalized = q.trim().toLowerCase();

  const categories = normalized.length >= 3
    ? catalogCategoryDestinations()
        .filter((category) => category.status === "available")
        .filter((category) => {
          const label = category.label.toLowerCase();
          return label.includes(normalized) || normalized.includes(label.replace(/s$/, ""));
        })
        .slice(0, 2)
        .map((category) => ({
          kind: "category" as const,
          id: `category-${category.value}`,
          title: category.label,
          detail: `${category.productCount} ${category.productCount === 1 ? "product" : "products"}`,
          href: category.href,
        }))
    : [];

  // Search results carry availability, so they get the same live counts the
  // catalog page shows. A result that says "in stock" in one place and nothing
  // in the other reads as a bug.
  const live = await getLiveInventory();
  const products = searchStorefrontSkus(q)
    .map((match) => applyLiveInventory(match, live))
    .map((sku) => {
      const skuMatch = matchIdentifier(q, sku.sku);
      const modelMatch = sku.modelNumber ? matchIdentifier(q, sku.modelNumber) : null;
      const best = [skuMatch, modelMatch].filter(Boolean).sort((a, b) => b!.score - a!.score)[0] ?? null;
      const exact =
        skuMatch && (skuMatch.matchType === "exact" || skuMatch.matchType === "normalized")
          ? "sku"
          : modelMatch && (modelMatch.matchType === "exact" || modelMatch.matchType === "normalized")
            ? "model"
            : null;
      return {
        kind: "product" as const,
        match: exact ? (`exact_${exact}` as const) : ("related" as const),
        /** Identifier confidence (0-100) for callers that need a threshold, e.g. 404 recovery. */
        identifierScore: best?.score ?? 0,
        id: sku.id,
        sku: sku.sku,
        modelNumber: sku.modelNumber,
        title: sku.title,
        btu: sku.btu,
        voltage: sku.voltage,
        unitType: sku.unitType,
        available: sku.available,
        availabilityStatus: sku.availabilityStatus,
        purchaseEligible: sku.purchaseEligible,
        priced: sku.retailPrice !== null,
        href: productHref(sku),
      };
    })
    .sort((a, b) => Number(b.match !== "related") - Number(a.match !== "related"));

  // Zero-result queries are a list of what buyers want that we don't carry
  // (or can't match) -- free market research, logged best-effort.
  if (products.length === 0 && categories.length === 0 && normalized.length >= 3) {
    void recordEvent("search_zero_results", "/search", { q: q.trim().slice(0, 120) });
  }

  return NextResponse.json({ ok: true, categories, results: products });
}
