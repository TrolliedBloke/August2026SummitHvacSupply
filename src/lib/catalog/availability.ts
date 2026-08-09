/**
 * Canonical availability state model.
 *
 * This module is the single source of truth for "can this product be bought?".
 * It is deliberately dependency-free so the build-time catalog importer, the
 * storefront, the checkout server path and the lifecycle emailer all derive the
 * same answer from the same rules. Any divergence between those four is how a
 * customer ends up buying something the warehouse cannot ship.
 *
 * Two distinct concepts are kept apart on purpose:
 *
 *   inventoryStatus  - a PHYSICAL claim about the warehouse. Only ever set from
 *                      a verified inventory source. `unknown` means we have not
 *                      counted it, which is the current state of this catalog.
 *   AvailabilityState - a COMMERCIAL decision derived from inventory + price +
 *                      publication state. This is what the UI and checkout read.
 *
 * The rule that matters: unknown inventory is never purchasable. We do not
 * fabricate a quantity to make a product sellable.
 */

/** Physical inventory signal. Mirrors the `inventory_status` DB check constraint. */
export type InventorySignal =
  | "unknown"
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "lead_time";

/** Commercial availability. Derived; never stored as the primary truth. */
export type AvailabilityState =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "lead_time"
  | "inventory_unknown"
  | "quote_only"
  | "unavailable";

export type AvailabilityInput = {
  retailPrice: number | null;
  inventoryQuantity: number | null;
  inventoryStatus: InventorySignal;
  publicationStatus: "quote_only" | "needs_review" | "published" | "archived";
  minimumStock?: number | null;
};

/**
 * True only when inventory has been positively established from a real source.
 * A null quantity or an `unknown` status both mean "we have not counted this".
 */
export function isInventoryVerified(input: {
  inventoryQuantity: number | null;
  inventoryStatus: InventorySignal;
}): boolean {
  return input.inventoryQuantity !== null && input.inventoryStatus !== "unknown";
}

/**
 * Derive commercial availability. Order of checks is significant: publication
 * and price gates come before inventory so an unpublished or unpriced record
 * can never be reported as a stock state.
 */
export function deriveAvailabilityState(input: AvailabilityInput): AvailabilityState {
  if (input.publicationStatus === "needs_review" || input.publicationStatus === "archived") {
    return "unavailable";
  }
  if (input.retailPrice === null || input.retailPrice <= 0) {
    return "quote_only";
  }
  if (!isInventoryVerified(input)) {
    return "inventory_unknown";
  }

  const qty = input.inventoryQuantity as number;
  if (input.inventoryStatus === "lead_time") return "lead_time";
  if (qty <= 0 || input.inventoryStatus === "out_of_stock") return "out_of_stock";

  const floor = input.minimumStock ?? 0;
  if (input.inventoryStatus === "low_stock" || (floor > 0 && qty <= floor)) return "low_stock";
  return "in_stock";
}

/**
 * The only states from which a customer may complete a self-service purchase.
 * `lead_time` is intentionally excluded: a lead time is a promise about the
 * future that this system cannot currently substantiate, so it routes to a
 * quote where a human confirms the date.
 */
const PURCHASABLE_STATES: ReadonlySet<AvailabilityState> = new Set<AvailabilityState>([
  "in_stock",
  "low_stock",
]);

export function isPurchasable(input: AvailabilityInput): boolean {
  return PURCHASABLE_STATES.has(deriveAvailabilityState(input));
}

/** Everything except an unreviewed/archived record can be quoted. */
export function isQuotable(input: AvailabilityInput): boolean {
  return deriveAvailabilityState(input) !== "unavailable";
}

/**
 * Customer-facing language. These strings are the ONLY place stock is described
 * to a customer, so that no code path can invent a claim like "in stock in
 * Newark" for a product whose quantity is unknown.
 */
export function availabilityCopy(state: AvailabilityState): {
  label: string;
  detail: string;
  claimsStock: boolean;
} {
  switch (state) {
    case "in_stock":
      return { label: "In stock", detail: "Verified on hand at the Newark warehouse.", claimsStock: true };
    case "low_stock":
      return { label: "Low stock", detail: "Verified on hand, limited quantity remaining.", claimsStock: true };
    case "out_of_stock":
      return { label: "Out of stock", detail: "Counted at zero on hand. Request a restock date.", claimsStock: false };
    case "lead_time":
      return { label: "Lead time", detail: "Not stocked locally. We confirm the date before you commit.", claimsStock: false };
    case "inventory_unknown":
      return {
        label: "Availability on request",
        detail: "We confirm availability with the warehouse before this order is accepted.",
        claimsStock: false,
      };
    case "quote_only":
      return { label: "Quote required", detail: "Priced per project. Request a quote.", claimsStock: false };
    case "unavailable":
    default:
      return { label: "Unavailable", detail: "Not currently offered.", claimsStock: false };
  }
}
