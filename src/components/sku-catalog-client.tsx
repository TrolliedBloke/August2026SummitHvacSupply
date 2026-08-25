"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
import * as React from "react";
import { SkuCard } from "./sku-card";
import { Button } from "./ui";
import {
  filterStorefrontSkus,
  getCatalogFacets,
  sortStorefrontSkus,
  SORT_OPTIONS,
  type CatalogFilters,
  type SortKey,
  type StorefrontSku,
  type CatalogCategory,
} from "@/lib/storefront/catalog";
import { SITE } from "@/lib/site";
import { track } from "@/lib/track";

type Facets = ReturnType<typeof getCatalogFacets>;
const PAGE_SIZE = 24;

export function SkuCatalogClient({ skus, facets }: { skus: StorefrontSku[]; facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [visibility, setVisibility] = React.useState({ key: "", count: PAGE_SIZE });
  const drawerCloseRef = React.useRef<HTMLButtonElement>(null);

  // Mobile filter drawer: scroll lock + Escape to close.
  React.useEffect(() => {
    if (!drawerOpen) return;
    drawerCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const filters: CatalogFilters = {
    q: params.get("q") ?? undefined,
    category: (params.get("category") as CatalogCategory | null) ?? "all",
    brand: params.get("brand") ?? undefined,
    btu: params.get("btu") ?? undefined,
    voltage: params.get("voltage") ?? undefined,
    unitType: params.get("unitType") ?? undefined,
    refrigerant: params.get("refrigerant") ?? undefined,
    pricing: (params.get("pricing") as CatalogFilters["pricing"]) ?? "all",
    stock: (params.get("stock") as CatalogFilters["stock"]) ?? "all",
  };

  const sort = (params.get("sort") as SortKey | null) ?? "relevance";
  const filtered = sortStorefrontSkus(filterStorefrontSkus(filters, skus), sort);
  const filterKey = params.toString();
  const visibleCount = visibility.key === filterKey ? visibility.count : PAGE_SIZE;

  function setParam(key: string, value?: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParam("q", query.trim());
  }

  function clear() {
    setQuery("");
    router.push(pathname, { scroll: false });
  }

  // Count only real filters -- sorting alone shouldn't offer "Clear".
  const activeCount = Array.from(params.keys()).filter((k) => k !== "sort").length;

  const searchForm = (
    <form onSubmit={submitSearch} className="rounded-(--r-md) border border-line bg-surface-1 p-3 shadow-[var(--shadow-sm)]">
      <label className="sr-only" htmlFor="catalog-search">Search by SKU, model, BTU, or unit type</label>
      <div className="flex items-center gap-2">
        <Search size={17} className="text-ink-3" />
        <input
          id="catalog-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search SKU or model"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink-1 outline-none placeholder:text-ink-4"
        />
        <Button type="submit" size="md">Search</Button>
      </div>
    </form>
  );

  const filterGroups = (
    <>
      <FilterGroup label="Category">
        <Select value={filters.category ?? "all"} onChange={(value) => setParam("category", value)}>
          <option value="all">All categories</option>
          {facets.categories.map((category) => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup label="Brand">
        <Select value={filters.brand ?? "all"} onChange={(value) => setParam("brand", value)}>
          <option value="all">All brands</option>
          {facets.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
        </Select>
      </FilterGroup>
      <FilterGroup label="Capacity">
        <Select value={filters.btu ?? "all"} onChange={(value) => setParam("btu", value)}>
          <option value="all">Any BTU</option>
          <option value="small">Up to 12k BTU</option>
          <option value="mid">18k-36k BTU</option>
          <option value="large">36k+ BTU</option>
        </Select>
      </FilterGroup>
      <FilterGroup label="Voltage">
        <Select value={filters.voltage ?? "all"} onChange={(value) => setParam("voltage", value)}>
          <option value="all">Any voltage</option>
          {facets.voltages.map((voltage) => (
            <option key={voltage} value={voltage}>{voltage}</option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup label="Unit type">
        <Select value={filters.unitType ?? "all"} onChange={(value) => setParam("unitType", value)}>
          <option value="all">Any unit type</option>
          {facets.unitTypes.map((unitType) => (
            <option key={unitType} value={unitType}>{unitType}</option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup label="Refrigerant">
        <Select value={filters.refrigerant ?? "all"} onChange={(value) => setParam("refrigerant", value)}>
          <option value="all">Any refrigerant</option>
          {facets.refrigerants.map((refrigerant) => <option key={refrigerant} value={refrigerant}>{refrigerant}</option>)}
        </Select>
      </FilterGroup>
      <FilterGroup label="Pricing">
        <Select value={filters.pricing ?? "all"} onChange={(value) => setParam("pricing", value)}>
          <option value="all">All pricing states</option>
          <option value="priced">Published price</option>
          <option value="quote">Request price</option>
        </Select>
      </FilterGroup>
      <FilterGroup label="Stock">
        <Select value={filters.stock ?? "all"} onChange={(value) => setParam("stock", value)}>
          <option value="all">Any stock status</option>
          <option value="unknown">Confirmation required</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </Select>
      </FilterGroup>
    </>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      {/* Desktop sidebar -- hidden below lg so mobile reaches products first. */}
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        {searchForm}
        <div className="mt-6 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ink-1">
            <SlidersHorizontal size={16} /> Filters
          </span>
          {activeCount > 0 && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-danger">
              <X size={12} /> Clear
            </button>
          )}
        </div>
        {filterGroups}
      </aside>

      {/* Mobile: search + a sticky Filters button; products render immediately. */}
      <div className="flex flex-col gap-3 lg:hidden">
        {searchForm}
        <div className="sticky top-[68px] z-20 -mx-1 px-1">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1/95 text-sm font-semibold text-ink-1 shadow-[var(--shadow-sm)] backdrop-blur transition-colors hover:bg-surface-2"
          >
            <SlidersHorizontal size={16} />
            Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      {drawerOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              aria-hidden
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-[var(--ink-panel)]/40 backdrop-blur-[2px]"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Filter SKUs"
              className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-(--r-lg) border-t border-line bg-canvas shadow-[var(--shadow-lg)]"
            >
              <header className="flex items-center justify-between border-b border-line px-5 py-4">
                <span className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink-1">
                  <SlidersHorizontal size={16} /> Filters
                </span>
                <div className="flex items-center gap-3">
                  {activeCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { clear(); setDrawerOpen(false); }}
                      className="text-xs font-medium text-ink-3 hover:text-danger"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close filters"
                    className="grid size-9 place-items-center rounded-(--r-sm) text-ink-2 hover:bg-surface-2 hover:text-ink-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto px-5 pb-4">{filterGroups}</div>
              <footer className="border-t border-line bg-surface-1 px-5 py-4">
                <Button type="button" full onClick={() => setDrawerOpen(false)}>
                  Show {filtered.length} {filtered.length === 1 ? "SKU" : "SKUs"}
                </Button>
              </footer>
            </div>
          </div>,
          document.body
        )}

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-3">
            {filtered.length} of {skus.length} SKUs
          </p>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <span className="hidden sm:inline">Sort</span>
            <select
              value={sort}
              onChange={(event) => setParam("sort", event.target.value === "relevance" ? undefined : event.target.value)}
              aria-label="Sort SKUs"
              className="h-9 rounded-(--r-sm) border border-control-border bg-control-bg px-2.5 text-sm text-ink-1 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-(--r-md) border border-dashed border-line-strong bg-surface-2/50 p-10 text-center">
            <ZeroResultsLogger query={filters.q} />
            <h2 className="font-display text-xl font-semibold text-ink-1">No SKUs match those filters.</h2>
            <p className="mt-2 text-sm text-ink-2">
              Clear filters or search by model number. Or text a photo of the old
              unit&apos;s model plate to {SITE.phone} and we&apos;ll match it for you.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button type="button" onClick={clear}>Clear filters</Button>
              <Link href="/contact" className="inline-flex h-10 items-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
                Contact support
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              {filtered.slice(0, visibleCount).map((sku, index) => (
                <SkuCard key={sku.id} sku={sku} priority={index < 4} />
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div className="mt-8 flex justify-center">
                <Button type="button" onClick={() => setVisibility({ key: filterKey, count: visibleCount + PAGE_SIZE })}>
                  Show more ({filtered.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* Logs the miss once per query -- the empty state doubles as market research. */
function ZeroResultsLogger({ query }: { query?: string }) {
  React.useEffect(() => {
    if (query && query.trim().length >= 3) {
      track("search_zero_results", { q: query.trim().slice(0, 120) });
    }
  }, [query]);
  return null;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-line pt-5 first:mt-5">
      <h3 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</h3>
      {children}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
    >
      {children}
    </select>
  );
}
