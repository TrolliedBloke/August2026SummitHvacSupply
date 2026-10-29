import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { BranchStatusText } from "@/components/branch-status";
import { DeliveryPromiseText } from "@/components/delivery-promise";
import { FULFILLMENT, SITE } from "@/lib/site";

/**
 * The Newark branch card in the landing page rail.
 *
 * Reads top to bottom the way someone deciding between pickup and delivery
 * reads it: which branch and is it open, then the delivery promise, then the
 * pickup alternative, then where to drive.
 *
 * Status, the order-by line and the pickup time are projections of the Branch
 * entity and the fulfillment policy -- the same calculator checkout enforces.
 * The delivery link keeps one stable name ("Delivery and pickup"); the dated
 * order-by line is its description, so the clock can change the detail
 * without renaming the control.
 */
export function FulfillmentCard() {
  return (
    <article className="h-full min-w-0 rounded-(--r-md) border border-line bg-surface-1 p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lead font-semibold text-ink-1">Newark branch</h2>
        <BranchStatusText withDot className="text-meta text-ink-2" />
      </div>

      <hr className="my-7 border-0 border-t border-line" />

      <Link
        href="/delivery"
        aria-describedby="home-delivery-detail"
        className="group inline-flex items-center gap-2 text-lead font-semibold text-ink-1 transition-colors duration-120 hover:text-brand"
      >
        Delivery and pickup
        <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" className="transition-transform duration-120 group-hover:translate-x-0.5" />
      </Link>
      <DeliveryPromiseText id="home-delivery-detail" className="mt-1.5 text-base text-ink-1" />
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
