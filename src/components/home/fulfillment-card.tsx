import Link from "next/link";
import { Clock } from "lucide-react";
import { DeliveryCountdown } from "@/components/home/delivery-countdown";
import { FULFILLMENT, SITE } from "@/lib/site";

/**
 * The Newark branch card in the landing page rail.
 *
 * The fold-level branch promise. Delivery leads because its cutoff is the
 * time-sensitive choice; pickup follows as the stable same-day alternative.
 *
 * The address closes the card. Someone weighing pickup against delivery is
 * deciding whether the drive is worth it, and that question cannot be answered
 * without knowing where the counter is -- which is why it belongs in the fold
 * rather than only in the branch strip further down the page.
 */
export function FulfillmentCard({ open = true }: { open?: boolean }) {
  return (
    <article className="h-full min-w-0 rounded-(--r-sm) border border-line bg-surface-1 p-5">
      <h2 className="counter-heading text-[1.15rem] leading-none text-ink-1">Newark branch</h2>

      <Link
        href="/delivery"
        className="counter-heading mt-2 inline-block text-sm tracking-[0.04em] text-brand hover:underline hover:underline-offset-4"
      >
        Next-day delivery
      </Link>
      <DeliveryCountdown cutoffHour={FULFILLMENT.deliveryCutoffHour} />

      <hr className="my-4 border-0 border-t border-line" />

      <p className="flex items-center gap-3 text-sm text-ink-1">
        <span
          className={`size-2.5 shrink-0 rounded-full ${open ? "bg-brand" : "bg-ink-4"}`}
          aria-hidden="true"
        />
        {open ? "Open until 5:00 PM" : "Closed · opens 7:00 AM"}
      </p>
      <p className="mt-3 flex items-center gap-3 text-sm text-ink-1">
        <Clock size={17} strokeWidth={1.6} aria-hidden="true" />
        <span className="part-number">{FULFILLMENT.pickupReady}</span>
      </p>

      <address className="mt-3 border-t border-line pt-3 text-xs not-italic leading-5 text-ink-2">
        {SITE.address.street}
        <br />
        {SITE.address.city}, {SITE.address.state} {SITE.address.zip}
        {" · "}
        <a
          href={FULFILLMENT.mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-1 underline underline-offset-4"
        >
          Directions
        </a>
      </address>
    </article>
  );
}
