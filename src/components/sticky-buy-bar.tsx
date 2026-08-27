"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import { StockChip } from "./stock-badge";
import type { StorefrontSku } from "@/lib/storefront/catalog";

/* Mobile-only sticky purchase bar -- keeps price + CTA in reach on long PDPs.
   Renders its own end-of-flow spacer so the fixed bar never covers content. */
export function StickyBuyBar({
  sku,
  priceLabel,
}: {
  sku: StorefrontSku;
  priceLabel: string;
}) {
  const { add } = useQuote();
  const [added, setAdded] = React.useState(false);

  function reserve() {
    add({
      skuId: sku.id,
      sku: sku.sku,
      modelNumber: sku.modelNumber,
      title: sku.title,
      image: sku.image,
      unitPrice: sku.msrp,
      available: sku.available,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <>
      <div className="h-20 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs text-ink-3">{sku.seriesName}</p>
              <StockChip
                status={sku.availabilityStatus}
                available={sku.available}
                verified={sku.availabilityVerified}
                compact
                className="shrink-0"
              />
            </div>
            <p className="tnum font-display text-lg font-medium leading-tight text-ink-1">
              {priceLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={reserve}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink"
          >
            {added && <Check size={16} aria-hidden="true" />}
            {added ? "Reserved" : "Reserve for pickup"}
          </button>
        </div>
      </div>
    </>
  );
}
