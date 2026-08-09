"use client";

import { Plus, Check } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import type { StorefrontSku } from "@/lib/storefront/catalog";

/* The single action that repeats across cards, product pages, and the strip.
   Confirms inline (no toast), fast, calm feedback for a field contractor. */
export function AddToQuote({
  sku,
  size = "md",
  full = false,
}: {
  sku: StorefrontSku;
  size?: "sm" | "md";
  full?: boolean;
}) {
  const { add } = useQuote();
  const [added, setAdded] = React.useState(false);

  function handle() {
    add({
      skuId: sku.id,
      sku: sku.sku,
      modelNumber: sku.modelNumber,
      title: sku.title,
      image: sku.image,
      unitPrice: sku.retailPrice ?? 0,
      available: sku.available,
    });
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

  return (
    <button
      onClick={handle}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 rounded-(--r-sm) font-medium
        transition-[background-color,box-shadow] duration-150 ease-out active:translate-y-px
        ${full ? "w-full" : ""} ${sizing}
        ${
          added
            ? "bg-eco-tint text-eco-ink"
            : "bg-brand text-brand-ink hover:bg-brand-hover shadow-[var(--shadow-sm)]"
        }`}
    >
      {added ? <Check size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
      {added ? addedLabel : label}
    </button>
  );
}
