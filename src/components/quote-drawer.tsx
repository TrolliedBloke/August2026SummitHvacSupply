"use client";

import Link from "next/link";
import Image from "next/image";
import { X, Minus, Plus, Trash2, FileText } from "lucide-react";
import * as React from "react";
import { MAX_CART_QUANTITY, useQuote } from "./quote-context";
import { productHref } from "@/lib/storefront/catalog";
import { SaveCartAsList } from "./saved-lists";

/* Shared cart for retail checkout and sales-assisted equipment requests. */
export function QuoteDrawer() {
  const { items, isOpen, close, setQty, remove, clear, count } = useQuote();
  const panelRef = React.useRef<HTMLElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const readyForCheckout = items.length > 0 && items.every((item) => item.unitPrice > 0);

  // Lock scroll + close on Escape while open.
  React.useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previousFocus.current?.focus();
    };
  }, [isOpen, close]);

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden={!isOpen}
        onClick={close}
        className={`fixed inset-0 z-40 bg-[var(--ink-panel)]/40 backdrop-blur-[2px] transition-opacity duration-200
          ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      {/* Panel */}
      <aside
        ref={panelRef}
        role={isOpen ? "dialog" : undefined}
        aria-labelledby={isOpen ? "quote-drawer-title" : undefined}
        aria-modal={isOpen ? "true" : undefined}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[400px] flex-col border-l border-line bg-surface-1 shadow-[var(--shadow-lg)]
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isOpen ? "translate-x-0" : "pointer-events-none translate-x-full"}`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex flex-col">
            <h2 id="quote-drawer-title" className="font-display text-lg font-semibold tracking-tight text-ink-1">
              Your cart
            </h2>
            <span className="text-xs text-ink-3">
              {count} {count === 1 ? "item" : "items"}
            </span>
          </div>
          <button
            ref={closeRef}
            onClick={close}
            aria-label="Close cart"
            className="grid size-11 place-items-center rounded-(--r-sm) text-ink-2 hover:bg-surface-2 hover:text-ink-1"
          >
            <X size={18} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-4">
              <FileText size={22} />
            </span>
            <p className="text-sm text-ink-2">
              Your cart is empty. Browse equipment and supplies by exact SKU or model number.
            </p>
            <Link
              href="/products"
              onClick={close}
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              Browse the catalog →
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-[var(--line)] overflow-y-auto px-5">
              {items.map((item) => {
                return (
                <li key={item.skuId} className="flex items-center gap-3 py-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-(--r-sm) border border-line bg-surface-2">
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={productHref(item)}
                      onClick={close}
                      className="block truncate text-sm font-semibold text-ink-1 hover:text-brand"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                      {item.sku} · {item.modelNumber}
                    </p>
                    <button
                      onClick={() => remove(item.skuId)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-danger"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                  <div className="flex items-center gap-1 rounded-(--r-sm) border border-control-border bg-control-bg">
                    <button
                      onClick={() => setQty(item.skuId, item.qty - 1)}
                      aria-label="Decrease quantity"
                      className="grid size-11 place-items-center text-ink-2 hover:text-ink-1"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="tnum w-6 text-center font-mono text-sm font-semibold text-ink-1">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => setQty(item.skuId, Math.min(MAX_CART_QUANTITY, item.qty + 1))}
                      aria-label="Increase quantity"
                      className="grid size-11 place-items-center text-ink-2 hover:text-ink-1"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </li>
              );
              })}
            </ul>

            <div className="border-t border-line px-5 py-3">
              <SaveCartAsList items={items} />
            </div>

            <footer className="border-t border-line bg-surface-2 px-5 py-4">
              <Link
                href={readyForCheckout ? "/checkout" : "/quote"}
                onClick={close}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-(--r-sm) bg-brand text-[15px] font-medium text-brand-ink shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-hover"
              >
                {readyForCheckout ? "Go to checkout" : "Request pricing"}
              </Link>
              <Link
                href="/contact"
                onClick={close}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-2"
              >
                Ask a product question
              </Link>
              <button
                onClick={clear}
                className="mt-2 w-full text-center text-xs text-ink-3 hover:text-danger"
              >
                Clear cart
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
