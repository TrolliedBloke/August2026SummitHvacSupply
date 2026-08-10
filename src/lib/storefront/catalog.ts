import catalogJson from "@/data/catalog.generated.json";
import type { SkuDocument } from "@/lib/backend/types";

export const CATALOG_CATEGORIES = [
  { value: "mini-splits", label: "Mini splits" },
  { value: "central-heat-pumps", label: "Central heat pumps" },
  { value: "central-air-conditioners", label: "Central air conditioners" },
  { value: "central-systems", label: "Central systems" },
  { value: "air-handlers", label: "Air handlers" },
  { value: "evaporator-coils", label: "Evaporator coils" },
  { value: "furnaces", label: "Furnaces" },
  { value: "cassettes", label: "Cassettes" },
  { value: "line-sets", label: "Line sets" },
  { value: "controls", label: "Controls" },
  { value: "installation-supplies", label: "Installation supplies" },
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number]["value"];
export type CatalogAvailability = "unknown" | "in_stock" | "low_stock" | "out_of_stock" | "lead_time";

export type CatalogWarranty = {
  parts?: string | null;
  partsWithRegistration?: string | null;
  compressor?: string | null;
  coil?: string | null;
  heatExchanger?: string | null;
  labor?: string | null;
  registrationRequired?: boolean;
  registrationWindowDays?: number | null;
  transferable?: boolean;
  conditions?: string;
  sourceUrl?: string;
  sourceType?: string;
  retrievedAt?: string;
};

export type CatalogAhri = {
  /** `requires_matched_combination` is the honest state for a condenser sold
   *  alone: its SEER2 depends on the indoor coil it is paired with. */
  status: "certified" | "requires_matched_combination" | "not_applicable" | "not_found";
  referenceNumber?: string | null;
  certifiedModel?: string | null;
  matchedIndoor?: string | null;
  matchedOutdoor?: string | null;
  note?: string;
  sourceUrl?: string;
  sourceType?: string;
  retrievedAt?: string;
};

export type CatalogDocument = {
  kind: string;
  title: string;
  url: string;
  modelCoverageVerified: boolean;
  retrievedAt?: string;
  coverageNote?: string;
};

type CatalogRecord = {
  id: string;
  sourceRow: number;
  sourceSku: string;
  catalogSku: string;
  slug: string;
  modelNumber: string | null;
  name: string;
  brand: string;
  category: CatalogCategory;
  productType: string;
  description: string | null;
  btu: number | null;
  tonnage: number | null;
  zones: string | null;
  voltage: string | null;
  refrigerant: string | null;
  refrigerantClass: "A2L" | null;
  compatibleOutdoorSku: string | null;
  bundleName: string | null;
  retailPrice: number | null;
  inventoryQuantity: number | null;
  inventoryStatus: CatalogAvailability;
  image: string | null;
  images: string[];
  imageVerification: "unverified" | "manufacturer_family" | "verified";
  documents: CatalogDocument[];
  warranty: null | CatalogWarranty;
  ahri: null | CatalogAhri;
  fieldSources: Record<string, { sourceUrl: string; sourceType: string; retrievedAt: string }>;
  specifications: Record<string, string | number>;
  researchStatus: "csv_only" | "in_progress" | "verified" | "conflict";
  conflictType: string | null;
  publicationStatus: "quote_only" | "needs_review" | "published" | "archived";
  quoteEligible: boolean;
  purchaseEligible: boolean;
  notes: string | null;
  issues: string[];
};

const catalogRecords = catalogJson as unknown as CatalogRecord[];

