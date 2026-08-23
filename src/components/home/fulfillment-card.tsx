import Link from "next/link";
import { Clock, Truck } from "lucide-react";
import { FULFILLMENT, SITE } from "@/lib/site";

/**
 * The Newark branch card in the landing page rail.
 *
 * This card used to be titled "Newark will-call" and carried a single pickup
 * line, which read as pickup-only: the page named will-call three times and
 * delivery zero times. It now carries both fulfillment methods as two labeled
 * rows sharing one card, so a visitor choosing between them sees the same
 * level of detail for each.
 */
export function FulfillmentCard({ open = true }: { open?: boolean }) {
  return (
    <article className="rounded-(--r-md) border border-line bg-surface-1 p-3.5">
      <h2 className="counter-heading text-[1.25rem] leading-none text-ink-1">Newark branch</h2>

      <p className="part-number mt-2.5 flex items-center gap-2.5 text-sm text-ink-1">
        <span
          className={`size-2.5 shrink-0 rounded-full ${open ? "bg-brand" : "bg-ink-4"}`}
          aria-hidden="true"
        />
        {open ? "Open until 5:00 PM" : "Closed · opens 7:00 AM"}
      </p>

      <div className="mt-2.5 flex flex-col">
        <FulfillmentRow
          label="Pickup"
          icon={<Clock size={17} strokeWidth={1.6} aria-hidden="true" />}
          detail={FULFILLMENT.pickupReady}
        />
        <hr className="my-2 border-0 border-t border-line" />
        <FulfillmentRow
          label="Delivery"
          icon={<Truck size={17} strokeWidth={1.6} aria-hidden="true" />}
          detail={`Order by ${FULFILLMENT.deliveryCutoff} ${FULFILLMENT.deliveryLine}`}
        />
      </div>

      {/* The address was missing from the page entirely. Once a visitor is
          choosing between pickup and delivery, "where is it" is part of the
          choice, not a detail for the locations page. */}
      <address className="mt-2.5 border-t border-line pt-2.5 text-sm not-italic leading-5 text-ink-2">
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

      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href="/locations/newark" className="text-sm text-ink-1 underline underline-offset-4">
          Change location
        </Link>
        <Link href="/delivery" className="text-sm text-ink-1 underline underline-offset-4">
          Delivery details
        </Link>
      </div>
    </article>
  );
}

function FulfillmentRow({
  label,
  icon,
  detail,
}: {
  label: string;
  icon: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[17px_minmax(0,1fr)] items-start gap-x-3">
      <span className="mt-0.5 text-ink-1">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-4 text-ink-3">{label}</p>
        <p className="part-number text-[13px] leading-5 text-ink-1">{detail}</p>
      </div>
    </div>
  );
}
