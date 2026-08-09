"use client";

import { RotateCw } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";

/**
 * One-click reorder from portal order history -- the load-bearing feature of
 * contractor stickiness. Reconstitutes a past order into the live cart at
 * current prices (checkout reprices server-side regardless) and surfaces
 * price changes and backorders instead of hiding them.
 */
export function BuyAgainButton({ orderId }: { orderId: string }) {
  const { add, setQty } = useQuote();
  const [state, setState] = React.useState<"idle" | "busy" | "error">("idle");
  const [notice, setNotice] = React.useState<string | null>(null);

  async function reorder() {
    setState("busy");
    setNotice(null);
    try {
      const res = await fetch("/api/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      let added = 0;
      let backordered = 0;
      let priceChanged = 0;
      for (const item of data.items as Array<{
        skuId: string; sku: string; modelNumber: string; title: string; image: string;
        qty: number; unitPrice: number; priceChanged: boolean; available: number;
      }>) {
        if (item.available <= 0) {
          backordered++;
          continue;
        }
        add({
          skuId: item.skuId,
          sku: item.sku,
          modelNumber: item.modelNumber,
          title: item.title,
          image: item.image,
          available: item.available,
          unitPrice: item.unitPrice,
        });
        if (item.qty > 1) setQty(item.skuId, item.qty);
        added++;
        if (item.priceChanged) priceChanged++;
      }
      const parts = [`${added} item${added === 1 ? "" : "s"} added to cart`];
      if (priceChanged > 0) parts.push(`${priceChanged} price${priceChanged === 1 ? "" : "s"} changed`);
      if (backordered > 0) parts.push(`${backordered} on backorder (skipped)`);
      if (data.unresolved > 0) parts.push(`${data.unresolved} no longer sold`);
      setNotice(parts.join(" · "));
      setState("idle");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reorder failed");
      setState("error");
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() => void reorder()}
        disabled={state === "busy"}
        data-conversion-hook="buy-again"
        className="inline-flex items-center gap-1.5 rounded-(--r-sm) border border-line bg-surface-1 px-2.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:border-brand disabled:opacity-50"
      >
        <RotateCw size={12} className={state === "busy" ? "animate-spin" : ""} />
        Buy again
      </button>
      {notice && (
        <p className={`mt-1 max-w-[220px] text-[11px] leading-snug ${state === "error" ? "text-danger" : "text-ink-3"}`}>
          {notice}
        </p>
      )}
    </div>
  );
}
