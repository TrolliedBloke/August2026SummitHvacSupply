"use client";

import * as React from "react";
import type { LineIntent } from "@/lib/commerce/state";

/* One persisted list holds both checkout lines and counter requests. Every line
   carries the intent it was added with -- the CommerceState of the product at
   that moment -- so only `cart` lines can ever reach checkout. A positive unit
   price is no longer read as permission to buy. */

export type QuoteItem = {
  skuId: string;
  sku: string;
  modelNumber: string;
  title: string;
  image: string;
  unitPrice: number;
  available: number;
  qty: number;
  intent: LineIntent;
};

export type NewQuoteItem = Omit<QuoteItem, "qty">;

type QuoteState = {
  items: QuoteItem[];
  hydrated: boolean;
  isOpen: boolean;
  count: number;
  add: (item: NewQuoteItem, qty?: number) => void;
  /** One state update and one drawer open, however many lines. */
  addMany: (lines: Array<NewQuoteItem & { qty: number }>, options?: { open?: boolean }) => void;
  remove: (skuId: string) => void;
  setQty: (skuId: string, qty: number) => void;
  /** Apply server revalidation: intent and price follow the server, never the reverse. */
  reconcile: (updates: Array<{ skuId: string; intent: LineIntent; unitPrice: number; available: number }>) => void;
  clear: () => void;
  /** Put back a list removed by `clear` (the drawer's undo). */
  restore: (items: QuoteItem[]) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const QuoteCtx = React.createContext<QuoteState | null>(null);
export const STORAGE_KEY = "summit-quote-v2";
/** Pre-intent storage. Read once, migrated, then removed. */
export const LEGACY_STORAGE_KEY = "summit-quote-v1";
export const MAX_CART_QUANTITY = 200;
const INTENTS: ReadonlySet<string> = new Set<LineIntent>(["cart", "quote", "availability", "notify"]);

function isBaseLine(item: unknown): item is Omit<QuoteItem, "intent"> {
  const line = item as QuoteItem;
  return (
    typeof item === "object" &&
    item !== null &&
    typeof line.skuId === "string" &&
    typeof line.sku === "string" &&
    typeof line.modelNumber === "string" &&
    typeof line.title === "string" &&
    typeof line.image === "string" &&
    typeof line.unitPrice === "number" &&
    typeof line.available === "number" &&
    typeof line.qty === "number" &&
    Number.isInteger(line.qty) &&
    line.qty >= 1 &&
    line.qty <= MAX_CART_QUANTITY &&
    Number.isFinite(line.unitPrice) &&
    Number.isFinite(line.available)
  );
}

/**
 * Legacy lines carried no intent, and the old drawer treated any positive
 * price as checkout-ready. A migrated line can never be proven purchasable from
 * local data, so it becomes an availability request (priced) or a price
 * request (unpriced). The drawer's server revalidation promotes it back to a
 * cart line only if the product really is purchasable.
 */
export function migrateLegacyLine(line: Omit<QuoteItem, "intent">): QuoteItem {
  return { ...line, intent: pendingIntent(line.unitPrice) };
}

/** The intent for a line whose current state is not known locally. Never `cart`. */
export function pendingIntent(unitPrice: number): LineIntent {
  return unitPrice > 0 ? "availability" : "quote";
}

export function parseStoredItems(raw: string | null, legacyRaw: string | null): QuoteItem[] {
  const parse = (value: string | null): unknown[] => {
    if (!value) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const current = parse(raw)
    .filter(isBaseLine)
    .map((line) => {
      const intent = (line as QuoteItem).intent;
      return INTENTS.has(intent) ? ({ ...line, intent } as QuoteItem) : migrateLegacyLine(line);
    });
  if (current.length > 0 || raw) return current;
  return parse(legacyRaw).filter(isBaseLine).map(migrateLegacyLine);
}

function readStoredItems(): QuoteItem[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStoredItems(
      window.localStorage.getItem(STORAGE_KEY),
      window.localStorage.getItem(LEGACY_STORAGE_KEY)
    );
  } catch {
    return [];
  }
}

function merge(prev: QuoteItem[], incoming: Array<NewQuoteItem & { qty: number }>): QuoteItem[] {
  const next = [...prev];
  for (const line of incoming) {
    const qty = Math.max(1, Math.floor(line.qty));
    const index = next.findIndex((existing) => existing.skuId === line.skuId);
    if (index >= 0) {
      next[index] = { ...next[index], ...line, qty: Math.min(MAX_CART_QUANTITY, next[index].qty + qty) };
    } else {
      next.push({ ...line, qty: Math.min(MAX_CART_QUANTITY, qty) });
    }
  }
  return next;
}

export function QuoteProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<QuoteItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    queueMicrotask(() => {
      setItems(readStoredItems());
      setHydrated(true);
    });
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [hydrated, items]);

  const addMany = React.useCallback(
    (lines: Array<NewQuoteItem & { qty: number }>, options: { open?: boolean } = {}) => {
      if (lines.length === 0) return;
      setItems((prev) => merge(prev, lines));
      if (options.open !== false) setIsOpen(true);
    },
    []
  );

  const add = React.useCallback((item: NewQuoteItem, qty = 1) => addMany([{ ...item, qty }]), [addMany]);

  const remove = React.useCallback((skuId: string) => {
    setItems((prev) => prev.filter((i) => i.skuId !== skuId));
  }, []);

  const setQty = React.useCallback((skuId: string, qty: number) => {
    // NaN or junk input must never delete a line item -- keep the prior qty.
    if (!Number.isFinite(qty)) return;
    setItems((prev) =>
      prev.map((i) =>
        i.skuId === skuId
          ? { ...i, qty: Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(qty))) }
          : i
      )
    );
  }, []);

  const reconcile = React.useCallback(
    (updates: Array<{ skuId: string; intent: LineIntent; unitPrice: number; available: number }>) => {
      if (updates.length === 0) return;
      setItems((prev) => {
        let changed = false;
        const next = prev.map((line) => {
          const update = updates.find((candidate) => candidate.skuId === line.skuId);
          if (!update) return line;
          if (update.intent === line.intent && update.unitPrice === line.unitPrice && update.available === line.available) return line;
          changed = true;
          return { ...line, intent: update.intent, unitPrice: update.unitPrice, available: update.available };
        });
        return changed ? next : prev;
      });
    },
    []
  );

  const clear = React.useCallback(() => setItems([]), []);
  const restore = React.useCallback((saved: QuoteItem[]) => setItems(saved), []);
  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => setIsOpen((o) => !o), []);

  const count = items.reduce((n, i) => n + i.qty, 0);

  const value: QuoteState = {
    items,
    hydrated,
    isOpen,
    count,
    add,
    addMany,
    remove,
    setQty,
    reconcile,
    clear,
    restore,
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
