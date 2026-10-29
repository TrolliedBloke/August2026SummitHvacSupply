"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import { lineFor } from "./add-to-quote";
import type { StorefrontSku } from "@/lib/storefront/catalog";
import { presentCommerceState, publicCommerceState, type CommerceState } from "@/lib/commerce/state";

/* Mobile-only sticky purchase bar -- keeps price + CTA in reach on long PDPs.
   Price, status and action come from the same CommerceState as the page, so
   the bar can never offer a cart the page above it does not.
   Renders its own end-of-flow spacer so the fixed bar never covers content. */
export function StickyBuyBar({ sku, state: stateProp }: { sku: StorefrontSku; state?: CommerceState }) {
  const { add } = useQuote();
  const [added, setAdded] = React.useState(false);
  const state = stateProp ?? publicCommerceState(sku);
  const view = presentCommerceState(state);

  if (view.action.intent === "notify") return null;

  function addLine() {
    add(lineFor(sku, state));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <>
      <div className="h-20 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex w-full max-w-[var(--page-max)] items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-3">{view.statusLabel}</p>
            <p className="tnum text-lg font-medium leading-tight text-ink-1">{view.priceText ?? view.priceFallback}</p>
          </div>
          <button
            type="button"
            onClick={addLine}
            aria-label={`${view.action.verb} ${sku.title}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink"
          >
            {added && <Check size={16} aria-hidden="true" />}
            {added ? view.action.addedLabel : view.action.label}
          </button>
        </div>
      </div>
    </>
  );
}
