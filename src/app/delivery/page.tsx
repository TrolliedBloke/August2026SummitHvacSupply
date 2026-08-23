import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MapPin, PackageCheck, Truck } from "lucide-react";
import { Container } from "@/components/ui";
import { pageMetadata } from "@/lib/seo/metadata";
import { FULFILLMENT, SITE } from "@/lib/site";

/**
 * Delivery and pickup terms.
 *
 * TODO(summit-ops): every figure on this page is shaped to the right length so
 * the layout is real, but NONE of it is confirmed by the counter. Each unset
 * term is marked inline. Replace them all before launch, or delete the section.
 * Do not let a placeholder radius, fee, or cutoff ship as a commitment.
 */

export const metadata: Metadata = pageMetadata({
  title: "Bay Area Delivery & Newark Will-Call",
  description:
    "Delivery zones, order cutoffs, fees, and will-call pickup terms for Summit HVAC Supply in Newark, California.",
  path: "/delivery",
});

export default function DeliveryPage() {
  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="py-12 lg:py-16">
          <h1 className="counter-heading max-w-[16ch] text-[2.4rem] leading-[0.95] text-ink-1 sm:text-[3rem]">
            Delivery and pickup
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-2">
            Two ways to take the order: pick it up at the Newark counter, or have it
            delivered on a Bay Area route. This page covers the terms for both.
          </p>

          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            <SummaryCard
              icon={<Clock size={20} strokeWidth={1.5} />}
              title="Pickup"
              detail={FULFILLMENT.pickupReady}
            />
            <SummaryCard
              icon={<Truck size={20} strokeWidth={1.5} />}
              title="Delivery"
              detail={`Order by ${FULFILLMENT.deliveryCutoff} ${FULFILLMENT.deliveryLine}`}
            />
            <SummaryCard
              icon={<MapPin size={20} strokeWidth={1.5} />}
              title="Branch"
              detail={`${SITE.address.city}, ${SITE.address.state}`}
            />
          </div>
        </Container>
      </section>

      <Container className="py-10 lg:py-14">
        <div className="flex max-w-3xl flex-col gap-9">
          {/* Dev-only banner mirrors the convention in PolicyPage: review status
              is tracked in the repo and in front of the team, never in front of
              a customer deciding on a $2,500 air handler. */}
          {process.env.NODE_ENV !== "production" && (
            <div className="rounded-(--r-md) border border-line-strong bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
              <strong className="font-medium text-ink-1">Dev-only notice.</strong> The zones,
              cutoffs, fees, and thresholds below are placeholders marked with TODO comments in{" "}
              <span className="part-number">src/app/delivery/page.tsx</span>. Confirm each one with
              the counter before launch.
            </div>
          )}

          <Section title="Delivery zones">
            <p>
              Summit runs its own Bay Area routes out of the Newark branch. Coverage is
              organized in two bands: core cities served on the standard route, and outer
              cities served on a confirmed basis.
            </p>
            {/* TODO(summit-ops): confirm the real route bands and the exact city
                list for each. The split below follows SITE.serviceArea, which is
                a marketing radius, not a routing plan. */}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <ZoneCard
                name="Core route"
                cities="Newark, Fremont, Union City, Hayward, San Jose, Oakland"
                note="Standard next-day route"
              />
              <ZoneCard
                name="Extended route"
                cities="San Francisco, the Peninsula, North Bay, outer East Bay"
                note="Confirmed per order before scheduling"
              />
            </dl>
            <p className="mt-4">
              Outside these bands, equipment ships by freight carrier. Ask the counter before
              ordering so the lead time is set correctly on the quote.
            </p>
          </Section>

          <Section title="Order cutoff">
            <p>
              Orders placed and confirmed by{" "}
              <span className="part-number">{FULFILLMENT.deliveryCutoff}</span> on a business day
              are scheduled for next-day delivery. Orders confirmed after the cutoff move to the
              following route day.
            </p>
            {/* TODO(summit-ops): confirm the cutoff, whether it differs for
                equipment vs parts, and what happens on Fridays and holidays. */}
            <p className="mt-3">
              An order is confirmed when stock and payment or account terms are settled, not when
              the cart is submitted. Weekend and holiday routes are not currently scheduled.
            </p>
          </Section>

          <Section title="Fees and thresholds">
            {/* TODO(summit-ops): no delivery fee schedule or free-delivery
                threshold has been set. Do not publish a number here until it is
                real -- a wrong fee on this page is a chargeback conversation. */}
            <p>
              Delivery pricing is quoted per order and depends on the route band, the size of the
              equipment, and whether a liftgate or a second person is needed at the drop.
            </p>
            <p className="mt-3">
              The fee appears on the quote before payment. Will-call pickup at the Newark counter
              carries no delivery charge.
            </p>
          </Section>

          <Section title="Who can order delivery">
            {/* TODO(summit-ops): confirm whether delivery is open to retail
                buyers or trade accounts only, and whether that differs by
                equipment class. */}
            <p>
              Delivery is available to trade accounts and to retail buyers on confirmed equipment
              orders. Trade accounts can schedule recurring job-site drops; retail deliveries are
              scheduled one order at a time.
            </p>
            <p className="mt-3">
              A person over 18 must be present to receive and sign for equipment. Summit does not
              leave equipment unattended at a job site or a residence.
            </p>
          </Section>

          <Section title="Equipment and freight vs parts">
            <p>
              Parts and installation supplies move on the standard route and follow the cutoff
              above. Equipment behaves differently in three ways:
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                Condensers, air handlers, and furnaces are palletized and need a liftgate or a
                dock at the delivery address.
              </li>
              <li>
                Special-order and drop-ship equipment runs on manufacturer lead time, which is
                quoted per model and is not covered by the next-day cutoff.
              </li>
              <li>
                Cartons must be inspected for shipping damage at the drop. Damage noted on the
                delivery receipt is replaced under the ships-right guarantee; damage reported
                later is handled case by case.
              </li>
            </ul>
            {/* TODO(summit-ops): confirm typical lead time bands for
                special-order equipment so a buyer can plan a job around them. */}
          </Section>

          <Section title="Will-call pickup">
            <p>
              The Newark counter stages confirmed orders for pickup. Bring the order reference and
              the pickup contact name. Do not travel for stock that has not been confirmed.
            </p>
            <address className="mt-4 rounded-(--r-md) border border-line bg-surface-1 p-4 text-sm not-italic leading-6 text-ink-1">
              <span className="font-medium">{SITE.name} · Newark</span>
              <br />
              {SITE.address.street}
              <br />
              {SITE.address.city}, {SITE.address.state} {SITE.address.zip}
              <br />
              <span className="text-ink-2">Monday-Friday 7:00am-5:00pm PT</span>
              <br />
              <a
                href={FULFILLMENT.mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block underline underline-offset-4"
              >
                Directions
              </a>
            </address>
          </Section>

          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm">
            <Link href="/shipping" className="text-ink-1 underline underline-offset-4">
              Shipping &amp; returns policy
            </Link>
            <Link href="/locations/newark" className="text-ink-1 underline underline-offset-4">
              Newark branch details
            </Link>
            <a href={SITE.phoneHref} className="text-ink-1 underline underline-offset-4">
              Ask the counter: {SITE.phone}
            </a>
          </div>
        </div>
      </Container>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="counter-heading text-[1.4rem] leading-none text-ink-1">{title}</h2>
      <div className="mt-3 text-[0.98rem] leading-7 text-ink-2">{children}</div>
    </section>
  );
}

function SummaryCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-(--r-md) border border-line bg-canvas p-4">
      <p className="flex items-center gap-2.5 text-sm font-medium text-ink-1">
        <span className="text-ink-1">{icon}</span>
        {title}
      </p>
      <p className="part-number mt-2 text-sm leading-6 text-ink-2">{detail}</p>
    </div>
  );
}

function ZoneCard({ name, cities, note }: { name: string; cities: string; note: string }) {
  return (
    <div className="rounded-(--r-md) border border-line bg-surface-1 p-4">
      <dt className="flex items-center gap-2 text-sm font-medium text-ink-1">
        <PackageCheck size={16} strokeWidth={1.6} aria-hidden="true" />
        {name}
      </dt>
      <dd className="mt-2 text-sm leading-6 text-ink-2">
        {cities}
        <span className="part-number mt-1.5 block text-xs uppercase text-ink-3">{note}</span>
      </dd>
    </div>
  );
}
