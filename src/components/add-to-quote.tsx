"use client";

import Link from "next/link";
import { BellRing, Check, Minus, Plus } from "lucide-react";
import * as React from "react";
import { MAX_CART_QUANTITY, useQuote, type NewQuoteItem } from "./quote-context";
import { productHref, type StorefrontSku } from "@/lib/storefront/catalog";
import {
  intentFor,
  presentCommerceState,
  publicCommerceState,
  type CommerceState,
} from "@/lib/commerce/state";

/** The line a product becomes, carrying the intent its state allows. */
export function lineFor(sku: StorefrontSku, state: CommerceState = publicCommerceState(sku)): NewQuoteItem {
  const price =
    state.kind === "purchasable" || state.kind === "availabilityRequired"
      ? state.price.amount
      : state.kind === "quoteRequired"
        ? state.indicative?.amount ?? null
        : state.kind === "unavailable"
          ? state.price?.amount ?? null
          : null;
  return {
    skuId: sku.id,
    sku: sku.sku,
    modelNumber: sku.modelNumber,
    title: sku.title,
    image: sku.image,
    unitPrice: price ?? 0,
    available: sku.available,
    intent: intentFor(state),
  };
}

/* The single action that repeats across cards, product pages, and the strip.
   Its label, accessible name and destination all come from the product's
   CommerceState, so a card can never offer a cart for something checkout
   would refuse. Confirms inline (no toast). */
export function AddToQuote({
  sku,
  state: stateProp,
  size = "md",
  full = false,
  withQuantity = false,
  variant = "solid",
}: {
  sku: StorefrontSku;
  /** A session-aware state from the server projection; defaults to the public one. */
  state?: CommerceState;
  size?: "sm" | "md";
  full?: boolean;
  withQuantity?: boolean;
  variant?: "solid" | "outline";
}) {
  const { add } = useQuote();
  const [added, setAdded] = React.useState(false);
  const [quantity, setQuantity] = React.useState(1);
  const state = stateProp ?? publicCommerceState(sku);
  const presentation = presentCommerceState(state);
  const { action } = presentation;

  function handle() {
    // One mutation for the whole quantity -- not one per unit.
    add(lineFor(sku, state), quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  // min-h, not h: a label can never be clipped, whatever the state says. The
  // icon is the first thing to go on the narrowest cards.
  const sizing = size === "sm" ? "min-h-11 px-2 py-1.5 text-sm sm:px-3" : "min-h-11 px-5 py-2 text-base";
  const tone = added
    ? "border-brand bg-brand-tint text-brand"
    : variant === "outline"
      ? "border-brand bg-brand-tint text-brand hover:bg-brand hover:text-brand-ink"
      : "border-brand bg-brand text-brand-ink hover:bg-brand-hover";
  const base = `inline-flex items-center justify-center gap-2 rounded-(--r-sm) border text-center font-medium leading-tight
    transition-[background-color,color,border-color] duration-150 ease-out active:translate-y-px
    ${full || withQuantity ? "w-full" : ""} ${sizing}`;

  // A restock alert is a form, not a list line: route to the product page's
  // alert instead of putting an unbuyable item in the cart.
  if (action.intent === "notify") {
    return (
      <Link
        href={`${productHref(sku)}#restock`}
        aria-label={`${action.verb} ${sku.title}`}
        className={`${base} border-line-strong bg-surface-1 text-ink-1 hover:bg-surface-2`}
      >
        <span className="hidden sm:inline-flex" aria-hidden="true">
          <BellRing size={16} strokeWidth={2} />
        </span>
        {action.label}
      </Link>
    );
  }

  const button = (
    <button type="button" onClick={handle} aria-label={`${action.verb} ${sku.title}`} className={`${base} ${tone}`}>
      <span className="hidden sm:inline-flex" aria-hidden="true">
        {added ? <Check size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
      </span>
      {added ? action.addedLabel : action.label}
    </button>
  );

  if (!withQuantity) return button;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid h-11 w-[132px] shrink-0 grid-cols-[44px_44px_44px] overflow-hidden rounded-(--r-sm) border border-line bg-surface-1">
        <button
          type="button"
          aria-label={`Decrease quantity for ${sku.title}`}
          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          disabled={quantity === 1}
          className="grid place-items-center text-ink-1 transition-colors duration-100 hover:bg-surface-2 active:bg-line disabled:text-ink-4 disabled:active:bg-transparent"
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <output aria-label={`Quantity for ${sku.title}`} className="part-number grid place-items-center border-x border-line text-sm text-ink-1">
          {quantity}
        </output>
        <button
          type="button"
          aria-label={`Increase quantity for ${sku.title}`}
          onClick={() => setQuantity((value) => Math.min(MAX_CART_QUANTITY, value + 1))}
          className="grid place-items-center text-ink-1 transition-colors duration-100 hover:bg-surface-2 active:bg-line"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="min-w-0">{button}</div>
    </div>
  );
}