export type StorefrontSku = {
  id: string;
  sourceRow: number;
  sourceSku: string;
  sku: string;
  slug: string;
  modelNumber: string;
  title: string;
  brand: string;
  category: CatalogCategory;
  categoryLabel: string;
  productType: string;
  seriesSlug: string;
  seriesName: string;
  btu: number;
  tonnage: number | null;
  zones: string | null;
  voltage: string;
  unitType: string;
  refrigerant: string;
  refrigerantClass: "A2L" | null;
  retailPrice: number | null;
  msrp: number;
  /** null = no trade price on file. Never 0, which reads as a real price. */
  dealerPrice: number | null;
  image: string;
  images: string[];
  imageVerified: boolean;
  imageExactModel: boolean;
  available: number;
  availabilityStatus: CatalogAvailability;
  availabilityVerified: boolean;
  stockStatus: "unknown" | "ready" | "low" | "backorder";
  quoteEligible: boolean;
  purchaseEligible: boolean;
  bundleName: string | null;
  compatibleOutdoorSku: string | null;
  researchStatus: CatalogRecord["researchStatus"];
  conflictType: string | null;
  publicationStatus: CatalogRecord["publicationStatus"];
  issues: string[];
  dimensions: string;
  /** null = not researched. Never 0, which reads as a real weight. */
  weightLbs: number | null;
  ahriReference: string;
  warrantyCompressor: string;
  warrantyParts: string;
  certifications: string[];
  documents: CatalogDocument[];
  warranty: CatalogWarranty | null;
  ahri: CatalogAhri | null;
  specifications: Record<string, string | number>;
  fieldSources: Record<string, { sourceUrl: string; sourceType: string; retrievedAt: string }>;
  warehouse: { code: string; name: string; address: string };
};

export type CatalogFilters = {
  q?: string;
  category?: CatalogCategory | "all";
  brand?: string;
  btu?: string;
  voltage?: string;
  unitType?: string;
  refrigerant?: string;
  pricing?: "all" | "priced" | "quote";
  stock?: "all" | CatalogAvailability;
};

function categoryLabel(category: CatalogCategory): string {
  return CATALOG_CATEGORIES.find((item) => item.value === category)?.label ?? "HVAC products";
}

/**
 * Dimensions as researched, or "" when nothing was found.
 *
 * Research records these two different ways depending on the source: a single
 * `dimensionsText` string lifted from a spec sheet, or discrete height/width/
 * depth numbers. Both are read here so that a product page shows real
 * measurements when they exist instead of a blank row.
 *
 * `dimensionsText` values already carry their unit, so appending another "in"
 * produced strings like `33-1/16 in x 12-3/8 in in`. Only the numeric form gets
 * a unit added.
 */
function deriveDimensions(specs: Record<string, string | number>): string {
  const text = specs.dimensionsText;
  if (typeof text === "string" && text.trim()) return text.trim();

  const height = specs.heightIn;
  const width = specs.widthIn;
  const depth = specs.depthIn;
  if (height && width && depth) return `${height} x ${width} x ${depth} in`;
  return "";
}

/**
 * An AHRI reference is only meaningful when a certificate was actually located
 * for this model. `requires_matched_combination` means the rating depends on
 * the pairing, `not_applicable` means no certificate exists to find, and
 * `conflict` means the identity is disputed -- none of those may present a
 * reference number as though it certified this product.
 */
function deriveAhriReference(ahri: CatalogAhri | null): string {
  if (!ahri || ahri.status !== "certified") return "";
  return ahri.referenceNumber ?? "";
}

