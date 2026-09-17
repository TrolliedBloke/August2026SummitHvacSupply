"use client";

import * as React from "react";

import { formatCutoffHour } from "@/lib/site";

const TIME_ZONE = "America/Los_Angeles";

function pacificClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: value("hour"), minute: value("minute"), second: value("second") };
}

type CountdownLabel = { caption: string; value: string };

/**
 * Split into a small caption and a short value.
 *
 * As one display-size string this overflowed: "Order tomorrow before 2:00 PM"
 * measured 404px inside a 382px card and was set to xl:whitespace-nowrap, so it
 * ran past the card border instead of wrapping. It also changed font size
 * between states, so the card visibly jumped as the clock crossed the cutoff.
 *
 * The caption absorbs all the variable length at small type where wrapping is
 * harmless; the value is never longer than "2:00 PM", so one display size fits
 * every state at every width.
 */
function deliveryLabel(cutoffHour: number): CountdownLabel {
  const { hour, minute, second } = pacificClock(new Date());
  const secondsRemaining = cutoffHour * 60 * 60 - (hour * 60 * 60 + minute * 60 + second);
  if (secondsRemaining <= 0) {
    return { caption: "Order tomorrow before", value: formatCutoff(cutoffHour) };
  }
  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  return { caption: "Order within", value: `${hours}h ${minutes}m` };
}

// Re-exported from site.ts so this component and /delivery render the cutoff
// identically; a second local copy is how the two drifted apart before.
const formatCutoff = formatCutoffHour;

export function DeliveryCountdown({ cutoffHour = 14 }: { cutoffHour?: number }) {
  // The stable server/client fallback prevents a clock-dependent hydration
  // mismatch. The live Pacific-time value replaces it immediately after mount.
  const [label, setLabel] = React.useState<CountdownLabel>({
    caption: "Order before",
    value: formatCutoff(cutoffHour),
  });

  React.useEffect(() => {
    const update = () => setLabel(deliveryLabel(cutoffHour));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [cutoffHour]);

  return (
    <p className="mt-1.5 min-w-0" aria-live="polite">
      <span className="block text-xs leading-5 text-ink-2">{label.caption}</span>
      <span className="part-number block text-[1.5rem] leading-none text-ink-1 sm:text-[1.65rem]">
        {label.value}
      </span>
    </p>
  );
}
