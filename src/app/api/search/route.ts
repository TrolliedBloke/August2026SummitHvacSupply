import { NextResponse } from "next/server";
import { productHref, searchStorefrontSkus } from "@/lib/storefront/catalog";
import { recordEvent } from "@/lib/backend/events";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const results = searchStorefrontSkus(q).map((sku) => ({
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
    href: productHref(sku),
  }));

  // Zero-result queries are a list of what buyers want that we don't carry
  // (or can't match) -- free market research, logged best-effort.
  if (results.length === 0 && q.trim().length >= 3) {
    void recordEvent("search_zero_results", "/search", { q: q.trim().slice(0, 120) });
  }

  return NextResponse.json({ ok: true, results });
}
