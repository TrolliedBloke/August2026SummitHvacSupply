import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MapPin, Truck } from "lucide-react";
import { Container } from "@/components/ui";
import { BranchStatusText } from "@/components/branch-status";
import { DeliveryPromiseText } from "@/components/delivery-promise";
import { FulfillmentAnswer } from "@/components/fulfillment-answer";
import { pageMetadata } from "@/lib/seo/metadata";
import { FULFILLMENT, SITE } from "@/lib/site";
import { deliveryPolicyIsConfirmed, FULFILLMENT_POLICY, pendingPolicyRules } from "@/lib/fulfillment-policy";
import { branchExceptions, formatMinutes, NEWARK, weeklyHoursRows } from "@/lib/branch";

/**
 * Delivery and pickup, answer first.
 *
 * The ZIP answer at the top and every date, cutoff and zone below are
 * projections of the fulfillment policy and the calculator checkout enforces
 * (lib/fulfillment-policy.ts, lib/backend/fulfillment.ts). Prose that no
 * calculator enforced -- route "bands", fee schedules, who may order delivery
 * -- was removed rather than published as a commitment. /shipping owns the
 * long-form terms; this page owns the answer.
 */

export const metadata: Metadata = pageMetadata({
  title: "Bay Area Delivery & Newark Will-Call",
  description: "Check delivery to your ZIP, the order cutoff, and will-call pickup at Summit HVAC Supply in Newark, California.",
  path: "/delivery",
});

