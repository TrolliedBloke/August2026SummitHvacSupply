"use client";

import * as React from "react";
import { Check, Minus, Plus } from "lucide-react";
import { MAX_CART_QUANTITY, useQuote } from "./quote-context";
import type { StorefrontSku } from "@/lib/storefront/catalog";

export function ProductPurchasePanel({ sku }: { sku: StorefrontSku }) {
  const { add, setQty } = useQuote();
  const [quantity, setQuantity] = React.useState(1);
  const [message, setMessage] = React.useState("");

  function addItem(reserve: boolean) {
    add({ skuId: sku.id, sku: sku.sku, modelNumber: sku.modelNumber, title: sku.title, image: sku.image, unitPrice: sku.msrp, available: sku.available });
    setQty(sku.id, quantity);
    setMessage(reserve ? `${quantity} reserved for pickup in Newark` : `${quantity} added to cart`);
  }

  return (
    <div>
      <div className="flex items-end gap-3">
        <label className="block w-28 text-sm text-ink-2">
          Quantity
          <span className="mt-1 flex h-12 items-center rounded-(--r-sm) border border-line bg-surface-1">
            <button type="button" aria-label="Decrease quantity" className="grid h-full min-w-11 place-items-center" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={15} /></button>
            <input aria-label="Quantity" inputMode="numeric" min={1} max={MAX_CART_QUANTITY} value={quantity} onChange={(event) => setQuantity(Math.min(MAX_CART_QUANTITY, Math.max(1, Number(event.target.value) || 1)))} className="min-w-0 flex-1 bg-transparent text-center font-mono text-sm outline-none" />
            <button type="button" aria-label="Increase quantity" className="grid h-full w-11 place-items-center" onClick={() => setQuantity((value) => Math.min(MAX_CART_QUANTITY, value + 1))}><Plus size={15} /></button>
          </span>
        </label>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => addItem(true)} className="h-12 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">Reserve for pickup</button>
          <button type="button" onClick={() => addItem(false)} className="h-12 rounded-(--r-sm) border border-ink-1 bg-surface-1 px-4 text-sm font-medium text-ink-1">Add to cart</button>
        </div>
      </div>
      {message && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-stock-ready"><Check size={15} />{message}</p>}
    </div>
  );
}
