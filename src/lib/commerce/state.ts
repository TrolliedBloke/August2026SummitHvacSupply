/**
 * CommerceState: the one answer to "what can a buyer do with this product?".
 *
 * Price, stock and the primary action used to be decided separately in each
 * component, and they disagreed: a priced item that could not be sold showed
 * "Check availability" on its card while the drawer treated any positive price
 * as checkout-ready. This union makes those combinations unrepresentable. A
 * component renders `presentCommerceState(state)` and never infers purchase
 * eligibility from a price.
 *
 * `resolveCommerceState` is the only constructor. The server checkout path runs
 * the same resolver, so client state can never promote a line on its own.
 */

import type { CatalogAvailability, StorefrontSku } from "@/lib/storefront/catalog";
import type { FulfillmentMethod } from "@/lib/backend/fulfillment";
import {
  accountPrice,
  accountPriceUnavailable,
  formatPrice,
  isTradeContext,
  retailPrice,
  type AccountContext,
  type PricePresentation,
} from "./price-presentation";

export type StockClaim =
  | { kind: "verified"; status: Exclude<CatalogAvailability, "unknown">; quantity: number }
  | { kind: "unverified" };

export type CommerceState =
  | {
      kind: "purchasable";
      price: PricePresentation;
      stock: Extract<StockClaim, { kind: "verified" }>;
      fulfillment: FulfillmentMethod[];
    }
  | {
      kind: "quoteRequired";
      indicative: PricePresentation | null;
      reason: "unpriced" | "lead_time" | "bundle_component";
      stock: StockClaim;
    }
  | {
      kind: "availabilityRequired";
      price: PricePresentation;
      reason: "inventory_unverified" | "not_released_for_checkout" | "model_unconfirmed";
      stock: StockClaim;
    }
  | {
      kind: "unavailable";
      reason: "out_of_stock" | "not_offered";
      action: "notify" | "none";
      price: PricePresentation | null;
    }
  | {
      kind: "pricingUnavailable";
      reason: "account_price_unavailable";
    };

export type CommerceKind = CommerceState["kind"];

/** What a line in the cart is for. Only `cart` lines may enter checkout. */
export type LineIntent = "cart" | "quote" | "availability" | "notify";

export type CommerceInput = Pick<
  StorefrontSku,
  | "retailPrice"
  | "purchaseEligible"
  | "publicationStatus"
  | "availabilityStatus"
  | "availabilityVerified"
  | "available"
  | "researchStatus"
>;

export type PricingLookup =
  | { status: "ok"; accountAmount?: number; asOf: string; expiresAt: string | null }
  | { status: "error" };

const DEFAULT_FULFILLMENT: FulfillmentMethod[] = ["pickup", "local_delivery", "freight"];

function stockClaim(input: CommerceInput): StockClaim {
  if (!input.availabilityVerified || input.availabilityStatus === "unknown") return { kind: "unverified" };
  return { kind: "verified", status: input.availabilityStatus, quantity: input.available };
}

/**
 * Build the state from catalog, inventory, account and pricing inputs.
 *
 * Order matters: publication, then pricing failure, then price, then physical
 * stock, then the release-for-checkout flag. Nothing below "purchasable" is
 * reachable without a verified positive count AND an explicit purchase flag.
 */
export function resolveCommerceState(
  input: CommerceInput,
  {
    account = { kind: "anonymous" },
    pricing,
    fulfillment = DEFAULT_FULFILLMENT,
  }: { account?: AccountContext; pricing?: PricingLookup; fulfillment?: FulfillmentMethod[] } = {}
): CommerceState {
  const stock = stockClaim(input);

  if (input.publicationStatus === "needs_review" || input.publicationStatus === "archived") {
    return { kind: "unavailable", reason: "not_offered", action: "none", price: null };
  }

  // An approved account whose price could not be confirmed must not be shown
  // retail relabelled as its own price.
  if (isTradeContext(account) && pricing?.status === "error") {
    return { kind: "pricingUnavailable", reason: "account_price_unavailable" };
  }

  const price: PricePresentation | null =
    input.retailPrice === null || input.retailPrice <= 0
      ? null
      : isTradeContext(account) && pricing?.status === "ok" && pricing.accountAmount !== undefined
        ? accountPrice(Math.min(pricing.accountAmount, input.retailPrice), account, {
            asOf: pricing.asOf,
            expiresAt: pricing.expiresAt,
          })
        : retailPrice(input.retailPrice);

  if (!price) return { kind: "quoteRequired", indicative: null, reason: "unpriced", stock };

  if (stock.kind === "verified" && stock.status === "out_of_stock") {
    return { kind: "unavailable", reason: "out_of_stock", action: "notify", price };
  }
  if (stock.kind === "verified" && stock.status === "lead_time") {
    return { kind: "quoteRequired", indicative: price, reason: "lead_time", stock };
  }
  if (stock.kind === "unverified") {
    return {
      kind: "availabilityRequired",
      price,
      reason: input.researchStatus === "conflict" ? "model_unconfirmed" : "inventory_unverified",
      stock,
    };
  }
  if (!input.purchaseEligible || stock.quantity <= 0) {
    return { kind: "availabilityRequired", price, reason: "not_released_for_checkout", stock };
  }
  return { kind: "purchasable", price, stock, fulfillment };
}

