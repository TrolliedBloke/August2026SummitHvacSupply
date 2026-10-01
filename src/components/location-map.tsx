"use client";

import * as React from "react";
import { MapPin, Navigation } from "lucide-react";

export function LocationMap({ address, directionsHref }: { address: string; directionsHref: string }) {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <div className="overflow-hidden rounded-(--r-md) border border-line bg-surface-2">
      {loaded ? (
        <iframe
          title={`Map showing Summit HVAC Supply at ${address}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
          className="h-[360px] w-full"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center sm:min-h-[360px]">
          <span className="grid size-12 place-items-center rounded-full bg-brand-tint text-brand"><MapPin aria-hidden="true" /></span>
          <p className="mt-4 font-semibold text-ink-1">Summit HVAC Supply — Newark</p>
          <p className="mt-1 max-w-sm text-sm text-ink-2">{address}</p>
          <button type="button" onClick={() => setLoaded(true)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1">
            <Navigation size={16} aria-hidden="true" /> Load interactive map
          </button>
          <p className="mt-3 max-w-md text-xs leading-5 text-ink-3">The map is optional and loads from Google only when requested. The address and directions remain available without it.</p>
        </div>
      )}
      <p className="border-t border-line bg-surface-1 px-4 py-3 text-sm text-ink-2">
        <a href={directionsHref} target="_blank" rel="noopener noreferrer" className="font-medium text-ink-1 underline underline-offset-4">
          Open {address} in Maps<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
