"use client";

import * as React from "react";
import { deliveryPromise } from "@/lib/backend/fulfillment";
import { deliveryPolicyIsConfirmed, FULFILLMENT_POLICY } from "@/lib/fulfillment-policy";
import { formatMinutes } from "@/lib/branch";

/**
 * "Order by 2 PM Thu, arrives Fri", from the calculator checkout enforces.
 *
 * The weekdays depend on the clock, so a cached page must not carry them: the
 * server renders the rule ("Order by 2 PM for next-day delivery"), which is
 * true at any hour, and the dated line replaces it after mount.
 */
export function DeliveryPromiseText({ id, className = "" }: { id?: string; className?: string }) {
  const confirmed = deliveryPolicyIsConfirmed();
  const [line, setLine] = React.useState(
    confirmed
      ? `Order by ${formatMinutes(FULFILLMENT_POLICY.cutoff.minutes)} for next-day delivery`
      : "Delivery timing confirmed after ZIP and stock review"
  );
  React.useEffect(() => {
    if (!confirmed) return;
    const update = () => {
      const promise = deliveryPromise();
      if (promise) setLine(promise.line);
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [confirmed]);
  return (
    <p id={id} className={className}>
      {line}
    </p>
  );
}
