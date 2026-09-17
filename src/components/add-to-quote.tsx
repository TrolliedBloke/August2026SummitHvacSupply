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

  // min-h rather than a fixed h, and tighter horizontal padding on the small
  // variant below sm.
  //
  // A locked height clipped the label instead of growing: at 375px the featured
  // grid is two columns of 166px, and "Check availability" plus its icon needed
  // 124px against 114px of content, so the text wrapped and the second line was
  // cut off inside the button (scrollHeight 37 vs clientHeight 34).
  //
  // min-h is the safety net -- a label can never be clipped again, whatever it
  // says. The padding and the hidden icon are what actually buy the label its
  // one line back on the narrowest cards. Grid items stretch, so cards stay
  // equal height even if one button does run to two lines.
  const sizing = size === "sm" ? "min-h-9 px-2 py-1.5 text-sm sm:px-3" : "min-h-11 px-5 py-2 text-[15px]";
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
      {/* Decorative, and the first thing to go when space is tight: on a 166px
          card it consumes 21px of a 114px content budget. The label carries the
          meaning, so it keeps the room. */}
      <span className="hidden sm:inline-flex" aria-hidden="true">
        {added ? <Check size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
      </span>
      {added ? addedLabel : label}
    </button>
  );

  if (!withQuantity) return action;

  return (
    /* Stacked, never side by side. The binding constraint is the CARD width --
       ~271px at every desktop size, because the featured grid holds four to five
       columns regardless of viewport -- not the viewport itself, so the old
       sm:flex-row never actually gained room. It squeezed the action to 107px of
       content while "Check availability" needs ~118px, so the label wrapped and
       was clipped inside a fixed h-9 button (scrollHeight 37 vs clientHeight 34).
       Stacking hands the button the full card width, which matters because the
       label is set by real purchase state and can get longer, not shorter. */
    <div className="flex flex-col gap-2">
      <div className="grid h-9 w-[94px] shrink-0 grid-cols-[32px_30px_32px] overflow-hidden rounded-(--r-sm) border border-line bg-surface-1">
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
      <div className="min-w-0">{action}</div>
    </div>
  );
}
