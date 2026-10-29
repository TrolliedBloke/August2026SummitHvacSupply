"use client";

import Link from "next/link";
import Image from "next/image";
import { FileText, Loader2, Minus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import * as React from "react";
import { MAX_CART_QUANTITY, useQuote, type QuoteItem } from "./quote-context";
import { Modal } from "./dialog";
import { Notice } from "./state";
import { productHref } from "@/lib/storefront/catalog";
import type { ProjectedLine } from "@/lib/commerce/projection";
import { SaveCartAsList } from "./saved-lists";

/**
 * The cart drawer: a status summary, not a checkout validator.
 *
 * Lines are grouped by what they can become. Only `cart` lines -- confirmed
 * purchasable by the server -- lead to checkout; quote, availability and
 * restock lines lead to a request the counter answers. When the drawer opens it
 * revalidates every line against the session's server projection (price,
 * stock, intent) once, shows what changed, and only then offers checkout.
 */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** Past this many lines the drawer is a summary and the full list lives on /quote. */
const DRAWER_LINE_LIMIT = 12;

type Revalidation =
  | { status: "idle" | "pending" }
  | { status: "done"; lines: Record<string, ProjectedLine>; changed: string[] }
  | { status: "error" };

export function QuoteDrawer() {
  const { items, isOpen, close, setQty, remove, clear, restore, reconcile, count } = useQuote();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const [revalidation, setRevalidation] = React.useState<Revalidation>({ status: "idle" });
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [undo, setUndo] = React.useState<QuoteItem[] | null>(null);
  const [removedNote, setRemovedNote] = React.useState("");
  const itemsRef = React.useRef(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // One controlled revalidation per open.
  const skuKey = items.map((item) => item.skuId).sort().join(",");
  React.useEffect(() => {
    if (!isOpen || !skuKey) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRevalidation({ status: "pending" });
      fetch("/api/commerce/lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuIds: skuKey.split(",") }),
        cache: "no-store",
      })
        .then(async (response) => ({ ok: response.ok, payload: await response.json() }))
        .then(({ ok, payload }) => {
          if (cancelled) return;
          if (!ok || !payload.ok) throw new Error();
          const lines: Record<string, ProjectedLine> = Object.fromEntries(
            (payload.lines as ProjectedLine[]).map((line) => [line.skuId, line])
          );
          const changed = itemsRef.current
            .filter((item) => {
              const line = lines[item.skuId];
              return line && (line.intent !== item.intent || (line.unitPrice !== item.unitPrice && item.unitPrice > 0));
            })
            .map((item) => item.skuId);
          reconcile(
            Object.values(lines).map((line) => ({
              skuId: line.skuId,
              intent: line.intent,
              unitPrice: line.unitPrice,
              available: line.available,
            }))
          );
          setRevalidation({ status: "done", lines, changed });
        })
        .catch(() => {
          if (!cancelled) setRevalidation({ status: "error" });
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Revalidate when the drawer opens or the set of products changes, not on
    // every quantity change.
  }, [isOpen, skuKey, reconcile]);

  const ready = items.filter((item) => item.intent === "cart");
  const requests = items.filter((item) => item.intent !== "cart");
  const checkoutReady = ready.length > 0 && revalidation.status === "done";
  const readySubtotal = ready.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const lines = revalidation.status === "done" ? revalidation.lines : {};

  function clearAll() {
    if (items.length > 1 && !confirmClear) {
      setConfirmClear(true);
      return;
    }
    setUndo(items);
    setConfirmClear(false);
    clear();
  }

  function removeLine(item: QuoteItem) {
    // Keep focus in the drawer: move it to the line that takes the removed
    // one's place, or to the close button when none is left.
    const before = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-line]"));
    const position = before.findIndex((element) => element.dataset.cartLine === item.skuId);
    remove(item.skuId);
    setRemovedNote(`${item.title} removed.`);
    window.setTimeout(() => {
      const after = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-line]"));
      const target = after[Math.min(position, after.length - 1)]?.querySelector<HTMLElement>("a") ?? closeRef.current;
      target?.focus();
    }, 0);
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      labelledBy="quote-drawer-title"
      placement="right"
      initialFocusRef={closeRef}
      className={`animate-slide-in-right ${items.length > 0 && items.length <= 2 ? "sm:bottom-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2" : ""}`}
      backdropClassName="animate-fade-in bg-[var(--ink-panel)]/40"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
        <div className="flex flex-col">
          <h2 id="quote-drawer-title" className="text-lg font-semibold tracking-tight text-ink-1">
            Your cart
          </h2>
          <span className="text-xs text-ink-3">
            {count} {count === 1 ? "item" : "items"}
            {requests.length > 0 && ready.length > 0 ? ` · ${ready.length} ready for checkout` : ""}
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={() => close()}
          aria-label="Close cart"
          className="grid size-11 place-items-center rounded-(--r-sm) text-ink-2 hover:bg-surface-2 hover:text-ink-1"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <p role="status" className="sr-only">
        {removedNote}
        {revalidation.status === "done" && revalidation.changed.length > 0
          ? ` ${revalidation.changed.length} ${revalidation.changed.length === 1 ? "line was" : "lines were"} updated.`
          : ""}
      </p>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          {undo ? (
            <>
              <p className="text-sm text-ink-2">Your cart was cleared.</p>
              <button
                type="button"
                onClick={() => {
                  restore(undo);
                  setUndo(null);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium text-ink-1 hover:bg-surface-2"
              >
                <RotateCcw size={15} aria-hidden="true" /> Undo
              </button>
            </>
          ) : (
            <>
              <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-4">
                <FileText size={22} aria-hidden="true" />
              </span>
              <p className="text-sm text-ink-2">Your cart is empty. Browse equipment and supplies by exact SKU or model number.</p>
            </>
          )}
          <Link href="/products" onClick={() => close()} className="min-h-11 content-center text-sm font-medium text-brand hover:text-brand-hover">
            Browse the catalog →
          </Link>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
            {revalidation.status === "pending" && (
              <p className="mt-4 flex items-center gap-2 text-xs text-ink-3">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Checking current price and stock…
              </p>
            )}
            {revalidation.status === "error" && (
              <Notice tone="warning" className="mt-4" title="Prices and stock could not be checked">
                Checkout is paused until they can be. Your lines are saved.
              </Notice>
            )}
            {revalidation.status === "done" && revalidation.changed.length > 0 && (
              <Notice tone="info" className="mt-4" title="Some lines changed since you added them">
                The price or availability below is current. Review before you continue.
              </Notice>
            )}
            {items.length > DRAWER_LINE_LIMIT && (
              <Notice tone="info" className="mt-4">
                Showing the first {DRAWER_LINE_LIMIT} of {items.length} lines.{" "}
                <Link href="/quote" onClick={() => close()} className="font-medium text-ink-1 underline underline-offset-4">
                  Review the full list
                </Link>
              </Notice>
            )}

            {ready.length > 0 && (
              <LineGroup title="Ready for checkout">
                {ready.slice(0, DRAWER_LINE_LIMIT).map((item) => (
                  <Line key={item.skuId} item={item} line={lines[item.skuId]} changed={revalidation.status === "done" && revalidation.changed.includes(item.skuId)} onQty={setQty} onRemove={removeLine} onNavigate={() => close()} />
                ))}
              </LineGroup>
            )}
            {requests.length > 0 && (
              <LineGroup title={ready.length > 0 ? "Confirm with the counter first" : "Request from the counter"}>
                {requests.slice(0, Math.max(0, DRAWER_LINE_LIMIT - ready.length)).map((item) => (
                  <Line key={item.skuId} item={item} line={lines[item.skuId]} changed={revalidation.status === "done" && revalidation.changed.includes(item.skuId)} onQty={setQty} onRemove={removeLine} onNavigate={() => close()} />
                ))}
              </LineGroup>
            )}
          </div>

          <div className="shrink-0 border-t border-line px-5 py-3">
            <SaveCartAsList items={items} />
          </div>

          <footer className="shrink-0 border-t border-line bg-surface-2 px-5 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            {ready.length > 0 && (
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-ink-2">Checkout subtotal</span>
                <span className="tnum font-semibold text-ink-1">{usd.format(readySubtotal)}</span>
              </div>
            )}
            {ready.length > 0 && (
              <Link
                href="/checkout"
                onClick={(event) => {
                  if (!checkoutReady) event.preventDefault();
                  else close();
                }}
                aria-disabled={!checkoutReady}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-(--r-sm) bg-brand text-base font-medium text-brand-ink transition-colors hover:bg-brand-hover ${checkoutReady ? "" : "pointer-events-none opacity-50"}`}
              >
                {revalidation.status === "pending" ? "Checking…" : `Check out ${ready.length} ${ready.length === 1 ? "line" : "lines"}`}
              </Link>
            )}
            {requests.length > 0 && (
              <Link
                href="/quote"
                onClick={() => close()}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-(--r-sm) text-base font-medium transition-colors ${
                  ready.length > 0
                    ? "mt-2 border border-line-strong bg-surface-1 text-ink-1 hover:bg-surface-2"
                    : "bg-brand text-brand-ink hover:bg-brand-hover"
                }`}
              >
                Request {requests.some((item) => item.intent === "availability") ? "availability" : "pricing"}
                {ready.length > 0 ? ` for ${requests.length} ${requests.length === 1 ? "line" : "lines"}` : ""}
              </Link>
            )}
            {confirmClear ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm" role="group" aria-label="Confirm clearing the cart">
                <span className="text-ink-2">Remove all {items.length} lines?</span>
                <button type="button" onClick={clearAll} className="min-h-11 font-medium text-state-danger-ink underline underline-offset-4">
                  Clear cart
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="min-h-11 font-medium text-ink-1 underline underline-offset-4">
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" onClick={clearAll} className="mt-2 min-h-11 w-full text-center text-xs text-ink-3 hover:text-ink-1">
                Clear cart
              </button>
            )}
          </footer>
        </>
      )}
    </Modal>
  );
}

function LineGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="text-xs font-medium text-ink-3">{title}</h3>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

function Line({
  item,
  line,
  changed,
  onQty,
  onRemove,
  onNavigate,
}: {
  item: QuoteItem;
  line?: ProjectedLine;
  changed: boolean;
  onQty: (skuId: string, qty: number) => void;
  onRemove: (item: QuoteItem) => void;
  onNavigate: () => void;
}) {
  const status =
    line?.statusLabel ??
    (item.intent === "cart" ? "Ready for checkout" : item.intent === "availability" ? "Availability confirmed by the counter" : item.intent === "notify" ? "Restock alert" : "Price confirmed by the counter");
  return (
    <li data-cart-line={item.skuId} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-4">
      <div className="relative size-14 overflow-hidden rounded-(--r-sm) border border-line bg-surface-1">
        <Image src={item.image} alt="" fill sizes="56px" className="object-contain" />
      </div>
      <div className="min-w-0">
        <Link href={productHref(item)} onClick={onNavigate} className="block break-words text-sm font-semibold leading-snug text-ink-1 hover:text-brand">
          {item.title}
        </Link>
        <p className="part-number mt-0.5 break-all text-xs text-ink-3">
          {item.sku}
          {item.modelNumber ? ` · ${item.modelNumber}` : ""}
        </p>
        <p className={`mt-1 text-xs ${changed ? "font-medium text-state-warning-ink" : "text-ink-2"}`}>
          {changed && <span>Updated: </span>}
          {status}
          {item.intent === "cart" && item.unitPrice > 0 ? ` · ${usd.format(item.unitPrice)} each` : line?.priceText && item.intent !== "cart" ? ` · ${line.priceText} list` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center rounded-(--r-sm) border border-control-border bg-control-bg">
            <button
              type="button"
              onClick={() => onQty(item.skuId, item.qty - 1)}
              disabled={item.qty <= 1}
              aria-label={`Decrease quantity of ${item.title}`}
              className="grid size-11 place-items-center text-ink-2 hover:text-ink-1 disabled:text-ink-4"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="tnum w-8 text-center text-sm font-semibold text-ink-1" aria-label={`Quantity ${item.qty}`}>
              {item.qty}
            </span>
            <button
              type="button"
              onClick={() => onQty(item.skuId, Math.min(MAX_CART_QUANTITY, item.qty + 1))}
              disabled={item.qty >= MAX_CART_QUANTITY}
              aria-label={`Increase quantity of ${item.title}`}
              className="grid size-11 place-items-center text-ink-2 hover:text-ink-1 disabled:text-ink-4"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.title}`}
            className="inline-flex min-h-11 items-center gap-1 text-xs text-ink-3 hover:text-state-danger-ink"
          >
            <Trash2 size={13} aria-hidden="true" /> Remove
          </button>
        </div>
      </div>
    </li>
  );
}
