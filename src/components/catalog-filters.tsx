"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  filterStorefrontSkus,
  getCatalogFacets,
  type CatalogFilters,
  type StorefrontSku,
} from "@/lib/storefront/catalog";

type Facets = ReturnType<typeof getCatalogFacets>;

export type FilterKey = keyof Pick<
  CatalogFilters,
  "category" | "brand" | "btu" | "voltage" | "unitType" | "refrigerant" | "pricing" | "stock"
>;

type Option = { value: string; label: string; count: number; disabled: boolean };
type Group = { key: FilterKey; label: string; control: "chips" | "checkbox"; options: Option[] };

const BTU_BUCKETS = [
  { value: "small", label: "Up to 12k" },
  { value: "mid", label: "18k – 36k" },
  { value: "large", label: "36k+" },
];

const PRICING = [
  { value: "priced", label: "Published price" },
  { value: "quote", label: "Request price" },
];

const STOCK = [
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "unknown", label: "Confirm at order" },
  { value: "out_of_stock", label: "Out of stock" },
];

/**
 * How many results an option would return, with every *other* filter still
 * applied. This is what makes a disabled option trustworthy: it is disabled
 * because picking it leads to an empty page, not because it is unpopular.
 *
 * Brand is multi-select, so its count is measured by adding the value to the
 * current selection rather than replacing it.
 */
function countFor(
  key: FilterKey,
  value: string,
  filters: CatalogFilters,
  skus: StorefrontSku[]
): number {
  if (key === "brand") {
    const current = splitMulti(filters.brand);
    const next = current.includes(value) ? current : [...current, value];
    return filterStorefrontSkus({ ...filters, brand: next.join(",") }, skus).length;
  }
  return filterStorefrontSkus({ ...filters, [key]: value } as CatalogFilters, skus).length;
}

export function splitMulti(value?: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

/**
 * The groups worth showing for the current result set.
 *
 * Category only appears on All products and on search results: on a category
 * page it just offers to undo the page you are on, and the active-filter chips
 * above the results already do that.
 *
 * Every other group is dropped when it has fewer than two options that lead
 * anywhere, which is also what makes the set follow the category: line sets
 * carry no BTU rating, so Capacity disappears there without a per-category
 * list to maintain.
 */
export function buildGroups({
  facets,
  filters,
  skus,
  showCategory,
}: {
  facets: Facets;
  filters: CatalogFilters;
  skus: StorefrontSku[];
  showCategory: boolean;
}): Group[] {
  const make = (key: FilterKey, label: string, control: Group["control"], raw: Array<{ value: string; label: string }>): Group => {
    const options = raw.map((option) => {
      const count = countFor(key, option.value, filters, skus);
      return { ...option, count, disabled: count === 0 };
    });
    return { key, label, control, options };
  };

  const groups: Group[] = [];
  if (showCategory) {
    groups.push(
      make(
        "category",
        "Category",
        "chips",
        facets.categories.map((category) => ({ value: category.value, label: category.label }))
      )
    );
  }
  groups.push(make("brand", "Brand", "checkbox", facets.brands.map((brand) => ({ value: brand, label: brand }))));
  groups.push(make("btu", "Capacity", "chips", BTU_BUCKETS));
  groups.push(make("voltage", "Voltage", "chips", facets.voltages.map((v) => ({ value: v, label: v }))));
  groups.push(make("unitType", "Unit type", "chips", facets.unitTypes.map((u) => ({ value: u, label: u }))));
  groups.push(make("refrigerant", "Refrigerant", "chips", facets.refrigerants.map((r) => ({ value: r, label: r }))));
  groups.push(make("pricing", "Pricing", "chips", PRICING));
  groups.push(make("stock", "Stock", "chips", STOCK));

  // A group with one reachable option cannot narrow anything.
  return groups.filter((group) => group.options.filter((option) => !option.disabled).length > 1);
}

export function FilterPanel({
  groups,
  filters,
  onToggle,
}: {
  groups: Group[];
  filters: CatalogFilters;
  onToggle: (key: FilterKey, value: string) => void;
}) {
  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const selected = group.key === "brand" ? splitMulti(filters.brand) : [String(filters[group.key] ?? "")];
        return (
          <fieldset key={group.key} className="border-0 p-0">
            <legend className="mb-3 p-0 text-meta font-medium text-ink-2">{group.label}</legend>
            {group.control === "checkbox" ? (
              <div className="space-y-1">
                {group.options.map((option) => {
                  const isOn = selected.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex min-h-11 items-center gap-3 text-item ${
                        option.disabled && !isOn ? "cursor-not-allowed text-ink-4" : "cursor-pointer text-ink-1"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isOn}
                        disabled={option.disabled && !isOn}
                        onChange={() => onToggle(group.key, option.value)}
                        className="size-4.5 shrink-0 accent-[var(--green)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      <span className="part-number shrink-0 text-meta text-ink-3">{option.count}</span>
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
                      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-item transition-colors duration-120 ${
                        isOn
                          ? "border-brand bg-brand-tint font-medium text-ink-1"
                          : option.disabled
                            ? "cursor-not-allowed border-line text-ink-4"
                            : "border-line text-ink-1 hover:border-line-strong"
                      }`}
                    >
                      {option.label}
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

/** What is on, above the results, each one removable. */
export function ActiveFilterChips({
  filters,
  labelFor,
  onRemove,
  onClear,
}: {
  filters: CatalogFilters;
  labelFor: (key: FilterKey, value: string) => string;
  onRemove: (key: FilterKey, value: string) => void;
  onClear: () => void;
}) {
  const active: Array<{ key: FilterKey; value: string }> = [];
  (Object.keys(filters) as Array<keyof CatalogFilters>).forEach((key) => {
    if (key === "q") return;
    const value = filters[key];
    if (!value || value === "all") return;
    if (key === "brand") splitMulti(String(value)).forEach((one) => active.push({ key: "brand", value: one }));
    else active.push({ key: key as FilterKey, value: String(value) });
  });

  if (active.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {active.map(({ key, value }) => (
        <button
          key={`${key}-${value}`}
          type="button"
          onClick={() => onRemove(key, value)}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface-1 py-1 pl-3 pr-2 text-meta text-ink-1 transition-colors duration-120 hover:border-line-strong"
        >
          {labelFor(key, value)}
          <X size={14} aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="min-h-9 px-1 text-meta font-medium text-ink-2 underline underline-offset-4 transition-colors duration-120 hover:text-ink-1"
      >
        Clear all
      </button>
    </div>
  );
}
