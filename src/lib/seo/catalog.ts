import { getSeries } from "@/lib/products";
import type { StorefrontSku } from "@/lib/storefront/catalog";

export type SkuSeoState = {
  indexable: boolean;
  verified: boolean;
  missing: string[];
};

/**
 * Search publication is deliberately stricter than storefront rendering. The
 * presentation catalog can remain usable while incomplete records stay out of
 * XML sitemaps and do not emit Product structured data.
 */
export function getSkuSeoState(sku: StorefrontSku): SkuSeoState {
  const series = getSeries(sku.seriesSlug);
  const missing = [
    !sku.sku && "part number",
    !sku.modelNumber && "model number",
    !sku.title && "product name",
    !sku.image && "product image",
    !sku.msrp && "public price",
    !sku.dimensions && "dimensions",
    !sku.voltage && "voltage",
    !sku.refrigerant && "refrigerant",
    !sku.ahriReference && "AHRI reference",
    sku.documents.length < 1 && "product document",
  ].filter(Boolean) as string[];

  const unverifiedSpecs = series?.confirm ?? [];
  return {
    indexable: missing.length === 0 && unverifiedSpecs.length === 0,
    verified: missing.length === 0 && unverifiedSpecs.length === 0,
    missing: [...missing, ...unverifiedSpecs.map((key) => `unverified ${key}`)],
  };
}
export function getSkuAlternatives(sku: StorefrontSku, all: StorefrontSku[], limit = 3) {
  return all
    .filter((candidate) => candidate.id !== sku.id && candidate.category === sku.category)
    .sort((a, b) => {
      const stock = Number(b.available > 0) - Number(a.available > 0);
      return stock || Math.abs(a.btu - sku.btu) - Math.abs(b.btu - sku.btu);
    })
    .slice(0, limit);
}