function toStorefrontSku(record: CatalogRecord): StorefrontSku {
  const price = record.retailPrice ?? 0;
  return {
    id: record.id,
    sourceRow: record.sourceRow,
    sourceSku: record.sourceSku,
    sku: record.catalogSku,
    slug: record.slug,
    modelNumber: record.modelNumber ?? "",
    title: record.name,
    brand: record.brand,
    category: record.category,
    categoryLabel: categoryLabel(record.category),
    productType: record.productType,
    seriesSlug: record.category,
    seriesName: categoryLabel(record.category),
    btu: record.btu ?? 0,
    tonnage: record.tonnage,
    zones: record.zones,
    voltage: record.voltage ?? "",
    unitType: record.productType,
    refrigerant: record.refrigerant ?? "",
    refrigerantClass: record.refrigerantClass ?? null,
    retailPrice: record.retailPrice,
    msrp: price,
    // Contractor pricing has not been supplied for the production catalog and
    // is never derived from unit cost. `null` -- not 0 -- so that "no trade
    // price on file" cannot be read as "this product is free to dealers".
    // Trade pricing lives in catalog_product_trade_pricing (migration 015) and
    // is readable only by trade roles.
    dealerPrice: null,
    image: record.image ?? "/logo-summit.svg",
    images: record.images ?? (record.image ? [record.image] : []),
    imageVerified: record.imageVerification !== "unverified" && Boolean(record.image),
    imageExactModel: record.imageVerification === "verified" && Boolean(record.image),
    available: record.inventoryQuantity ?? 0,
    availabilityStatus: record.inventoryStatus,
    availabilityVerified: record.inventoryQuantity !== null && record.inventoryStatus !== "unknown",
    stockStatus: record.inventoryStatus === "in_stock" ? "ready" : record.inventoryStatus === "low_stock" ? "low" : record.inventoryStatus === "unknown" ? "unknown" : "backorder",
    quoteEligible: record.quoteEligible,
    purchaseEligible: record.purchaseEligible,
    bundleName: record.bundleName,
    compatibleOutdoorSku: record.compatibleOutdoorSku,
    researchStatus: record.researchStatus,
    conflictType: record.conflictType ?? null,
    publicationStatus: record.publicationStatus,
    issues: record.issues,
    // Real researched values where they exist. These three were hardcoded to
    // empty/zero, which both hid genuine research from the product page and
    // made every record fail the SEO gate that requires them.
    dimensions: deriveDimensions(record.specifications ?? {}),
    weightLbs: typeof record.specifications?.weightLbs === "number" ? record.specifications.weightLbs : null,
    ahriReference: deriveAhriReference(record.ahri ?? null),
    warrantyCompressor: record.warranty?.compressor ?? "",
    warrantyParts: record.warranty?.parts ?? "",
    certifications: [],
    documents: record.documents ?? [],
    warranty: record.warranty ?? null,
    ahri: record.ahri ?? null,
    specifications: record.specifications ?? {},
    fieldSources: record.fieldSources ?? {},
    warehouse: { code: "NWK", name: "Newark Fulfillment Center", address: "Newark, CA" },
  };
}

export function getStorefrontSkus(): StorefrontSku[] {
  return catalogRecords
    .filter((record) => record.publicationStatus !== "archived")
    .map(toStorefrontSku);
}

export function getCatalogRecord(idOrSku: string): CatalogRecord | undefined {
  const normalized = normalizeCode(idOrSku);
  return catalogRecords.find((record) =>
    [record.id, record.catalogSku, record.sourceSku, record.slug, record.modelNumber]
      .filter(Boolean)
      .some((value) => normalizeCode(String(value)) === normalized)
  );
}

export function skuSlug(sku: string): string {
  const record = getCatalogRecord(sku);
  return record?.slug ?? sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getStorefrontSku(idOrSku: string): StorefrontSku | undefined {
  const record = getCatalogRecord(idOrSku);
  return record ? toStorefrontSku(record) : undefined;
}

export function getRelatedSkus(sku: StorefrontSku, limit = 4): StorefrontSku[] {
  return getStorefrontSkus()
    .filter((candidate) => candidate.id !== sku.id)
    .sort((a, b) => {
      const categoryScore = Number(b.category === sku.category) - Number(a.category === sku.category);
      if (categoryScore) return categoryScore;
      const brandScore = Number(b.brand === sku.brand) - Number(a.brand === sku.brand);
      if (brandScore) return brandScore;
      return Math.abs(a.btu - sku.btu) - Math.abs(b.btu - sku.btu);
    })
    .slice(0, limit);
}

function normalizeCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Trade vocabulary that does not appear literally in the inventory sheet.
 *
 * The sheet names an outdoor unit "TCL 3 Ton Outdoor Condenser"; a contractor
 * searches "3 ton heat pump". Matching the raw query as one contiguous string
 * meant every multi-word query -- "3 ton heat pump", "5 ton condenser",
 * "gas furnace" -- returned nothing while the products sat in the catalog.
 */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  "heat pump": ["outdoor unit", "condenser", "hpu", "central heat pumps"],
  condenser: ["outdoor unit", "odu", "hpu"],
  furnace: ["furnaces", "fur"],
  thermostat: ["control", "controls", "controller"],
  ahu: ["air handler", "air handlers"],
  "air handler": ["ahu", "air handlers"],
  ductless: ["mini splits", "mini split"],
  minisplit: ["mini splits", "mini split"],
  cassette: ["cassettes", "ceiling cassette"],
  coil: ["evaporator coil", "evaporator coils"],
  lineset: ["line set", "line sets"],
  "line set": ["line sets"],
  head: ["indoor unit", "idu"],
  "indoor unit": ["idu"],
  "outdoor unit": ["odu"],
};

