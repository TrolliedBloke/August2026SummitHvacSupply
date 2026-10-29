"use client";

import * as React from "react";
import { Check, Minus, Plus } from "lucide-react";
import { MAX_CART_QUANTITY, useQuote } from "./quote-context";
import { lineFor } from "./add-to-quote";
import type { StorefrontSku } from "@/lib/storefront/catalog";
import { presentCommerceState, publicCommerceState, type CommerceState } from "@/lib/commerce/state";

/* Quantity + primary action for the PDP. The action is whatever the product's
   CommerceState allows: a cart line only when it is purchasable. */
export function ProductPurchasePanel({ sku, state: stateProp }: { sku: StorefrontSku; state?: CommerceState }) {
  const { add } = useQuote();
  const [quantity, setQuantity] = React.useState(1);
  const [message, setMessage] = React.useState("");
  const state = stateProp ?? publicCommerceState(sku);
  const view = presentCommerceState(state);

  function addItem() {
    add(lineFor(sku, state), quantity);
    setMessage(`${quantity} ${view.action.intent === "cart" ? "added to cart" : "added to your request"}`);
  }

  return (
    <div>
      <div className="flex items-end gap-3">
        <label className="block w-36 text-sm text-ink-2">
          Quantity
          <span className="mt-1 flex h-12 items-center rounded-(--r-sm) border border-line bg-surface-1">
            <button type="button" aria-label="Decrease quantity" className="grid h-full min-w-11 place-items-center" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={15} /></button>
            <input aria-label="Quantity" inputMode="numeric" min={1} max={MAX_CART_QUANTITY} value={quantity} onChange={(event) => setQuantity(Math.min(MAX_CART_QUANTITY, Math.max(1, Number(event.target.value) || 1)))} className="min-w-0 flex-1 bg-transparent text-center text-sm outline-none" />
            <button type="button" aria-label="Increase quantity" className="grid h-full min-w-11 place-items-center" onClick={() => setQuantity((value) => Math.min(MAX_CART_QUANTITY, value + 1))}><Plus size={15} /></button>
          </span>
        </label>
        <button type="button" onClick={addItem} aria-label={`${view.action.verb} ${sku.title}`} className="h-12 min-w-0 flex-1 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">{view.action.label}</button>
      </div>
      {message && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-1"><Check size={15} aria-hidden="true" />{message}</p>}
    </div>
  );
}
