"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import * as React from "react";
import { ProductCard } from "./product-card";
import { Button } from "./ui";
import { CustomSelect } from "./custom-select";
import { Modal } from "./dialog";
import { Notice, StatePanel } from "./state";
import { ActiveFilterChips, buildGroups, FilterPanel } from "./catalog-filters";
import { filterStorefrontSkus, searchMatchReason, SORT_OPTIONS, type SortKey, type StorefrontSku } from "@/lib/storefront/catalog";
import { CATALOG_TASKS, catalogTask, type CatalogTask } from "@/lib/storefront/catalog-tasks";
import { resultCompatibilityNotes } from "@/lib/storefront/compatibility";
import {
  activeFacets,
  clearFacets,
  normalizeCatalogFilters,
  parseCatalogFilters,
  removeFacet,
  sameFilters,
  selectTask,
  serializeCatalogFilters,
  toCatalogFilters,
  toggleFacet,
  type AppliedFilters,
  type CatalogFacets,
  type FacetKey,
} from "@/lib/storefront/filter-codec";
import { queryCatalog } from "@/lib/storefront/catalog-query";
import type { LiveInventoryResult } from "@/lib/storefront/live-inventory";
import { SITE } from "@/lib/site";
import { track } from "@/lib/track";

const CATALOG_INITIAL_PAGE_SIZE = 12;

/** An AHRI-matched pair, flattened on the server for the "complete system" task. */
export type MatchedSystemSummary = {
  ahriReference: string;
  brand: string;
  btu: number;
  refrigerant: string;
  components: Array<{ sku: string; unitType: string; href: string }>;
};

/**
 * The catalog. The URL is the only applied filter state: every control reads
 * it through the codec and writes it back through the codec, so the sidebar,
 * the chips, the mobile sheet and Back/Forward always agree.
 *
 * The mobile sheet edits a DRAFT copy. Its controls change only the draft and
 * a locally computed preview count; Apply commits the draft in one history
 * entry; Cancel, Escape, the close button and the backdrop all discard it.
 */
