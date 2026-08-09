"use client";

import * as React from "react";
import { MapPin, Check } from "lucide-react";
import { useFulfillment } from "./fulfillment-context";

/* Compact delivery-area lookup. Product inventory remains explicitly unknown
   until staff confirms the quote. */

export function ZipGate({ className = "" }: { className?: string }) {
  const { zip, zone, setZip } = useFulfillment();
  const [draft, setDraft] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setZip(draft);
      }}
      className={`flex items-center gap-2 ${className}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">
        <MapPin size={16} strokeWidth={2.2} />
      </span>
      {zip && zone ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
          <Check size={14} className="text-eco" strokeWidth={2.5} />
          Delivery area: <span className="font-medium text-ink-1">{zone.label}</span> ({zip}). Product availability is confirmed by quote.
          <button
            type="button"
            onClick={() => {
              setZip(null);
              setDraft("");
            }}
            className="ml-1 text-ink-3 underline hover:text-ink-1"
          >
            change
          </button>
        </span>
      ) : zip ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
          {zip} is outside the local delivery area; ask about freight.
          <button type="button" onClick={() => setZip(null)} className="text-ink-3 underline hover:text-ink-1">
            change
          </button>
        </span>
      ) : (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="numeric"
            placeholder="ZIP for delivery area"
            aria-label="ZIP code"
            className="h-9 w-44 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none"
          />
          <button
            type="submit"
            className="h-9 rounded-(--r-sm) bg-brand px-3 text-sm font-medium text-brand-ink hover:bg-brand-hover"
          >
            Check area
          </button>
        </>
      )}
    </form>
  );
}