/** "3 ton" / "36k" / "36000 btu" all need to reach the same records. */
function capacityTerms(sku: StorefrontSku): string[] {
  const terms: string[] = [];
  if (sku.btu) {
    terms.push(`${sku.btu}`, `${sku.btu} btu`, `${Math.round(sku.btu / 1000)}k`);
  }
  if (sku.tonnage) {
    terms.push(`${sku.tonnage} ton`, `${sku.tonnage}ton`, `${sku.tonnage} tons`);
  }
  return terms;
}

function searchHaystack(sku: StorefrontSku): string {
  const base = [
    sku.sku, sku.sourceSku, sku.modelNumber, sku.title, sku.brand,
    sku.categoryLabel, sku.productType, sku.voltage, sku.refrigerant,
    ...capacityTerms(sku),
  ].filter(Boolean).join(" ").toLowerCase();
  // Expand both directions. A record saying "Wired Controller" has to be
  // reachable from "thermostat", which appears nowhere in the sheet, so
  // matching a synonym's value has to pull in its key as well as the reverse.
  const synonyms = Object.entries(SEARCH_SYNONYMS).flatMap(([key, values]) => {
    if (base.includes(key)) return values;
    if (values.some((value) => base.includes(value))) return [key, ...values];
    return [];
  });
  return `${base} ${synonyms.join(" ")}`.trim();
}

/**
 * Match a single query word against the haystack.
 *
 * Plain substring matching is wrong for short tokens: the "3" in "3 ton heat
 * pump" matched the trailing "003" of model 26SCA548W003, so every tonnage
 * ranked identically. Numeric tokens therefore need both boundaries, while
 * word tokens anchor only at the start so "ton" still reaches "tonnage".
 */
function hasToken(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = /\d/.test(token) ? `(?<![\\w])${escaped}(?![\\w])` : `(?<![\\w])${escaped}`;
  return new RegExp(pattern).test(haystack);
}

/**
 * Score a query against one record. Exact part-number hits always outrank
 * prose matches so a contractor pasting a model number lands on it directly.
 */
function scoreSku(sku: StorefrontSku, q: string, qCode: string): number {
  const codes = [sku.sku, sku.sourceSku, sku.modelNumber].map(normalizeCode);
  if (codes.includes(qCode)) return 6;
  if (codes.some((code) => code.startsWith(qCode))) return 5;
  const haystack = searchHaystack(sku);
  if (haystack.includes(q)) return 4;
  // Every word must land somewhere, so "3 ton heat pump" cannot match a random
  // 3-ton accessory that happens to contain "3".
  // Keep single-digit tokens: dropping the "3" from "3 ton heat pump" made
  // every tonnage match equally, so 4- and 5-ton units ranked alongside 3-ton.
  const tokens = q.split(/\s+/).filter((token) => token.length > 1 || /\d/.test(token));
  if (tokens.length > 1 && tokens.every((token) => hasToken(haystack, token))) return 3;
  // Partial recall, ranked below a full match. The sheet has no fuel-type
  // column, so "gas furnace" cannot match every token -- but returning nothing
  // for it is worse than returning the furnaces and letting the buyer judge.
  // This widens what search finds; it never asserts a spec the sheet lacks.
  if (tokens.length > 1) {
    const matched = tokens.filter((token) => token.length >= 4 && hasToken(haystack, token));
    if (matched.length && matched.length * 2 >= tokens.length) return 2;
  }
  if (qCode.length >= 6 && codes.some((code) => withinOneEdit(code, qCode))) return 1;
  return 0;
}

