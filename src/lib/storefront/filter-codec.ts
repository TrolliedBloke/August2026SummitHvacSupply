/**
 * The catalog filter codec. One parser, one normalizer and one serializer for
 * every place filters appear -- sidebar, mobile sheet, chips, the header
 * category rail and browser history -- so the URL is the single applied state
 * and the semantics cannot diverge between them.
 *
 * Cardinality is part of the schema: brand is multi-select, every other facet
 * is single-select. Unknown keys are dropped, malformed values are ignored
 * rather than guessed at, and duplicates collapse. Serialization uses a fixed
 * key order, so the same filters always produce the same URL (and one history
 * entry per real change).
 */

import {
  CATALOG_CATEGORIES,
  SORT_OPTIONS,
  type CatalogAvailability,
  type CatalogCategory,
  type CatalogFilters,
  type SortKey,
} from "./catalog";
import { CATALOG_TASK_VALUES, catalogTask, type CatalogTask } from "./catalog-tasks";

export const BTU_BUCKETS = [
  { value: "small", label: "Up to 12k" },
  { value: "mid", label: "18k – 36k" },
  { value: "large", label: "36k+" },
] as const;

export const PRICING_OPTIONS = [
  { value: "priced", label: "Published price" },
  { value: "quote", label: "Request price" },
] as const;

export const STOCK_OPTIONS = [
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "unknown", label: "Confirm at order" },
  { value: "out_of_stock", label: "Out of stock" },
] as const;

type BtuBucket = (typeof BTU_BUCKETS)[number]["value"];
type PricingValue = (typeof PRICING_OPTIONS)[number]["value"];

export type AppliedFilters = {
  q: string;
  /** The buyer's job (catalog-tasks.ts). A mode, not a facet: never a chip. */
  task: CatalogTask | null;
  category: CatalogCategory | null;
  brand: string[];
  btu: BtuBucket | null;
  voltage: string | null;
  unitType: string | null;
  refrigerant: string | null;
  pricing: PricingValue | null;
  stock: CatalogAvailability | null;
  sort: SortKey;
};

export type FacetKey = "category" | "brand" | "btu" | "voltage" | "unitType" | "refrigerant" | "pricing" | "stock";

export const FACET_SCHEMA: Record<FacetKey, { label: string; cardinality: "single" | "multi" }> = {
  category: { label: "Category", cardinality: "single" },
  brand: { label: "Brand", cardinality: "multi" },
  btu: { label: "Capacity", cardinality: "single" },
  voltage: { label: "Voltage", cardinality: "single" },
  unitType: { label: "Unit type", cardinality: "single" },
  refrigerant: { label: "Refrigerant", cardinality: "single" },
  pricing: { label: "Pricing", cardinality: "single" },
  stock: { label: "Stock", cardinality: "single" },
};

/** Fixed serialization order. `q` first so shared links read naturally. */
const KEY_ORDER: Array<keyof AppliedFilters> = [
  "q", "task", "category", "brand", "btu", "voltage", "unitType", "refrigerant", "pricing", "stock", "sort",
];

export const EMPTY_FILTERS: AppliedFilters = {
  q: "",
  task: null,
  category: null,
  brand: [],
  btu: null,
  voltage: null,
  unitType: null,
  refrigerant: null,
  pricing: null,
  stock: null,
  sort: "relevance",
};

const MAX_QUERY = 120;
const MAX_BRANDS = 20;
const MAX_FREE_VALUE = 80;

