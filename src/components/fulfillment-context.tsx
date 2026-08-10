"use client";

import * as React from "react";
import { resolveZone, type DeliveryZone } from "@/lib/backend/fulfillment";

/* The visitor's ZIP drives availability everywhere: catalog badges, product
   pages, and the checkout fulfillment step. Persisted so a contractor sets it
   once. Stored separately from the cart. */

type FulfillmentState = {
  zip: string | null;
  zone: DeliveryZone | null;
  setZip: (zip: string | null) => void;
};

const Ctx = React.createContext<FulfillmentState | null>(null);
const KEY = "summit-zip-v1";

/* localStorage as an external store.
 *
 * Reading it in a useState initialiser made the first client render disagree
 * with the server HTML for any visitor with a saved ZIP -- a real hydration
 * mismatch on /products, because the server cannot know the stored value.
 * useSyncExternalStore is the supported fix: React renders the SERVER snapshot
 * (null) during hydration and swaps to the client snapshot immediately after,
 * without a cascading setState inside an effect. */

const ZIP_EVENT = "summit-zip-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ZIP_EVENT, onChange);
  // `storage` fires when another tab changes the value, keeping tabs in sync.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ZIP_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return null;
  }
}

/** The server has no storage, so it always renders "no ZIP set". */
function getServerSnapshot(): string | null {
  return null;
}

export function FulfillmentProvider({ children }: { children: React.ReactNode }) {
  const zip = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setZip = React.useCallback((next: string | null) => {
    const clean = next ? next.replace(/[^0-9]/g, "").slice(0, 5) : null;
    try {
      if (clean && clean.length === 5) localStorage.setItem(KEY, clean);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    // Notify this tab; `storage` only fires in OTHER tabs.
    window.dispatchEvent(new Event(ZIP_EVENT));
  }, []);

  const value: FulfillmentState = {
    zip,
    zone: resolveZone(zip),
    setZip,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFulfillment(): FulfillmentState {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useFulfillment must be used within FulfillmentProvider");
  return ctx;
}