export function searchStorefrontSkus(query: string, limit = 12): StorefrontSku[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const qCode = normalizeCode(q);
  return getStorefrontSkus()
    .map((sku) => ({ sku, score: scoreSku(sku, q, qCode) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.sku.title.localeCompare(b.sku.title))
    .slice(0, limit)
    .map((item) => item.sku);
}

export function filterStorefrontSkus(filters: CatalogFilters): StorefrontSku[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  const qCode = q ? normalizeCode(q) : "";
  return getStorefrontSkus().filter((sku) => {
    // Same matcher as the search endpoint, so the catalog's own search box and
    // the header search agree on what "3 ton heat pump" means.
    if (q && scoreSku(sku, q, qCode) === 0) return false;
    if (filters.category && filters.category !== "all" && sku.category !== filters.category) return false;
    if (filters.brand && filters.brand !== "all" && sku.brand !== filters.brand) return false;
    if (filters.voltage && filters.voltage !== "all" && sku.voltage !== filters.voltage) return false;
    if (filters.unitType && filters.unitType !== "all" && sku.unitType !== filters.unitType) return false;
    if (filters.refrigerant && filters.refrigerant !== "all" && sku.refrigerant !== filters.refrigerant) return false;
    if (filters.stock && filters.stock !== "all" && sku.availabilityStatus !== filters.stock) return false;
    if (filters.pricing === "priced" && sku.retailPrice === null) return false;
    if (filters.pricing === "quote" && sku.retailPrice !== null) return false;
    if (filters.btu) {
      if (!sku.btu) return false;
      if (filters.btu === "small" && sku.btu > 12000) return false;
      if (filters.btu === "mid" && (sku.btu < 18000 || sku.btu > 36000)) return false;
      if (filters.btu === "large" && sku.btu < 36000) return false;
    }
    return true;
  });
}

export type SortKey = "relevance" | "price-asc" | "price-desc" | "btu-asc" | "btu-desc" | "availability";
export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "relevance", label: "Most relevant" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "btu-asc", label: "Capacity: low to high" },
  { value: "btu-desc", label: "Capacity: high to low" },
  { value: "availability", label: "Verified availability first" },
];

export function sortStorefrontSkus(skus: StorefrontSku[], sort: SortKey = "relevance"): StorefrontSku[] {
  const copy = [...skus];
  const price = (sku: StorefrontSku) => sku.retailPrice ?? Number.POSITIVE_INFINITY;
  switch (sort) {
    case "price-asc": return copy.sort((a, b) => price(a) - price(b));
    case "price-desc": return copy.sort((a, b) => (b.retailPrice ?? -1) - (a.retailPrice ?? -1));
    case "btu-asc": return copy.sort((a, b) => (a.btu || Number.POSITIVE_INFINITY) - (b.btu || Number.POSITIVE_INFINITY));
    case "btu-desc": return copy.sort((a, b) => b.btu - a.btu);
    case "availability": return copy.sort((a, b) => Number(b.availabilityVerified) - Number(a.availabilityVerified));
    default: return copy;
  }
}

export function getCatalogFacets() {
  const skus = getStorefrontSkus();
  return {
    categories: CATALOG_CATEGORIES.filter((category) => skus.some((sku) => sku.category === category.value)),
    brands: Array.from(new Set(skus.map((sku) => sku.brand))).sort(),
    voltages: Array.from(new Set(skus.map((sku) => sku.voltage).filter(Boolean))).sort(),
    unitTypes: Array.from(new Set(skus.map((sku) => sku.unitType))).sort(),
    refrigerants: Array.from(new Set(skus.map((sku) => sku.refrigerant).filter(Boolean))).sort(),
  };
}

export type SeriesPriceRange = { low: number; high: number; count: number };
export function getSeriesPriceRange(seriesSlug: string): SeriesPriceRange | null {
  const prices = getStorefrontSkus().filter((sku) => sku.seriesSlug === seriesSlug && sku.retailPrice !== null).map((sku) => sku.retailPrice as number);
  return prices.length ? { low: Math.min(...prices), high: Math.max(...prices), count: prices.length } : null;
}

export function documentHref(doc: SkuDocument): string { return `/api/documents/${doc.id}`; }
export function productHref(sku: Pick<StorefrontSku, "sku">): string { return `/products/sku/${skuSlug(sku.sku)}`; }
