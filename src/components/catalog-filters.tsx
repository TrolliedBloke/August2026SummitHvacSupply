"use client";

import * as React from "react";
import { X } from "lucide-react";
import { filterStorefrontSkus, type StorefrontSku } from "@/lib/storefront/catalog";
import {
  activeFacets,
  BTU_BUCKETS,
  FACET_SCHEMA,
  facetValueLabel,
  PRICING_OPTIONS,
  selectedValues,
  STOCK_OPTIONS,
  toCatalogFilters,
  toggleFacet,
  type AppliedFilters,
  type CatalogFacets,
  type FacetKey,
} from "@/lib/storefront/filter-codec";
import { catalogTask } from "@/lib/storefront/catalog-tasks";

export type FilterOption = { value: string; label: string; count: number; disabled: boolean };
export type FilterGroup = { key: FacetKey; label: string; control: "chips" | "checkbox"; options: FilterOption[] };

/**
 * How many results an option would return with every *other* filter still
 * applied -- which is what makes a disabled option trustworthy: it is disabled
 * because picking it leads to an empty page, not because it is unpopular. Uses
 * the codec's own toggle, so brand counts add to the selection (multi) while
 * other facets replace it (single).
 */
function countFor(key: FacetKey, value: string, filters: AppliedFilters, skus: StorefrontSku[]): number {
  const selected = selectedValues(filters, key).includes(value);
  const next = selected ? filters : toggleFacet(filters, key, value);
  return filterStorefrontSkus(toCatalogFilters(next), skus).length;
}

/**
 * The groups worth showing for a filter state.
 *
 * Category only appears on All products and search results: on a category
 * page the chips above the results already undo it. Any other group is shown
 * when it has two or more options that lead somewhere -- OR when it holds a
 * selected value. A selected facet never disappears, even when it narrowed the
 * set to one remaining option, so the user can always see and undo what
 * produced the results.
 *
 * With a task chosen, only that task's facets show, in the order that matters
 * for the job, and category options are limited to the task's categories. A
 * selected facet outside the task's list still shows, for the same reason.
 */
export function buildGroups({
  facets,
  filters,
  skus,
  showCategory,
}: {
  facets: CatalogFacets;
  filters: AppliedFilters;
  skus: StorefrontSku[];
  showCategory: boolean;
}): FilterGroup[] {
  const make = (key: FacetKey, control: FilterGroup["control"], raw: ReadonlyArray<{ value: string; label: string }>): FilterGroup => {
    const options = raw.map((option) => {
      const count = countFor(key, option.value, filters, skus);
      return { ...option, count, disabled: count === 0 };
    });
    return { key, label: FACET_SCHEMA[key].label, control, options };
  };

  const task = catalogTask(filters.task);
  const categories = task?.categories ? facets.categories.filter((category) => task.categories!.includes(category.value as never)) : facets.categories;
  const groups: FilterGroup[] = [];
  if (showCategory || filters.category) {
    groups.push(make("category", "chips", categories));
  }
  groups.push(make("brand", "checkbox", facets.brands.map((brand) => ({ value: brand, label: brand }))));
  groups.push(make("btu", "chips", BTU_BUCKETS));
  groups.push(make("voltage", "chips", facets.voltages.map((value) => ({ value, label: value }))));
  groups.push(make("unitType", "chips", facets.unitTypes.map((value) => ({ value, label: value }))));
  groups.push(make("refrigerant", "chips", facets.refrigerants.map((value) => ({ value, label: value }))));
  groups.push(make("pricing", "chips", PRICING_OPTIONS));
  groups.push(make("stock", "chips", STOCK_OPTIONS));

  const ordered = task
    ? task.facets
        .map((key) => groups.find((group) => group.key === key))
        .filter((group): group is FilterGroup => Boolean(group))
        .concat(groups.filter((group) => !task.facets.includes(group.key) && selectedValues(filters, group.key).length > 0))
    : groups;

  return ordered
    .filter((group) => {
      if (group.key === "category" && !showCategory) return selectedValues(filters, "category").length > 0;
      const reachable = group.options.filter((option) => !option.disabled).length;
      return reachable > 1 || selectedValues(filters, group.key).length > 0;
    })
    .map((group) => {
      // Within a group that only survives because of its selection, show what
      // is selected and what is reachable; hide dead options.
      const selected = selectedValues(filters, group.key);
      const reachable = group.options.filter((option) => !option.disabled).length;
      return reachable > 1 ? group : { ...group, options: group.options.filter((option) => !option.disabled || selected.includes(option.value)) };
    });
}

