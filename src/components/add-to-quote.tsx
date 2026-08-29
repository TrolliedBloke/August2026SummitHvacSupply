"use client";

import { Minus, Plus, Check } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import type { StorefrontSku } from "@/lib/storefront/catalog";

/* The single action that repeats across cards, product pages, and the strip.
   Confirms inline (no toast), fast, calm feedback for a field contractor. */
export function AddToQuote({
  sku,
  size = "md",
  full = false,
  withQuantity = false,
  variant = "solid",
}: {
  sku: StorefrontSku;
  size?: "sm" | "md";
  full?: boolean;
  withQuantity?: boolean;
  variant?: "solid" | "outline";
}) {
  const { add } = useQuote();
  const [added, setAdded] = React.useState(false);
  const [quantity, setQuantity] = React.useState(1);

  function handle() {
    for (let index = 0; index < quantity; index += 1) {
      add({
        skuId: sku.id,
        sku: sku.sku,
        modelNumber: sku.modelNumber,
        title: sku.title,
        image: sku.image,
        unitPrice: sku.retailPrice ?? 0,
        available: sku.available,
      });
    }
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  const sizing = size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-5 text-[15px]";
  const purchasable = sku.purchaseEligible && sku.retailPrice !== null;
  // Three states, not two. "Request price" was shown on items whose price is
  // printed directly above the button, which reads as a broken page. When the
  // price is known but the item is not yet sellable, what the buyer is actually
  // requesting is availability.
  const label = purchasable ? "Add to cart" : sku.retailPrice !== null ? "Check availability" : "Request price";
  const addedLabel = purchasable ? "Added to cart" : "Added to request";
  const ariaLabel = purchasable
    ? `Add ${sku.title} to cart`
    : sku.retailPrice !== null
      ? `Check availability for ${sku.title}`
      : `Request price for ${sku.title}`;

  const action = (
    <button
      onClick={handle}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 rounded-(--r-sm) border font-medium
        transition-[background-color,color,border-color] duration-150 ease-out active:translate-y-px
        ${full || withQuantity ? "w-full" : ""} ${sizing}
        ${
          added
            ? "border-brand bg-brand-tint text-brand"
            : variant === "outline"
              ? "border-brand bg-brand-tint text-brand hover:bg-brand hover:text-brand-ink"
              : "border-brand bg-brand text-brand-ink hover:bg-brand-hover"
        }`}
    >
      {added ? <Check size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
      {added ? addedLabel : label}
    </button>
  );

  if (!withQuantity) return action;

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row">
      <div className="grid h-9 shrink-0 grid-cols-[32px_30px_32px] overflow-hidden rounded-(--r-sm) border border-line bg-surface-1">
        <button
          type="button"
          aria-label={`Decrease quantity for ${sku.title}`}
          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          disabled={quantity === 1}
          className="grid place-items-center text-ink-1 transition-colors hover:bg-surface-2 disabled:text-ink-4"
        >
          <Minus size={13} aria-hidden="true" />
        </button>
        <output aria-label={`Quantity for ${sku.title}`} className="part-number grid place-items-center border-x border-line text-xs text-ink-1">
          {quantity}
        </output>
        <button
          type="button"
          aria-label={`Increase quantity for ${sku.title}`}
          onClick={() => setQuantity((value) => Math.min(99, value + 1))}
          className="grid place-items-center text-ink-1 transition-colors hover:bg-surface-2"
        >
          <Plus size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="min-w-0 flex-1">{action}</div>
    </div>
  );
}