export function intentFor(state: CommerceState): LineIntent {
  switch (state.kind) {
    case "purchasable":
      return "cart";
    case "availabilityRequired":
      return "availability";
    case "unavailable":
      return state.action === "notify" ? "notify" : "quote";
    default:
      return "quote";
  }
}

export function pricingUnavailableFallback(): PricePresentation {
  return accountPriceUnavailable();
}

export type CommercePresentation = {
  kind: CommerceKind;
  /** "$450.00", or null when there is no price to print. */
  priceText: string | null;
  /** Shown where a price would be when there is none: "Price on request". */
  priceFallback: string;
  /** "List price", "Your account price · Tier 2". */
  priceQualifier: string | null;
  /** Short status, always words: never conveyed by color alone. */
  statusLabel: string;
  statusDetail: string;
  tone: "ready" | "pending" | "blocked";
  action: {
    intent: LineIntent | "retry";
    label: string;
    /** Prefixed to the product title for the control's accessible name. */
    verb: string;
    addedLabel: string;
  };
  /** Where the line ends up: checkout, or a request the counter answers. */
  destination: "/checkout" | "/quote";
};

function stockLabel(stock: StockClaim): string | null {
  if (stock.kind !== "verified" || stock.quantity <= 0) return null;
  if (stock.status === "low_stock") return `${stock.quantity} left in Newark`;
  if (stock.status === "in_stock") return `${stock.quantity} in Newark`;
  return null;
}

export function presentCommerceState(state: CommerceState): CommercePresentation {
  switch (state.kind) {
    case "purchasable": {
      return {
        kind: state.kind,
        priceText: formatPrice(state.price),
        priceFallback: "Price on request",
        priceQualifier: state.price.tierLabel,
        statusLabel: stockLabel(state.stock) ?? "In stock",
        statusDetail: "Counted on hand at the Newark branch. We confirm the order before it ships.",
        tone: "ready",
        action: { intent: "cart", label: "Add to cart", verb: "Add to cart:", addedLabel: "Added to cart" },
        destination: "/checkout",
      };
    }
    case "availabilityRequired":
      return {
        kind: state.kind,
        priceText: formatPrice(state.price),
        priceFallback: "Price on request",
        priceQualifier: state.price.tierLabel,
        // A counted shelf is still a true statement when the item is not yet
        // released for self-service checkout.
        statusLabel: stockLabel(state.stock) ?? "Stock confirmed at order",
        statusDetail:
          state.reason === "model_unconfirmed"
            ? "We confirm the exact model and stock with the warehouse before the order is accepted."
            : "We confirm availability with the warehouse before the order is accepted.",
        tone: "pending",
        action: { intent: "availability", label: "Check availability", verb: "Check availability for", addedLabel: "Added to request" },
        destination: "/quote",
      };
    case "quoteRequired":
      return {
        kind: state.kind,
        priceText: formatPrice(state.indicative),
        priceFallback: "Price on request",
        priceQualifier: state.indicative ? "Indicative list price" : null,
        statusLabel: state.reason === "lead_time" ? "Ships on lead time" : "Quote required",
        statusDetail:
          state.reason === "lead_time"
            ? "Not stocked locally. We confirm the date and price before you commit."
            : "Priced per project. The counter replies with a written quote.",
        tone: "pending",
        action: {
          intent: "quote",
          label: state.reason === "unpriced" ? "Request price" : "Request quote",
          verb: state.reason === "unpriced" ? "Request price for" : "Request quote for",
          addedLabel: "Added to request",
        },
        destination: "/quote",
      };
    case "unavailable":
      return {
        kind: state.kind,
        priceText: formatPrice(state.price),
        priceFallback: "Not currently offered",
        priceQualifier: state.price?.tierLabel ?? null,
        statusLabel: state.reason === "out_of_stock" ? "Out of stock" : "Not currently offered",
        statusDetail:
          state.reason === "out_of_stock"
            ? "Counted at zero on hand. Get one email when it is back in Newark."
            : "This item is not available to order right now.",
        tone: "blocked",
        action:
          state.action === "notify"
            ? { intent: "notify", label: "Get restock alert", verb: "Get a restock alert for", addedLabel: "Alert requested" }
            : { intent: "quote", label: "Ask about this item", verb: "Ask about", addedLabel: "Added to request" },
        destination: "/quote",
      };
    case "pricingUnavailable":
      return {
        kind: state.kind,
        priceText: null,
        priceFallback: "Account price unavailable",
        priceQualifier: null,
        statusLabel: "Account price could not be confirmed",
        statusDetail: "Retry, or request a quote and the counter will confirm your account price.",
        tone: "blocked",
        action: { intent: "quote", label: "Request quote", verb: "Request quote for", addedLabel: "Added to request" },
        destination: "/quote",
      };
  }
}

/** Convenience for components holding a whole SKU and no session. */
export function publicCommerceState(sku: CommerceInput): CommerceState {
  return resolveCommerceState(sku);
}
