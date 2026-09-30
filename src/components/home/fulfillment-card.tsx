import Link from "next/link";
import { Clock } from "lucide-react";
import { branchStatus, orderByLine } from "@/lib/branch-hours";
import { FULFILLMENT, SITE } from "@/lib/site";

/**
 * The Newark branch card in the landing page rail.
 *
 * Reads top to bottom the way someone deciding between pickup and delivery
 * reads it: which branch and is it open, then the delivery promise, then the
 * pickup alternative, then where to drive.
 *
 * Every time and weekday is derived (see branch-hours.ts). The order-by line
 * was a live countdown in 24px mono; the reference states the commitment
 * instead ("Order by 2 PM Wed, arrives Thu"), which does not change as the
 * clock ticks and so cannot disagree with itself between two paints.
 *
 * The address closes the card. Someone weighing pickup against delivery is
 * deciding whether the drive is worth it, and that question cannot be answered
 * without knowing where the counter is.
 */
export function FulfillmentCard() {
  const status = branchStatus();

  return (
    <article className="h-full min-w-0 rounded-(--r-md) border border-line bg-surface-1 p-7">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lead font-semibold text-ink-1">Newark branch</h2>
        <p className="flex shrink-0 items-center gap-2 text-meta text-ink-2">
          <span
            className={`size-2 shrink-0 rounded-full ${status.open ? "bg-brand" : "bg-ink-4"}`}
            aria-hidden="true"
          />
          {status.label}
        </p>
      </div>

      <hr className="my-7 border-0 border-t border-line" />

      <Link
        href="/delivery"
        className="block text-lead font-semibold text-ink-1 transition-colors duration-120 hover:text-brand"
      >
        {orderByLine(FULFILLMENT.deliveryCutoffHour)}
      </Link>
      <p className="mt-5 flex items-center gap-3 text-base text-ink-1">
        <Clock size={17} strokeWidth={1.6} aria-hidden="true" />
        {FULFILLMENT.pickupReady}
      </p>

      <hr className="my-7 border-0 border-t border-line" />

      <address className="text-meta not-italic leading-6 text-ink-2">
        {SITE.address.street}
        <br />
        {SITE.address.city}, {SITE.address.state} {SITE.address.zip}
        {" · "}
        <a
          href={FULFILLMENT.mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-1 underline underline-offset-4 transition-colors duration-120 hover:text-brand"
        >
          Directions
        </a>
      </address>
    </article>
  );
}