export function SkuCatalogClient({
  skus,
  facets,
  systems = [],
  inventoryStatus = "ok",
}: {
  skus: StorefrontSku[];
  facets: CatalogFacets;
  systems?: MatchedSystemSummary[];
  inventoryStatus?: LiveInventoryResult["status"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramString = params.toString();
  const applied = React.useMemo(
    () => normalizeCatalogFilters(parseCatalogFilters(new URLSearchParams(paramString)), facets),
    [paramString, facets]
  );
  const appliedKey = serializeCatalogFilters(applied);

  // The search box follows the URL, including Back and Forward.
  const [query, setQuery] = React.useState(applied.q);
  const [syncedQ, setSyncedQ] = React.useState(applied.q);
  if (applied.q !== syncedQ) {
    setSyncedQ(applied.q);
    setQuery(applied.q);
  }

  function commit(next: AppliedFilters) {
    // Normalized before serializing, so the same filters always produce the
    // same URL (brand order follows the facet list, not click order).
    const qs = serializeCatalogFilters(normalizeCatalogFilters(next, facets));
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  /* Paging through the query boundary -------------------------------------- */
  const [loaded, setLoaded] = React.useState({ key: appliedKey, pages: 1 });
  const pageCount = loaded.key === appliedKey ? loaded.pages : 1;
  const page = React.useMemo(() => {
    const first = queryCatalog(skus, applied, { limit: CATALOG_INITIAL_PAGE_SIZE });
    const items = [...first.items];
    let cursor = first.nextCursor;
    for (let index = 1; index < pageCount && cursor; index += 1) {
      const next = queryCatalog(skus, applied, { cursor, limit: CATALOG_INITIAL_PAGE_SIZE });
      items.push(...next.items);
      cursor = next.nextCursor;
    }
    return { items, total: first.total, nextCursor: cursor, rejected: first.rejected };
  }, [skus, applied, pageCount]);
  const firstNewRef = React.useRef<number | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  function showMore() {
    firstNewRef.current = page.items.length;
    setLoaded({ key: appliedKey, pages: pageCount + 1 });
  }

  // After "Show more", move focus to the first newly shown product so keyboard
  // users continue where the list grew instead of back at the button.
  React.useEffect(() => {
    if (firstNewRef.current === null) return;
    const index = firstNewRef.current;
    firstNewRef.current = null;
    const links = gridRef.current?.querySelectorAll<HTMLAnchorElement>("article h3 a");
    links?.[index]?.focus({ preventScroll: false });
  }, [page.items.length]);

  /* Task and compatibility ----------------------------------------------- */
  const task = catalogTask(applied.task);
  const allMatches = React.useMemo(() => filterStorefrontSkus(toCatalogFilters(applied), skus), [skus, applied]);
  // Only once the buyer has narrowed the list: on the unfiltered catalog every
  // mix is expected and the notice would be noise above the first product.
  const narrowed = Boolean(applied.q || applied.task || activeFacets(applied).length > 0);
  const compatibility = narrowed ? resultCompatibilityNotes(allMatches) : [];

  function chooseTask(value: CatalogTask) {
    const next = applied.task === value ? null : value;
    commit(selectTask(applied, next));
    track("catalog_task", { task: next ?? "none" });
    // "I know the model" is a search job: put the caret where the model goes.
    if (next === "model") {
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      document.getElementById(desktop ? "catalog-search-desktop" : "catalog-search-mobile")?.focus();
    }
  }

  /* Groups ----------------------------------------------------------------- */
  const showCategory = !applied.category;
  const groups = buildGroups({ facets, filters: applied, skus, showCategory });
  const hasFilters = groups.length > 0;
  const activeCount = activeFacets(applied).length;

  /* Mobile draft sheet ------------------------------------------------------ */
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<AppliedFilters>(applied);
  const sheetCloseRef = React.useRef<HTMLButtonElement>(null);
  const draftGroups = sheetOpen ? buildGroups({ facets, filters: draft, skus, showCategory }) : [];
  const draftCount = sheetOpen ? filterStorefrontSkus(toCatalogFilters(draft), skus).length : 0;
  const draftDirty = sheetOpen && !sameFilters(draft, applied);
  const draftChanges = sheetOpen ? countChanges(applied, draft) : 0;

  // The sheet is a phone and tablet surface. Growing past lg while it is open
  // would leave an inert page behind an invisible dialog, so it closes (and,
  // like every other dismissal, discards the draft).
  React.useEffect(() => {
    if (!sheetOpen) return;
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => query.matches && setSheetOpen(false);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [sheetOpen]);

  function openSheet() {
    setDraft(applied);
    setSheetOpen(true);
  }
  function applyDraft() {
    if (draftDirty) commit(draft);
    setSheetOpen(false);
  }

  /* Search ----------------------------------------------------------------- */
  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commit({ ...applied, q: query.trim() });
  }

  const resultLabel = `${page.total} ${page.total === 1 ? "result" : "results"}`;
  const partial = inventoryStatus === "error" || inventoryStatus === "timeout";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(15rem,17.5rem)_minmax(0,1fr)]">
      {/* Desktop sidebar -- hidden below lg so mobile reaches products first. */}
      <aside className="hidden min-w-0 lg:sticky lg:top-6 lg:block lg:self-start" aria-label="Search and filters">
        <CatalogSearchForm id="catalog-search-desktop" compact query={query} onQuery={setQuery} onSubmit={submitSearch} />
        <div className="mt-6 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-1">
            <SlidersHorizontal size={16} aria-hidden="true" /> Filters
          </h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => commit(clearFacets(applied))}
              className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink-1"
            >
              <X size={12} aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>
        {hasFilters ? (
          <div className="mt-5">
            <FilterPanel
              idPrefix="sidebar"
              groups={groups}
              filters={applied}
              onToggle={(key, value) => commit(toggleFacet(applied, key, value))}
            />
          </div>
        ) : (
          <p className="mt-5 text-meta text-ink-3">Nothing here narrows further. Clear the category to filter the whole catalog.</p>
        )}
      </aside>

      {/* Mobile search. Result controls stay sticky beside the products below. */}
      <div className="flex min-w-0 flex-col gap-3 lg:hidden">
        <CatalogSearchForm id="catalog-search-mobile" query={query} onQuery={setQuery} onSubmit={submitSearch} />
      </div>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        labelledBy="filter-sheet-title"
        placement="bottom"
        initialFocusRef={sheetCloseRef}
        className="animate-slide-in-up"
        backdropClassName="animate-fade-in"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <h2 id="filter-sheet-title" className="inline-flex items-center gap-2 text-lead font-semibold text-ink-1">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters
          </h2>
          <button
            ref={sheetCloseRef}
            type="button"
            onClick={() => setSheetOpen(false)}
            aria-label="Close filters without applying"
            className="grid size-11 place-items-center rounded-(--r-sm) text-ink-2 hover:bg-surface-2 hover:text-ink-1"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 scroll-pb-8 overflow-y-auto overscroll-contain px-5 pb-8 pt-5">
          {draftGroups.length > 0 ? (
            <FilterPanel
              idPrefix="sheet"
              groups={draftGroups}
              filters={draft}
              onToggle={(key, value) => setDraft((current) => toggleFacet(current, key, value))}
            />
          ) : (
            <p className="text-meta text-ink-3">Nothing narrows these results further.</p>
          )}
        </div>
        <footer
          className="shrink-0 border-t border-line bg-surface-1 px-5 pt-3 shadow-[0_-8px_20px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <p className="mb-2 text-meta text-ink-3" aria-live="polite">
            {draftDirty
              ? `${draftChanges} ${draftChanges === 1 ? "change" : "changes"} not applied yet · ${draftCount} ${draftCount === 1 ? "result" : "results"}`
              : "No changes yet"}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDraft((current) => clearFacets(current))}
              disabled={activeFacets(draft).length === 0}
              className="min-h-11 shrink-0 px-1 text-item font-medium text-ink-2 underline underline-offset-4 transition-colors duration-120 hover:text-ink-1 disabled:text-ink-4 disabled:no-underline"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="min-h-11 shrink-0 rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium text-ink-1 hover:bg-surface-2"
            >
              Cancel
            </button>
            <Button type="button" full onClick={applyDraft} disabled={!draftDirty}>
              Show {draftCount} {draftCount === 1 ? "result" : "results"}
            </Button>
          </div>
        </footer>
      </Modal>

      <section aria-labelledby="catalog-results-heading" className="min-w-0">
        <h2 id="catalog-results-heading" className="sr-only">Catalog results</h2>
        <TaskPicker value={applied.task} onChoose={chooseTask} />
        {task && (
          <div className="mb-5 rounded-(--r-md) border border-line bg-surface-1 p-4" data-catalog-task={task.value}>
            <p className="text-sm leading-6 text-ink-2">{task.hint}</p>
            {task.value === "system" && (
              <div className="mt-3">
                {systems.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Matched systems">
                    {systems.map((system) => (
                      <li key={system.ahriReference} className="rounded-(--r-sm) border border-line p-3 text-meta">
                        <p className="font-medium text-ink-1">
                          {system.brand} {Math.round(system.btu / 1000)}k BTU · {system.refrigerant}
                        </p>
                        <p className="part-number mt-0.5 text-micro text-ink-3">AHRI {system.ahriReference}</p>
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                          {system.components.map((component) => (
                            <Link key={component.sku} href={component.href} className="inline-flex min-h-11 items-center text-brand underline-offset-4 hover:underline">
                              {component.unitType} {component.sku}
                            </Link>
                          ))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/finder" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand underline underline-offset-4">
                  Let the system finder pick a matched pair
                </Link>
              </div>
            )}
          </div>
        )}
        <div className="sticky top-2 z-20 mb-4 grid grid-cols-[1fr_auto] gap-2 rounded-(--r-md) border border-line bg-canvas/95 p-2 shadow-sm backdrop-blur lg:hidden">
          <p className="col-span-full px-1 text-xs font-medium text-ink-2">{resultLabel}{activeCount > 0 ? ` · ${activeCount} active ${activeCount === 1 ? "filter" : "filters"}` : ""}</p>
          {hasFilters ? (
            <button type="button" onClick={openSheet} aria-haspopup="dialog" aria-expanded={sheetOpen} className="inline-flex h-11 items-center justify-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1 px-3 text-sm font-semibold text-ink-1">
              <SlidersHorizontal size={16} aria-hidden="true" /> Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
          ) : <span />}
          <CustomSelect ariaLabel="Sort products" value={applied.sort} onChange={(value) => commit({ ...applied, sort: value as SortKey })} options={SORT_OPTIONS} size="sm" className="min-w-[9.5rem]" />
        </div>
        <ActiveFilterChips
          filters={applied}
          onRemove={(key: FacetKey, value) => commit(removeFacet(applied, key, value))}
          onClear={() => commit(clearFacets(applied))}
        />

        {partial && (
          <Notice
            tone="warning"
            className="mb-5"
            title="Live stock counts did not load"
            action={
              <button type="button" onClick={() => router.refresh()} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-1 underline underline-offset-4">
                <RotateCcw size={14} aria-hidden="true" /> Retry
              </button>
            }
          >
            Products and prices are shown, but no stock counts. Availability is confirmed before any order is accepted.
          </Notice>
        )}
        {compatibility.length > 0 && (
          <Notice tone="info" className="mb-5" title="Check compatibility before ordering">
            <ul className="space-y-1" data-compatibility-notes={compatibility.map((note) => note.id).join(" ")}>
              {compatibility.map((note) => (
                <li key={note.id}>
                  <span className="font-medium text-ink-1">{note.title}.</span> {note.body}
                </li>
              ))}
            </ul>
          </Notice>
        )}
        {page.rejected.length > 0 && (
          <Notice tone="info" className="mb-5" title={`${page.rejected.length} ${page.rejected.length === 1 ? "product is" : "products are"} not shown`}>
            {page.rejected.length === 1 ? "Its" : "Their"} catalog record is incomplete. Call {SITE.phone} and the counter will look it up.
          </Notice>
        )}

        <div className="mb-5 hidden flex-wrap items-center justify-between gap-3 lg:flex">
          <div className="text-sm font-medium text-ink-2">
            {applied.q ? (
              <>
                {resultLabel} for <span className="text-ink-1">“{applied.q}”</span>
              </>
            ) : activeCount > 0 ? (
              <>
                {page.total} of {skus.length - page.rejected.length} products
              </>
            ) : (
              <>{page.total} products</>
            )}
          </div>
          <p role="status" className="sr-only">
            {resultLabel}
          </p>
          <div className="flex w-full items-center gap-2 text-sm text-ink-2 sm:w-auto">
            <span aria-hidden="true" className="shrink-0">Sort</span>
            <CustomSelect
              ariaLabel="Sort products"
              value={applied.sort}
              onChange={(value) => commit({ ...applied, sort: value as SortKey })}
              options={SORT_OPTIONS}
              size="sm"
              className="min-w-0 flex-1 sm:w-auto sm:min-w-[13rem] sm:flex-none"
            />
          </div>
        </div>

        {page.total === 0 ? (
          <>
            <ZeroResultsLogger query={applied.q} />
            <StatePanel
              title={applied.q ? `No products match “${applied.q}”` : "No products match those filters"}
              actions={
                <>
                  {activeCount > 0 && (
                    <Button type="button" onClick={() => commit(clearFacets(applied))}>
                      Clear filters
                    </Button>
                  )}
                  {applied.q && (
                    <Button type="button" variant="secondary" onClick={() => commit({ ...applied, q: "" })}>
                      Search all products
                    </Button>
                  )}
                  <Link
                    href="/finder"
                    className="inline-flex h-11 items-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2"
                  >
                    Use the system finder
                  </Link>
                  <Link
                    href="/contact?topic=product"
                    className="inline-flex h-11 items-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2"
                  >
                    Ask the counter
                  </Link>
                </>
              }
            >
              Remove a filter or search by model number. Or text a photo of the old unit&apos;s model plate to {SITE.phone} and we&apos;ll match it.
            </StatePanel>
          </>
        ) : (
          <>
            <div ref={gridRef} className="product-grid">
              {page.items.map((sku, index) => (
                <ProductCard
                  key={sku.id}
                  sku={sku}
                  priority={index < 4}
                  compactOnMobile
                  matchReason={applied.q ? searchMatchReason(sku, applied.q) : null}
                />
              ))}
            </div>
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-meta text-ink-3">
                Showing {page.items.length} of {page.total}
              </p>
              {page.total === 1 && (applied.q || activeCount > 0) && (
                <p className="max-w-md text-center text-meta text-ink-2" data-one-result>
                  Only one match. Not the unit you need? {activeCount > 0 ? "Remove a filter, or " : ""}search the full model from the data plate, or{" "}
                  <Link href="/contact?topic=product" className="font-medium text-brand underline underline-offset-4">ask the counter</Link>.
                </p>
              )}
              {page.nextCursor && (
                <Button type="button" variant="secondary" onClick={showMore}>
                  Show {Math.min(CATALOG_INITIAL_PAGE_SIZE, page.total - page.items.length)} more
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** The job before the facets. A toggle row, not tabs: none selected is valid. */
function TaskPicker({ value, onChoose }: { value: CatalogTask | null; onChoose: (value: CatalogTask) => void }) {
  return (
    <div className="mb-4" role="group" aria-label="What are you looking for?">
      <p className="mb-2 text-meta font-medium text-ink-2">What are you looking for?</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
        {CATALOG_TASKS.map((task) => {
          const on = value === task.value;
          return (
            <button
              key={task.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChoose(task.value)}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-item transition-colors duration-120 ${
                on ? "border-brand bg-brand-tint font-medium text-ink-1" : "border-line bg-surface-1 text-ink-1 hover:border-line-strong"
              }`}
            >
              {task.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function countChanges(applied: AppliedFilters, draft: AppliedFilters): number {
  const a = new Set(activeFacets(applied).map(({ key, value }) => `${key}:${value}`));
  const b = new Set(activeFacets(draft).map(({ key, value }) => `${key}:${value}`));
  let changes = 0;
  for (const entry of a) if (!b.has(entry)) changes += 1;
  for (const entry of b) if (!a.has(entry)) changes += 1;
  return changes;
}

function CatalogSearchForm({
  id,
  compact = false,
  query,
  onQuery,
  onSubmit,
}: {
  id: string;
  /** The sidebar is narrow: an icon submit leaves the field room for its placeholder. */
  compact?: boolean;
  query: string;
  onQuery: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form role="search" onSubmit={onSubmit} className="rounded-(--r-md) border border-line bg-surface-1 p-3">
      <label className="sr-only" htmlFor={id}>
        Search products, models, SKUs, capacity, or unit type
      </label>
      <div className="flex items-center gap-2">
        {!compact && <Search size={17} className="shrink-0 text-ink-3" aria-hidden="true" />}
        <input
          id={id}
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={compact ? "Model, SKU, or “3 ton”" : "Try “heater,” “3 ton,” or a model number"}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-ink-1 outline-none placeholder:text-ink-4"
        />
        {compact ? (
          <Button type="submit" size="md" aria-label="Search" className="w-11 shrink-0 px-0">
            <Search size={17} aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" size="md">
            Search
          </Button>
        )}
      </div>
    </form>
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
