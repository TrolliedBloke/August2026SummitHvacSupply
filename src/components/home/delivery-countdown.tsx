"use client";

import * as React from "react";

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

function deliveryLabel(cutoffHour: number) {
  const { hour, minute, second } = pacificClock(new Date());
  const secondsRemaining = cutoffHour * 60 * 60 - (hour * 60 * 60 + minute * 60 + second);
  if (secondsRemaining <= 0) return `Order tomorrow before ${formatCutoff(cutoffHour)}`;
  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  return `Order in ${hours}h ${minutes}m`;
}

function formatCutoff(cutoffHour: number) {
  const hour = cutoffHour % 12 || 12;
  return `${hour}:00 ${cutoffHour >= 12 ? "PM" : "AM"}`;
}

export function DeliveryCountdown({ cutoffHour = 14 }: { cutoffHour?: number }) {
  // The stable server/client fallback prevents a clock-dependent hydration
  // mismatch. The live Pacific-time value replaces it immediately after mount.
  const [label, setLabel] = React.useState(`Order before ${formatCutoff(cutoffHour)}`);

  React.useEffect(() => {
    const update = () => setLabel(deliveryLabel(cutoffHour));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [cutoffHour]);

  return (
    <p
      className={`part-number mt-1.5 leading-none text-ink-1 xl:whitespace-nowrap ${
        label.startsWith("Order tomorrow") ? "text-[1.15rem] sm:text-[1.45rem]" : "text-[1.65rem] sm:text-[2rem]"
      }`}
      aria-live="polite"
    >
      {label}
    </p>
  );
}
