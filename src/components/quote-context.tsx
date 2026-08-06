"use client";

import * as React from "react";

/* The quote list is the contractor's working cart — but it never "checks out".
   It collects SKUs to request pricing/availability on. Persisted to
   localStorage so a contractor building a job over the day doesn't lose it. */

export type QuoteItem = {
  skuId: string;
  sku: string;
  modelNumber: string;
  title: string;
  image: string;
  unitPrice: number;
  available: number;
  qty: number;
};

type QuoteState = {
  items: QuoteItem[];
  isOpen: boolean;
  count: number;
  add: (item: Omit<QuoteItem, "qty">) => void;
  remove: (skuId: string) => void;
  setQty: (skuId: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const QuoteCtx = React.createContext<QuoteState | null>(null);
const STORAGE_KEY = "summit-quote-v1";
export const MAX_CART_QUANTITY = 200;

function readStoredItems(): QuoteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QuoteItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as QuoteItem).skuId === "string" &&
        typeof (item as QuoteItem).sku === "string" &&
        typeof (item as QuoteItem).modelNumber === "string" &&
        typeof (item as QuoteItem).title === "string" &&
        typeof (item as QuoteItem).image === "string" &&
        typeof (item as QuoteItem).unitPrice === "number" &&
        typeof (item as QuoteItem).available === "number" &&
        typeof (item as QuoteItem).qty === "number" &&
        Number.isInteger((item as QuoteItem).qty) &&
        (item as QuoteItem).qty >= 1 &&
        (item as QuoteItem).qty <= MAX_CART_QUANTITY &&
        Number.isFinite((item as QuoteItem).unitPrice) &&
        Number.isFinite((item as QuoteItem).available)
    );
  } catch {
    return [];
  }
}

export function QuoteProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<QuoteItem[]>(readStoredItems);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = React.useCallback((item: Omit<QuoteItem, "qty">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.skuId === item.skuId);
      if (existing) {
        return prev.map((i) =>
          i.skuId === item.skuId
            ? { ...i, ...item, qty: Math.min(MAX_CART_QUANTITY, i.qty + 1) }
            : i
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
    setIsOpen(true);
  }, []);

  const remove = React.useCallback((skuId: string) => {
    setItems((prev) => prev.filter((i) => i.skuId !== skuId));
  }, []);

  const setQty = React.useCallback((skuId: string, qty: number) => {
    // NaN or junk input must never delete a line item — keep the prior qty.
    if (!Number.isFinite(qty)) return;
    setItems((prev) =>
      prev.map((i) =>
        i.skuId === skuId
          ? { ...i, qty: Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(qty))) }
          : i
      )
    );
  }, []);

  const clear = React.useCallback(() => setItems([]), []);
  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => setIsOpen((o) => !o), []);

  const count = items.reduce((n, i) => n + i.qty, 0);

  const value: QuoteState = {
    items,
    isOpen,
    count,
    add,
    remove,
    setQty,
    clear,
    open,
    close,
    toggle,
  };

  return <QuoteCtx.Provider value={value}>{children}</QuoteCtx.Provider>;
}

export function useQuote(): QuoteState {
  const ctx = React.useContext(QuoteCtx);
  if (!ctx) throw new Error("useQuote must be used within QuoteProvider");
  return ctx;
}
