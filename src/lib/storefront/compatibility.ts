/**
 * Compatibility notes for a result set (UX fix plan WS-3, WS-4).
 *
 * The catalog lists components one by one. Two things a buyer can get wrong
 * from a grid of look-alike cards: mixing refrigerants, and assuming an indoor
 * and an outdoor unit of the same capacity are a matched pair. These notes say
 * so when, and only when, the visible results actually invite the mistake.
 * They never assert that two products ARE compatible; the matched-system
 * (AHRI) listing on the product page is the only source for that.
 */

import type { StorefrontSku } from "./catalog";

export type CompatibilityNote = { id: "mixed-refrigerant" | "split-halves"; title: string; body: string };

const INDOOR = new Set(["Indoor unit", "Air handler", "Evaporator coil", "Ceiling cassette", "Furnace"]);
const OUTDOOR = new Set(["Outdoor unit"]);

export function resultCompatibilityNotes(skus: StorefrontSku[]): CompatibilityNote[] {
  if (skus.length < 2) return [];
  const notes: CompatibilityNote[] = [];

  const refrigerants = Array.from(new Set(skus.map((sku) => sku.refrigerant).filter(Boolean))).sort();
  if (refrigerants.length > 1) {
    notes.push({
      id: "mixed-refrigerant",
      title: `These results mix ${listOf(refrigerants)} equipment`,
      body: "One system runs on one refrigerant. Filter by refrigerant, or match the unit you are pairing with.",
    });
  }

  if (skus.some((sku) => INDOOR.has(sku.unitType)) && skus.some((sku) => OUTDOOR.has(sku.unitType))) {
    notes.push({
      id: "split-halves",
      title: "Indoor and outdoor units are listed separately",
      body: "A matching capacity does not make a matched pair. Check the matched system on each product page, or use the system finder.",
    });
  }
  return notes;
}

function listOf(values: string[]): string {
  if (values.length <= 2) return values.join(" and ");
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

/* Product-page compatibility -------------------------------------------- */

const PARTS_CATEGORIES = new Set(["line-sets", "controls", "installation-supplies"]);

type SystemLike = { ahriReference: string; components: StorefrontSku[] };

export type ProductCompatibility =
  | { level: "matched"; ahriReference: string; partners: StorefrontSku[] }
  | { level: "listed"; partners: StorefrontSku[]; bundleName: string | null }
  | { level: "notEstablished" }
  | { level: "notApplicable" };

/**
 * How sure we are about what this product pairs with, strongest evidence
 * first: an AHRI-rated matched system, then a pairing or bundle on Summit's
 * own inventory sheet, then nothing. "Similar capacity" is never evidence.
 */
export function productCompatibility(
  sku: StorefrontSku,
  systems: SystemLike[],
  resolve: (code: string) => StorefrontSku | undefined
): ProductCompatibility {
  const system = systems.find((candidate) => candidate.components.some((component) => component.id === sku.id));
  if (system) {
    return { level: "matched", ahriReference: system.ahriReference, partners: system.components.filter((component) => component.id !== sku.id) };
  }
  const listed = sku.compatibleOutdoorSku ? resolve(sku.compatibleOutdoorSku) : undefined;
  if (listed || sku.bundleName) {
    return { level: "listed", partners: listed && listed.id !== sku.id ? [listed] : [], bundleName: sku.bundleName };
  }
  if (PARTS_CATEGORIES.has(sku.category)) return { level: "notApplicable" };
  return { level: "notEstablished" };
}

/** Words for each level, shared by the decision panel and its evidence section. */
export function compatibilitySummary(compatibility: ProductCompatibility, refrigerant: string): { label: string; detail: string } {
  const gas = refrigerant ? ` Pair only with ${refrigerant} equipment.` : "";
  switch (compatibility.level) {
    case "matched":
      return { label: "Matched system on file", detail: `Rated as a matched pair under AHRI ${compatibility.ahriReference}.${gas}` };
    case "listed":
      return {
        label: "Listed pairing, confirm before ordering",
        detail: `${compatibility.bundleName ? `Sold as part of ${compatibility.bundleName}. ` : ""}This pairing comes from our inventory records, not an AHRI certificate. The counter confirms it before quoting.${gas}`,
      };
    case "notEstablished":
      return {
        label: "Compatibility not established",
        detail: `No matched system is on file for this unit. Similar capacity does not make a match; ask the counter or use the system finder.${gas}`,
      };
    case "notApplicable":
      return { label: "Check fit against your equipment", detail: "Confirm size and rating against the equipment's installation manual." };
  }
}
