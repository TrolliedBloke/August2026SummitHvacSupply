import { SERIES, CATEGORY_LABEL, type Category, getSeries } from "@/lib/products";
import { crossReferenceLookup } from "./cross-reference";
import {
  demoInventoryLots,
  demoSkuDocuments,
  demoSkus,
  demoWarehouses,
} from "@/lib/backend/mock-data";
import { summarizeInventory } from "@/lib/backend/math";
import type { InventorySummary, Sku, SkuDocument } from "@/lib/backend/types";

export type StorefrontSku = Sku & {
  seriesName: string;
  seriesSlug: string;
  category: Category;
  categoryLabel: string;
  image: string;
  available: number;
  stockStatus: InventorySummary["status"];
  documents: SkuDocument[];
  warehouse: {
    code: string;
    name: string;
    address: string;
  };
};

export type CatalogFilters = {
  q?: string;
  category?: Category | "all";
  btu?: string;
  voltage?: string;
  unitType?: string;
  stock?: "all" | "ready" | "low" | "backorder";
  minSeer?: number;
};

const inventoryBySku = new Map(summarizeInventory(demoInventoryLots).map((summary) => [summary.skuId, summary]));
const warehouse = demoWarehouses[0];

function toStorefrontSku(sku: Sku): StorefrontSku {
  const series = getSeries(sku.seriesSlug);
  const inventory = inventoryBySku.get(sku.id);
  return {
    ...sku,
    seriesName: series?.name ?? sku.seriesSlug,
    category: series?.category ?? "ductless",
    categoryLabel: series ? CATEGORY_LABEL[series.category] : "HVAC",
    image: series?.image ?? "/logo-summit.svg",
    available: inventory?.available ?? 0,
    stockStatus: inventory?.status ?? "backorder",
    documents: demoSkuDocuments.filter((doc) => doc.skuId === sku.id),
    warehouse: {
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address,
    },
  };
}

export function getStorefrontSkus(): StorefrontSku[] {
  return demoSkus.map(toStorefrontSku);
}