export default function DeliveryPage() {
  const deliveryConfirmed = deliveryPolicyIsConfirmed();
  const hoursConfirmed = NEWARK.hoursReview.status === "confirmed";
  const sameDay = deliveryConfirmed
    ? FULFILLMENT_POLICY.zones.list.filter((zone) => zone.leadTimeHours <= FULFILLMENT_POLICY.zones.sameDayLeadHours)
    : [];
  const nextDay = deliveryConfirmed
    ? FULFILLMENT_POLICY.zones.list.filter((zone) => zone.leadTimeHours > FULFILLMENT_POLICY.zones.sameDayLeadHours)
    : [];
  const cutoff = deliveryConfirmed ? formatMinutes(FULFILLMENT_POLICY.cutoff.minutes) : null;
  const year = new Date().getFullYear();
  const holidays = hoursConfirmed ? branchExceptions(NEWARK, year).filter((exception) => exception.kind === "holiday") : [];
  const pending = pendingPolicyRules();

  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="py-10 lg:py-14">
          <h1 className="max-w-[20ch] text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Delivery and pickup</h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-ink-2">
            Enter the job-site ZIP to see what is available, the earliest date, and the order-by time.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <FulfillmentAnswer />
            <dl className="grid content-start gap-5 sm:grid-cols-3 lg:grid-cols-1">
              <SummaryItem icon={<Truck size={20} strokeWidth={1.5} />} title="Delivery timing">
                <DeliveryPromiseText />
              </SummaryItem>
              <SummaryItem icon={<Clock size={20} strokeWidth={1.5} />} title="Will-call pickup">
                {FULFILLMENT.pickupReady}
              </SummaryItem>
              <SummaryItem icon={<MapPin size={20} strokeWidth={1.5} />} title="Newark branch">
                <BranchStatusText />
              </SummaryItem>
            </dl>
          </div>
        </Container>
      </section>

      <Container className="py-10 lg:py-14">
        <div className="flex max-w-3xl flex-col gap-9">
          {process.env.NODE_ENV !== "production" && pending.length > 0 && (
            <div className="rounded-(--r-md) border border-line-strong bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
              <strong className="font-medium text-ink-1">Dev-only notice.</strong> Fulfillment policy{" "}
              <span className="part-number">{FULFILLMENT_POLICY.version}</span> has rules awaiting operations sign-off:{" "}
              {pending.join(", ")}. Confirm them in <span className="part-number">src/lib/fulfillment-policy.ts</span>.
            </div>
          )}

          <Section title="Delivery zones">
            {deliveryConfirmed ? (
              <>
                <p>Delivery runs on Summit&apos;s own routes from the Newark branch, to these areas:</p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <ZoneGroup name="Same-day route" note={`Orders confirmed by ${cutoff} can arrive the same trading day.`} zones={sameDay.map((zone) => zone.label)} />
                  <ZoneGroup name="Next route day" note={`Orders confirmed by ${cutoff} arrive the next trading day.`} zones={nextDay.map((zone) => zone.label)} />
                </dl>
                <p className="mt-4">
                  Anywhere else, equipment goes by freight carrier, quoted before you pay. The ZIP check above uses the same list.
                </p>
              </>
            ) : (
              <p>
                Delivery coverage is confirmed by the Newark counter for each job-site ZIP. Enter the ZIP above, then call or send
                a request for the current route and freight options; the site will not guess from an unapproved route table.
              </p>
            )}
          </Section>

          <Section title="Order cutoff">
            {deliveryConfirmed && hoursConfirmed ? (
              <>
                <p>
                  Orders confirmed by <span className="part-number">{cutoff}</span> Pacific on a trading day make that day&apos;s
                  pickup or the next route. An order is confirmed when stock and payment or account terms are settled, not when the
                  cart is submitted.
                </p>
                <p className="mt-3">
                  The branch does not run routes or will-call on weekends or these {year} holidays:{" "}
                  {holidays.map((holiday) => holiday.reason).join(", ")}. Dates shown on this site already skip them.
                </p>
              </>
            ) : (
              <p>
                The counter confirms the current order cutoff and operating calendar before accepting an order. No unapproved
                cutoff or holiday schedule is used as a customer promise.
              </p>
            )}
          </Section>

          <Section title="Fees and thresholds">
            <p>
              Any delivery fee is shown on your order before you pay. Will-call pickup at the Newark counter has no delivery
              charge. Freight is quoted at the carrier&apos;s rate before any charge.
            </p>
          </Section>

          <Section title="Receiving equipment">
            <p>
              Condensers, air handlers and furnaces are palletized and may need a liftgate or a dock. Inspect cartons before
              signing the delivery receipt and write any damage on it -- see{" "}
              <Link href="/returns#freight-damage-inspect-before-you-sign" className="text-ink-1 underline underline-offset-4">
                freight damage
              </Link>
              .
            </p>
          </Section>

          <Section title="Will-call pickup">
            <p>
              The Newark counter stages confirmed orders for pickup. Bring the order reference and the pickup contact name, and
              wait for the confirmation before you travel.
            </p>
            <address className="mt-4 rounded-(--r-md) border border-line bg-surface-1 p-4 text-sm not-italic leading-6 text-ink-1">
              <span className="font-medium">{SITE.name} · Newark</span>
              <br />
              {SITE.address.street}
              <br />
              {SITE.address.city}, {SITE.address.state} {SITE.address.zip}
              <br />
              {hoursConfirmed ? (
                weeklyHoursRows(NEWARK)
                  .filter((row) => row.hours)
                  .map((row) => (
                    <span key={row.days} className="block text-ink-2">
                      {row.days} {row.hours} PT
                    </span>
                  ))
              ) : (
                <span className="block text-ink-2">Call to confirm counter hours before traveling.</span>
              )}
              <BranchStatusText withDot className="mt-1 text-ink-2" />
              <br />
              <a href={FULFILLMENT.mapsHref} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline underline-offset-4">
                Directions<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </address>
          </Section>

          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm">
            <Link href="/shipping" className="text-ink-1 underline underline-offset-4">
              Full shipping and freight terms
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
      <h2 className="counter-heading text-2xl leading-tight text-ink-1">{title}</h2>
      <div className="mt-3 text-base leading-7 text-ink-2">{children}</div>
    </section>
  );
}

function SummaryItem({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-2.5 text-sm font-medium text-ink-1">
        <span aria-hidden="true">{icon}</span>
        {title}
      </dt>
      <dd className="mt-1.5 text-sm leading-6 text-ink-2">{children}</dd>
    </div>
  );
}

function ZoneGroup({ name, note, zones }: { name: string; note: string; zones: string[] }) {
  return (
    <div>
      <dt className="text-sm font-medium text-ink-1">{name}</dt>
      <dd className="mt-1.5 text-sm leading-6 text-ink-2">
        {zones.join(", ")}
        <span className="mt-1 block text-xs text-ink-3">{note}</span>
      </dd>
    </div>
  );
}
