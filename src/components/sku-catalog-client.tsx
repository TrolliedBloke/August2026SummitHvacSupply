"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
import * as React from "react";
import { ProductCard } from "./product-card";
import { Button } from "./ui";
import { CustomSelect } from "./custom-select";
import { ActiveFilterChips, buildGroups, FilterPanel, splitMulti, type FilterKey } from "./catalog-filters";
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
/** Ceiling on the result count the catalog will state exactly. */
const RESULT_CAP = 1000;

export function SkuCatalogClient({ skus, facets }: { skus: StorefrontSku[]; facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [visibility, setVisibility] = React.useState({ key: "", count: PAGE_SIZE });
  const drawerCloseRef = React.useRef<HTMLButtonElement>(null);
  const filtersButtonRef = React.useRef<HTMLButtonElement>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // The sheet is a dialog, with the same mechanics as the menu: scroll lock,
  // Escape to close, Tab held inside, and focus returned to the control that
  // opened it.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const opener = filtersButtonRef.current;
    drawerCloseRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus();
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

  // Count only real filters -- sorting alone shouldn't offer "Clear". Brand
  // counts once per selected brand, because each one is its own chip.
  const activeCount = Array.from(params.keys())
    .filter((key) => key !== "sort")
    .reduce((total, key) => total + (key === "brand" ? splitMulti(params.get("brand") ?? undefined).length : 1), 0);

  // The category page sets ?category=, so the Category group is redundant
  // there; on All products and on search results it is the main way in.
  const showCategory = !params.get("category");

  const groups = buildGroups({ facets, filters, skus, showCategory });
  // Some categories cannot be narrowed at all -- line sets carry one brand, no
  // BTU rating and no voltage -- so every group collapses. Offering a Filters
  // button that opens an empty sheet is worse than not offering one.
  const hasFilters = groups.length > 0;

  function toggleFilter(key: FilterKey, value: string) {
    if (key === "brand") {
      const current = splitMulti(params.get("brand") ?? undefined);
      const next = current.includes(value) ? current.filter((b) => b !== value) : [...current, value];
      setParam("brand", next.join(","));
      return;
    }
    setParam(key, params.get(key) === value ? undefined : value);
  }

  function removeFilter(key: FilterKey, value: string) {
    if (key === "brand") {
      const next = splitMulti(params.get("brand") ?? undefined).filter((brand) => brand !== value);
      setParam("brand", next.join(","));
      return;
    }
    setParam(key, undefined);
  }

  // "SKUs" is trade jargon on a page homeowners also read. RESULT_CAP is the
  // most the catalog will ever hand this component; if a future page limit
  // truncates the set, the count says "100+" rather than claiming an exact
  // number it cannot see past. Today nothing truncates it.
  const capped = filtered.length >= RESULT_CAP;
  const resultLabel = `${capped ? `${RESULT_CAP}+` : filtered.length} ${filtered.length === 1 ? "result" : "results"}`;

  const labelFor = (key: FilterKey, value: string) => {
    const group = groups.find((candidate) => candidate.key === key);
    const option = group?.options.find((candidate) => candidate.value === value);
    if (option) return option.label;
    // A category chip has to keep working after its group is hidden.
    if (key === "category") return facets.categories.find((c) => c.value === value)?.label ?? value;
    return value;
  };

  const searchForm = (
    <form onSubmit={submitSearch} className="rounded-(--r-md) border border-line bg-surface-1 p-3 shadow-[var(--shadow-sm)]">
      <label className="sr-only" htmlFor="catalog-search">Search products, models, SKUs, capacity, or unit type</label>
      <div className="flex items-center gap-2">
        <Search size={17} className="text-ink-3" />
        <input
          id="catalog-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “heater,” “3 ton,” or a model number"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink-1 outline-none placeholder:text-ink-4"
        />
        <Button type="submit" size="md">Search</Button>
      </div>
    </form>
  );

  const filterGroups = <FilterPanel groups={groups} filters={filters} onToggle={toggleFilter} />;

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      {/* Desktop sidebar -- hidden below lg so mobile reaches products first. */}
      <aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
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
        {hasFilters ? (
          <div className="mt-5">{filterGroups}</div>
        ) : (
          <p className="mt-5 text-meta text-ink-3">
            Nothing here narrows further. Clear the category to filter the whole catalog.
          </p>
        )}
      </aside>

      {/* Mobile: search + a sticky Filters button; products render immediately. */}
      <div className="flex flex-col gap-3 lg:hidden">
        {searchForm}
        {hasFilters && (
        <div className="sticky top-2 z-20 -mx-1 px-1">
          <button
            ref={filtersButtonRef}
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
        )}
      </div>

      {/* Mobile filter bottom sheet */}
      {drawerOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              aria-hidden
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-[var(--ink-panel)]/50"
            />
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label={activeCount > 0 ? `Filters (${activeCount})` : "Filters"}
              className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-(--r-lg) border-t border-line bg-canvas shadow-[var(--shadow-lg)]"
            >
              <header className="flex items-center justify-between border-b border-line px-5 py-4">
                <span className="inline-flex items-center gap-2 text-lead font-semibold text-ink-1">
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Filters{activeCount > 0 ? ` (${activeCount})` : ""}
                </span>
                <div className="flex items-center gap-3">
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
              <div className="flex-1 overflow-y-auto px-5 pb-6 pt-6">{filterGroups}</div>
              {/* The button sits near the home indicator, so the safe area is
                  padding, not a guess at a magic number. */}
              <footer
                className="flex items-center gap-4 border-t border-line bg-surface-1 px-5 pt-4"
                style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
              >
                <button
                  type="button"
                  onClick={clear}
                  disabled={activeCount === 0}
                  className="min-h-11 shrink-0 px-1 text-item font-medium text-ink-2 underline underline-offset-4 transition-colors duration-120 hover:text-ink-1 disabled:text-ink-4 disabled:no-underline"
                >
                  Clear all
                </button>
                <Button type="button" full onClick={() => setDrawerOpen(false)}>
                  Show {resultLabel}
                </Button>
              </footer>
            </div>
          </div>,
          document.body
        )}

      <section>
        <ActiveFilterChips filters={filters} labelFor={labelFor} onRemove={removeFilter} onClear={clear} />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-3">
            {filtered.length} of {skus.length} products
          </p>
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <span className="hidden sm:inline">Sort</span>
            <CustomSelect
              ariaLabel="Sort SKUs"
              value={sort}
              onChange={(value) => setParam("sort", value === "relevance" ? undefined : value)}
              options={SORT_OPTIONS}
              size="sm"
              className="w-52"
            />
          </div>
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 lg:grid-cols-3">
              {filtered.slice(0, visibleCount).map((sku, index) => (
                <ProductCard key={sku.id} sku={sku} priority={index < 4} />
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