export function FilterPanel({
  groups,
  filters,
  onToggle,
  idPrefix,
}: {
  groups: FilterGroup[];
  filters: AppliedFilters;
  onToggle: (key: FacetKey, value: string) => void;
  /** Distinguishes the sidebar's controls from the sheet's when both mount. */
  idPrefix: string;
}) {
  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const selected = selectedValues(filters, group.key);
        return (
          <fieldset key={group.key} className="min-w-0 border-0 p-0">
            <legend className="mb-3 p-0 text-meta font-medium text-ink-2">{group.label}</legend>
            {group.control === "checkbox" ? (
              <div className="space-y-0.5">
                {group.options.map((option) => {
                  const isOn = selected.includes(option.value);
                  const id = `${idPrefix}-${group.key}-${option.value}`.replace(/[^a-zA-Z0-9_-]/g, "_");
                  return (
                    <label
                      key={option.value}
                      htmlFor={id}
                      className={`grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-1 text-item ${
                        option.disabled && !isOn ? "cursor-not-allowed text-ink-4" : "cursor-pointer text-ink-1"
                      }`}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={isOn}
                        disabled={option.disabled && !isOn}
                        onChange={() => onToggle(group.key, option.value)}
                        className="size-4.5 shrink-0 accent-[var(--green)]"
                      />
                      <span className="min-w-0 break-words leading-snug">{option.label}</span>
                      <span className="part-number shrink-0 text-meta text-ink-3">
                        <span className="sr-only">, </span>
                        {option.count}
                        <span className="sr-only"> results</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const isOn = selected.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isOn}
                      disabled={option.disabled && !isOn}
                      onClick={() => onToggle(group.key, option.value)}
                      className={`inline-flex min-h-11 max-w-full items-center rounded-full border px-4 py-2 text-left text-item leading-snug transition-colors duration-120 ${
                        isOn
                          ? "border-brand bg-brand-tint font-medium text-ink-1"
                          : option.disabled
                            ? "cursor-not-allowed border-line text-ink-4"
                            : "border-line text-ink-1 hover:border-line-strong"
                      }`}
                    >
                      <span className="min-w-0 break-words">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

/** What is on, above the results, each one removable and named for what it removes. */
export function ActiveFilterChips({
  filters,
  onRemove,
  onClear,
}: {
  filters: AppliedFilters;
  onRemove: (key: FacetKey, value: string) => void;
  onClear: () => void;
}) {
  const active = activeFacets(filters);
  if (active.length === 0) return null;

  return (
    <ul className="mb-5 flex flex-wrap items-center gap-2" aria-label="Active filters">
      {active.map(({ key, value }) => {
        const label = facetValueLabel(key, value);
        return (
          <li key={`${key}-${value}`} className="max-w-full">
            <button
              type="button"
              onClick={() => onRemove(key, value)}
              aria-label={`Remove ${FACET_SCHEMA[key].label}: ${label}`}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-line bg-surface-1 py-1 pl-3 pr-2.5 text-left text-meta text-ink-1 transition-colors duration-120 hover:border-line-strong"
            >
              <span className="min-w-0 break-words">
                <span className="text-ink-3">{FACET_SCHEMA[key].label}:</span> {label}
              </span>
              <X size={14} aria-hidden="true" className="shrink-0" />
            </button>
          </li>
        );
      })}
      <li>
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 px-1 text-meta font-medium text-ink-2 underline underline-offset-4 transition-colors duration-120 hover:text-ink-1"
        >
          Clear all
        </button>
      </li>
    </ul>
  );
}
