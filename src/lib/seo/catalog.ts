import type { CatalogCategory, StorefrontSku } from "@/lib/storefront/catalog";

export type SkuSeoState = {
  indexable: boolean;
  verified: boolean;
  missing: string[];
};

/**
 * Which specifications a product type must carry before it is worth indexing.
 *
 * The previous gate applied one list to everything and demanded an AHRI
 * reference and dimensions from every record. AHRI certifies matched systems,
 * so a line set, a thermostat or a bag of hangers has no certificate to
 * produce, and requiring one guaranteed those pages could never be indexed.
 * Combined with dimensions and ahriReference being hardcoded to "" in the
 * storefront mapping, that emptied the product sitemap completely.
 */
const EQUIPMENT_CATEGORIES: ReadonlySet<CatalogCategory> = new Set<CatalogCategory>([
  "mini-splits",
  "central-heat-pumps",
  "central-air-conditioners",
  "central-systems",
  "air-handlers",
  "evaporator-coils",
  "furnaces",
  "cassettes",
]);

/** Refrigerant is a property of the refrigerant circuit. A gas furnace, an air
 *  handler shipped without a coil, and every accessory have none. */
const REFRIGERANT_CATEGORIES: ReadonlySet<CatalogCategory> = new Set<CatalogCategory>([
  "mini-splits",
  "central-heat-pumps",
  "central-air-conditioners",
  "central-systems",
  "evaporator-coils",
  "cassettes",
]);

/**
 * Search publication is deliberately stricter than storefront rendering: the
 * catalog can stay browsable while incomplete records stay out of XML sitemaps
 * and emit no Product structured data.
 */
export function getSkuSeoState(sku: StorefrontSku): SkuSeoState {
  // A disputed identity is never indexable, whatever else it has. Publishing a
  // page that claims a model number the manufacturer does not list invites a
  // contractor to order the wrong equipment.
  if (sku.researchStatus === "conflict") {
    return {
      indexable: false,
      verified: false,
      missing: [sku.conflictType ? `unresolved conflict (${sku.conflictType})` : "unresolved model conflict"],
    };
  }
  if (sku.publicationStatus === "needs_review" || sku.publicationStatus === "archived") {
    return { indexable: false, verified: false, missing: ["record not reviewed for publication"] };
  }

  const isEquipment = EQUIPMENT_CATEGORIES.has(sku.category);
  const needsRefrigerant = REFRIGERANT_CATEGORIES.has(sku.category);

  // Applies to every product type: identity, a picture, a price and a source.
  const missing = [
    !sku.sku && "part number",
    !sku.modelNumber && "model number",
    !sku.title && "product name",
    !sku.imageVerified && "manufacturer product image",
    sku.documents.length < 1 && "product document",
    // Equipment only: a contractor cannot specify a unit they cannot fit or power.
    isEquipment && !sku.dimensions && "dimensions",
    isEquipment && !sku.voltage && "voltage",
    needsRefrigerant && !sku.refrigerant && "refrigerant",
    // AHRI is required only where a certificate was actually found. A
    // `certified` status with no reference number is an incomplete record;
    // `requires_matched_combination`, `not_applicable` and `not_found` are
    // terminal states that do not block indexing.
    sku.ahri?.status === "certified" && !sku.ahriReference && "AHRI reference number",
  ].filter(Boolean) as string[];

  // A public price is NOT required to index. Much of a distributor's catalog is
  // legitimately quote-only, and requiring `msrp` here kept 77 of 100 records
  // out of the sitemap regardless of how complete their research was. Price
  // instead decides whether Product structured data carries an `offers` block
  // (see hasOffer), which is the thing that actually needs a number.
  const indexable = missing.length === 0;
  return {
    indexable,
    // "verified" additionally requires that the exact model was confirmed
    // against a manufacturer source, not merely that the fields are populated.
    verified: indexable && sku.researchStatus === "verified" && sku.imageExactModel,
    missing,
  };
}

/**
 * Whether Product structured data may carry an `offers` block. Requires a real
 * price AND the ability to actually sell it -- advertising an offer for a
 * product that routes to a quote form is a rich-result policy violation and a
 * bad customer experience.
 */
export function hasOffer(sku: StorefrontSku): boolean {
  return sku.purchaseEligible && sku.retailPrice !== null && sku.retailPrice > 0;
}

/**
 * Product structured data. Emitted only for indexable records, so a page whose
 * model number is disputed or whose research is incomplete never publishes
 * machine-readable claims about itself.
 *
 * `offers` appears only when the product can genuinely be bought at a stated
 * price. Everything else omits it rather than advertising availability the
 * warehouse has not confirmed.
 */
export function buildProductSchema(sku: StorefrontSku, origin: string): Record<string, unknown> | null {
  if (!getSkuSeoState(sku).indexable) return null;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: sku.title,
    sku: sku.sku,
    mpn: sku.modelNumber || undefined,
    brand: { "@type": "Brand", name: sku.brand },
    category: sku.categoryLabel,
    image: sku.images.length > 0 ? sku.images.map((path) => `${origin}${path}`) : undefined,
    url: `${origin}/products/sku/${sku.slug}`,
  };

  const specs: Array<{ "@type": "PropertyValue"; name: string; value: string }> = [];
  if (sku.btu) specs.push({ "@type": "PropertyValue", name: "Capacity (BTU)", value: String(sku.btu) });
  if (sku.voltage) specs.push({ "@type": "PropertyValue", name: "Voltage", value: sku.voltage });
  if (sku.refrigerant) specs.push({ "@type": "PropertyValue", name: "Refrigerant", value: sku.refrigerant });
  if (sku.dimensions) specs.push({ "@type": "PropertyValue", name: "Dimensions", value: sku.dimensions });
  if (sku.ahriReference) specs.push({ "@type": "PropertyValue", name: "AHRI reference", value: sku.ahriReference });
  if (specs.length > 0) schema.additionalProperty = specs;

  if (sku.weightLbs !== null) {
    schema.weight = { "@type": "QuantitativeValue", value: sku.weightLbs, unitCode: "LBR" };
  }

  if (hasOffer(sku)) {
    schema.offers = {
      "@type": "Offer",
      priceCurrency: "USD",
      price: sku.retailPrice,
      availability: "https://schema.org/InStock",
      url: `${origin}/products/sku/${sku.slug}`,
    };
  }

  return schema;
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