// Real TCL model numbers can contain "/" (e.g. TSC-12HA2/I3TI23), which is not
// URL-safe for a single dynamic segment. Route on a slash-free slug instead.
export function skuSlug(sku: string): string {
  return sku.replace(/\//g, "-");
}

export function getStorefrontSku(idOrSku: string): StorefrontSku | undefined {
  const normalized = idOrSku.toLowerCase();
  return getStorefrontSkus().find(
    (sku) =>
      sku.id.toLowerCase() === normalized ||
      sku.sku.toLowerCase() === normalized ||
      skuSlug(sku.sku).toLowerCase() === normalized
  );
}

export function getRelatedSkus(sku: StorefrontSku, limit = 4): StorefrontSku[] {
  return getStorefrontSkus()
    .filter((candidate) => candidate.id !== sku.id)
    .sort((a, b) => {
      const seriesScore = Number(b.seriesSlug === sku.seriesSlug) - Number(a.seriesSlug === sku.seriesSlug);
      if (seriesScore !== 0) return seriesScore;
      const categoryScore = Number(b.category === sku.category) - Number(a.category === sku.category);
      if (categoryScore !== 0) return categoryScore;
      return Math.abs(a.btu - sku.btu) - Math.abs(b.btu - sku.btu);
    })
    .slice(0, limit);
}

/* Forgiving code matching: dashes, slashes, spaces, and case never matter
   ("th09 svh 23bw" hits TH09SVH23BW), and a single typo in a model number
   still resolves. Buyers type codes off a nameplate — meet them there. */
function normalizeCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Levenshtein distance capped at 1 — cheap at catalog scale. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function searchStorefrontSkus(query: string, limit = 6): StorefrontSku[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const qCode = normalizeCode(q);

  const crossRefIds = crossReferenceLookup(query);

  const scored = getStorefrontSkus()
    .map((sku) => {
      const haystack = [
        sku.sku,
        sku.modelNumber,
        sku.title,
        sku.seriesName,
        sku.unitType,
        sku.voltage,
        `${sku.btu}`,
        sku.categoryLabel,
      ]
        .join(" ")
        .toLowerCase();
      const skuCode = normalizeCode(sku.sku);
      const modelCode = normalizeCode(sku.modelNumber);
      const exact =
        sku.sku.toLowerCase() === q ||
        sku.modelNumber.toLowerCase() === q ||
        (qCode.length >= 4 && (skuCode === qCode || modelCode === qCode));
      const crossRef = crossRefIds.includes(sku.id);
      const starts =
        sku.sku.toLowerCase().startsWith(q) ||
        sku.modelNumber.toLowerCase().startsWith(q) ||
        (qCode.length >= 4 && (skuCode.startsWith(qCode) || modelCode.startsWith(qCode)));
      const contains = haystack.includes(q);
      const fuzzy =
        qCode.length >= 6 && (withinOneEdit(skuCode, qCode) || withinOneEdit(modelCode, qCode));
      const score = exact ? 5 : crossRef ? 4 : starts ? 3 : contains ? 2 : fuzzy ? 1 : 0;
      return { sku, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.sku.title.localeCompare(b.sku.title));

  return scored.slice(0, limit).map((item) => item.sku);
}

export function filterStorefrontSkus(filters: CatalogFilters): StorefrontSku[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  return getStorefrontSkus().filter((sku) => {
    if (q) {
      const haystack = [
        sku.sku,
        sku.modelNumber,
        sku.title,
        sku.seriesName,
        sku.unitType,
        sku.voltage,
        `${sku.btu}`,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.category && filters.category !== "all" && sku.category !== filters.category) return false;
    if (filters.voltage && sku.voltage !== filters.voltage) return false;
    if (filters.unitType && sku.unitType !== filters.unitType) return false;
    if (filters.stock && filters.stock !== "all" && sku.stockStatus !== filters.stock) return false;
    if (filters.btu) {
      if (filters.btu === "small" && sku.btu > 12000) return false;
      if (filters.btu === "mid" && (sku.btu < 18000 || sku.btu > 36000)) return false;
      if (filters.btu === "large" && sku.btu < 36000) return false;
    }
    if (filters.minSeer) {
      const series = getSeries(sku.seriesSlug);
      if (!series || series.seer2 < filters.minSeer) return false;
    }
    return true;
  });
}

export type SortKey =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "btu-asc"
  | "btu-desc"
  | "seer-desc"
  | "availability";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Most relevant" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "btu-asc", label: "Capacity: low to high" },
  { value: "btu-desc", label: "Capacity: high to low" },
  { value: "seer-desc", label: "Efficiency: SEER2 high to low" },
  { value: "availability", label: "Availability: in stock first" },
];

export function sortStorefrontSkus(skus: StorefrontSku[], sort: SortKey = "relevance"): StorefrontSku[] {
  const seer = (s: StorefrontSku) => getSeries(s.seriesSlug)?.seer2 ?? 0;
  const copy = [...skus];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.msrp - b.msrp);
    case "price-desc":
      return copy.sort((a, b) => b.msrp - a.msrp);
    case "btu-asc":
      return copy.sort((a, b) => a.btu - b.btu);
    case "btu-desc":
      return copy.sort((a, b) => b.btu - a.btu);
    case "seer-desc":
      return copy.sort((a, b) => seer(b) - seer(a));
    case "availability":
      return copy.sort((a, b) => b.available - a.available);
    default:
      return copy;
  }
}

export function getCatalogFacets() {
  const skus = getStorefrontSkus();
  return {
    categories: SERIES.map((series) => ({
      value: series.category,
      label: CATEGORY_LABEL[series.category],
    })).filter((item, index, arr) => arr.findIndex((candidate) => candidate.value === item.value) === index),
    voltages: Array.from(new Set(skus.map((sku) => sku.voltage))).sort(),
    unitTypes: Array.from(new Set(skus.map((sku) => sku.unitType))).sort(),
  };
}

export type SeriesPriceRange = { low: number; high: number; count: number };

/** Retail (MSRP) price range across a series' SKUs — powers "From $X,XXX". */
export function getSeriesPriceRange(seriesSlug: string): SeriesPriceRange | null {
  const prices = getStorefrontSkus()
    .filter((sku) => sku.seriesSlug === seriesSlug)
    .map((sku) => sku.msrp);
  if (prices.length === 0) return null;
  return { low: Math.min(...prices), high: Math.max(...prices), count: prices.length };
}

export function documentHref(doc: SkuDocument): string {
  return `/api/documents/${doc.id}`;
}

export function productHref(sku: Pick<StorefrontSku, "sku">): string {
  return `/products/sku/${skuSlug(sku.sku)}`;
}
