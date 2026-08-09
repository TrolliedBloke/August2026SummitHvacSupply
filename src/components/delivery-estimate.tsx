"use client";

import { CalendarCheck } from "lucide-react";
import * as React from "react";

/* Concrete delivery date for the buy box -- "ships today" is a policy,
   "Get it by Thu, Jul 16" is a promise, and promises convert. Computed on the
   client after mount (the pages are statically generated, so a server-rendered
   date would go stale and mismatch on hydration). */

const CUTOFF_HOUR_PT = 14; // orders by 2:00p PT ship/stage same day
const DELIVERY_BUSINESS_DAYS = 2; // middle of the quoted 1–3 day window

function nextBusinessDay(from: Date): Date {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

function addBusinessDays(from: Date, days: number): Date {
  let d = new Date(from);
  for (let i = 0; i < days; i++) d = nextBusinessDay(d);
  return d;
}

export function DeliveryEstimate({ inStock = true }: { inStock?: boolean }) {
  // Render only after mount -- pages are static, so a server-computed date
  // would go stale and mismatch on hydration.
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    () => true,
    () => false
  );

  if (!mounted || !inStock) return null;
  const now = new Date();

  const ptHour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }).format(now)
  );
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  const shipsToday = isWeekday && ptHour < CUTOFF_HOUR_PT;
  const shipDay = shipsToday ? now : nextBusinessDay(now);
  const deliveryBy = addBusinessDays(shipDay, DELIVERY_BUSINESS_DAYS);

  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });

  return (
    <p className="mt-3 flex items-start gap-2 text-sm text-ink-2">
      <CalendarCheck size={16} className="mt-0.5 shrink-0 text-brand" />
      <span>
        Get it by <span className="font-semibold text-ink-1">{fmt.format(deliveryBy)}</span> with
        Bay Area delivery, or pick up {shipsToday ? "today" : fmt.format(shipDay)} at Newark
        will-call{shipsToday ? " (order by 2:00p PT)" : ""}.
      </span>
    </p>
  );
}
