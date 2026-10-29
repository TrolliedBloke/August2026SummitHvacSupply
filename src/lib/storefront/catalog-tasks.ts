/**
 * Catalog tasks: the job a buyer arrives with, chosen before any facet.
 *
 * A filter list answers "what attributes exist"; a buyer at a counter answers
 * "what are you here for". The task narrows the categories in play and the
 * facets worth showing, so a contractor hunting a line set never wades through
 * SEER2 and refrigerant, and someone replacing a whole system is pointed at
 * matched pairs before single components.
 *
 * The task is part of the URL (`task=`) and goes through the same codec as
 * every facet. It is a mode, not a filter chip: clearing filters keeps it.
 */

import type { CatalogCategory } from "./catalog";
import type { FacetKey } from "./filter-codec";

export type CatalogTask = "model" | "system" | "component" | "parts";

const EQUIPMENT: CatalogCategory[] = [
  "mini-splits",
  "central-heat-pumps",
  "central-air-conditioners",
  "central-systems",
  "air-handlers",
  "evaporator-coils",
  "furnaces",
  "cassettes",
];
const PARTS: CatalogCategory[] = ["line-sets", "controls", "installation-supplies"];

export type CatalogTaskDefinition = {
  value: CatalogTask;
  label: string;
  /** One line under the task row once it is chosen. */
  hint: string;
  /** null = the whole catalog. */
  categories: CatalogCategory[] | null;
  /** Facets in the order that matters for this job. Selected facets always show regardless. */
  facets: FacetKey[];
};

export const CATALOG_TASKS: CatalogTaskDefinition[] = [
  {
    value: "model",
    label: "I know the model",
    hint: "Type the model or SKU from the unit's data plate. Partial numbers work; results say why they matched.",
    categories: null,
    facets: ["brand", "category"],
  },
  {
    value: "system",
    label: "I need a complete system",
    hint: "Indoor and outdoor units must be a matched, rated pair. Start from a matched system, or let the finder pick one.",
    categories: EQUIPMENT,
    facets: ["btu", "refrigerant", "voltage", "brand", "category"],
  },
  {
    value: "component",
    label: "I need a component",
    hint: "Replacing one half of a system? Match the refrigerant and capacity of the unit it pairs with.",
    categories: EQUIPMENT,
    facets: ["category", "unitType", "btu", "refrigerant", "voltage", "brand", "pricing", "stock"],
  },
  {
    value: "parts",
    label: "I need parts and supplies",
    hint: "Line sets, controls and installation supplies.",
    categories: PARTS,
    facets: ["category", "brand", "pricing", "stock"],
  },
];

export const CATALOG_TASK_VALUES = CATALOG_TASKS.map((task) => task.value);

export function catalogTask(value: CatalogTask | null): CatalogTaskDefinition | null {
  return CATALOG_TASKS.find((task) => task.value === value) ?? null;
}