type ParamSource = URLSearchParams | { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function reader(source: ParamSource): (key: string) => string | null {
  if (typeof (source as URLSearchParams).get === "function") {
    return (key) => (source as URLSearchParams).get(key);
  }
  const record = source as Record<string, string | string[] | undefined>;
  return (key) => {
    const value = record[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function freeValue(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "all" || trimmed.length > MAX_FREE_VALUE) return null;
  return trimmed;
}

/** URL -> typed filters. Tolerant: anything it cannot read becomes "unset". */
export function parseCatalogFilters(source: ParamSource): AppliedFilters {
  const get = reader(source);
  const brands = (get("brand") ?? "")
    .split(",")
    .map((brand) => brand.trim())
    .filter((brand) => brand && brand !== "all" && brand.length <= MAX_FREE_VALUE);
  return {
    q: (get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY),
    task: oneOf(get("task"), CATALOG_TASK_VALUES),
    category: oneOf(get("category"), CATALOG_CATEGORIES.map((category) => category.value)),
    brand: Array.from(new Set(brands)).slice(0, MAX_BRANDS),
    btu: oneOf(get("btu"), BTU_BUCKETS.map((bucket) => bucket.value)),
    voltage: freeValue(get("voltage")),
    unitType: freeValue(get("unitType")),
    refrigerant: freeValue(get("refrigerant")),
    pricing: oneOf(get("pricing"), PRICING_OPTIONS.map((option) => option.value)),
    stock: oneOf(get("stock"), ["unknown", "in_stock", "low_stock", "out_of_stock", "lead_time"] as const),
    sort: oneOf(get("sort"), SORT_OPTIONS.map((option) => option.value)) ?? "relevance",
  };
}

export type CatalogFacets = {
  categories: ReadonlyArray<{ value: string; label: string }>;
  brands: readonly string[];
  voltages: readonly string[];
  unitTypes: readonly string[];
  refrigerants: readonly string[];
};

/**
 * Drop values the catalog does not carry, so a stale or hand-edited link can
 * never produce a chip with a raw, unlabelled value or an unexplainable empty
 * result. Brands keep the facet's own order, which makes the URL canonical.
 */
export function normalizeCatalogFilters(filters: AppliedFilters, facets: CatalogFacets): AppliedFilters {
  const keep = (value: string | null, allowed: readonly string[]) => (value !== null && allowed.includes(value) ? value : null);
  return {
    ...filters,
    category: (keep(filters.category, facets.categories.map((category) => category.value)) as CatalogCategory | null),
    brand: facets.brands.filter((brand) => filters.brand.includes(brand)),
    voltage: keep(filters.voltage, facets.voltages),
    unitType: keep(filters.unitType, facets.unitTypes),
    refrigerant: keep(filters.refrigerant, facets.refrigerants),
  };
}

/** Typed filters -> canonical query string (no leading "?"). Defaults are omitted. */
export function serializeCatalogFilters(filters: AppliedFilters): string {
  const params = new URLSearchParams();
  for (const key of KEY_ORDER) {
    const value = filters[key];
    if (key === "sort") {
      if (value !== "relevance") params.set(key, String(value));
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
      continue;
    }
    if (value) params.set(key, String(value));
  }
  return params.toString();
}

/** The legacy filter shape consumed by filterStorefrontSkus. */
export function toCatalogFilters(filters: AppliedFilters): CatalogFilters {
  return {
    q: filters.q || undefined,
    categories: catalogTask(filters.task)?.categories ?? undefined,
    category: filters.category ?? "all",
    brand: filters.brand.length ? filters.brand.join(",") : undefined,
    btu: filters.btu ?? undefined,
    voltage: filters.voltage ?? undefined,
    unitType: filters.unitType ?? undefined,
    refrigerant: filters.refrigerant ?? undefined,
    pricing: filters.pricing ?? "all",
    stock: filters.stock ?? "all",
  };
}

/** Apply one facet toggle according to its cardinality. */
export function toggleFacet(filters: AppliedFilters, key: FacetKey, value: string): AppliedFilters {
  if (FACET_SCHEMA[key].cardinality === "multi") {
    const current = filters.brand;
    return { ...filters, brand: current.includes(value) ? current.filter((brand) => brand !== value) : [...current, value] };
  }
  const current = filters[key as Exclude<FacetKey, "brand">];
  return { ...filters, [key]: current === value ? null : value } as AppliedFilters;
}

/** Remove one value; never touches unrelated facets. */
export function removeFacet(filters: AppliedFilters, key: FacetKey, value: string): AppliedFilters {
  if (key === "brand") return { ...filters, brand: filters.brand.filter((brand) => brand !== value) };
  return { ...filters, [key]: null } as AppliedFilters;
}

/** Clear every facet, keeping the search text, task and sort. */
export function clearFacets(filters: AppliedFilters): AppliedFilters {
  return { ...EMPTY_FILTERS, q: filters.q, task: filters.task, sort: filters.sort };
}

/**
 * Switch task. Facets that the new task cannot reach (a category outside it)
 * are dropped, so the switch never lands on an unexplained empty page.
 */
export function selectTask(filters: AppliedFilters, task: CatalogTask | null): AppliedFilters {
  const categories = catalogTask(task)?.categories;
  const category = filters.category && categories && !categories.includes(filters.category) ? null : filters.category;
  return { ...filters, task, category };
}

export function selectedValues(filters: AppliedFilters, key: FacetKey): string[] {
  if (key === "brand") return filters.brand;
  const value = filters[key];
  return value ? [String(value)] : [];
}

/** Every active facet value, in schema order -- one chip each. */
export function activeFacets(filters: AppliedFilters): Array<{ key: FacetKey; value: string }> {
  return (Object.keys(FACET_SCHEMA) as FacetKey[]).flatMap((key) => selectedValues(filters, key).map((value) => ({ key, value })));
}

export function sameFilters(a: AppliedFilters, b: AppliedFilters): boolean {
  return serializeCatalogFilters(a) === serializeCatalogFilters(b);
}

/** Human labels for chip and summary text. Falls back to the value only for free-text facets. */
export function facetValueLabel(key: FacetKey, value: string): string {
  if (key === "category") return CATALOG_CATEGORIES.find((category) => category.value === value)?.label ?? value;
  if (key === "btu") return BTU_BUCKETS.find((bucket) => bucket.value === value)?.label ?? value;
  if (key === "pricing") return PRICING_OPTIONS.find((option) => option.value === value)?.label ?? value;
  if (key === "stock") return STOCK_OPTIONS.find((option) => option.value === value)?.label ?? value;
  return value;
}
