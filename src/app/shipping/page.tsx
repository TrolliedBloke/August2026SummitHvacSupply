import type { Metadata } from "next";
import { PolicyPage, PolicySection, PolicyList, PolicyLink } from "@/components/policy-page";
import { PURCHASE, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipping, Delivery & Newark Will-Call Pickup",
  description:
    "Newark will-call pickup, Bay Area jobsite delivery, and LTL freight for HVAC equipment. Lead times, freight handling, and delivery requirements.",
};

export default function ShippingPage() {
  return (
    <PolicyPage
      eyebrow="Policies"
      title="Shipping, delivery & will-call"
      intro={`${PURCHASE.delivery}. Freight beyond the Bay Area is quoted before any charge.`}
      updated="August 2, 2026"
    >
      <PolicySection heading="Three ways to get equipment">
        <PolicyList
          items={[
            <>
              <strong className="font-medium text-ink-1">Will-call pickup — free.</strong>{" "}
              Order by 2:00p PT and pick up the same day at{" "}
              {SITE.address.full}. {SITE.hours.split("·")[0].trim()}. This is
              the fastest and cheapest option, and the only one with no freight
              risk at all.
            </>,
            <>
              <strong className="font-medium text-ink-1">Bay Area jobsite delivery.</strong>{" "}
              1–3 business days to {SITE.serviceArea}. Free to Newark; other
              cities are quoted by delivery zone at checkout.
            </>,
            <>
              <strong className="font-medium text-ink-1">LTL freight.</strong>{" "}
              Curbside delivery beyond our local radius, including{" "}
              {SITE.broaderServiceArea}. Cost is quoted after the order is
              placed and confirmed with you before anything is charged.
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection heading="What curbside freight actually means">
        <p>
          This is the most common source of surprise on a first freight order,
          so it is worth stating plainly. Curbside means the driver brings the
          truck to the end of your driveway and operates a liftgate to place
          the pallet on the ground. That is where their responsibility ends.
        </p>
        <PolicyList
          items={[
            <>
              The driver will <strong className="font-medium text-ink-1">not</strong>{" "}
              carry equipment into a garage, side yard, basement, or up stairs.
            </>,
            <>
              A condenser or packaged unit on a pallet can exceed 200 lbs. Plan
              to have equipment and people on site to move it.
            </>,
            <>
              Someone <strong className="font-medium text-ink-1">must be present</strong>{" "}
              to inspect and sign. Carriers charge a redelivery fee for a missed
              appointment, and that fee passes through to you.
            </>,
            <>
              Residential addresses and sites needing a liftgate may carry
              accessorial charges. We quote these up front rather than adding
              them after the fact.
            </>,
          ]}
        />
        <p>
          Inspect before signing. What you write on the delivery receipt
          determines whether a damaged unit is replaced free — the details are
          on the <PolicyLink href="/returns">returns page</PolicyLink>.
        </p>
      </PolicySection>

      <PolicySection heading="Lead times">
        <PolicyList
          items={[
            <>
              <strong className="font-medium text-ink-1">In stock in Newark:</strong>{" "}
              same-day will-call if ordered by 2:00p PT; 1–3 business days for
              Bay Area delivery.
            </>,
            <>
              <strong className="font-medium text-ink-1">In stock, freight:</strong>{" "}
              typically 3–7 business days in transit depending on distance, plus
              carrier scheduling for the delivery appointment.
            </>,
            <>
              <strong className="font-medium text-ink-1">Special order:</strong>{" "}
              quoted per item. We confirm the date before taking the order, and
              we tell you if it slips.
            </>,
          ]}
        />
        <p className="text-ink-3">
          Stock counts shown on product pages reflect Newark shelf inventory. If
          a unit is committed to another order between your checkout and our
          pick, we call you the same day rather than letting the order sit.
        </p>
      </PolicySection>

      <PolicySection heading="Contractor and account orders">
        <p>
          Account holders can stage will-call orders for a specific crew or job
          and pick up without re-quoting. If you need a standing delivery day or
          a scheduled drop for a multi-unit job, call the counter and we will
          set it up — see{" "}
          <PolicyLink href="/dealers">contractor accounts</PolicyLink>.
        </p>
      </PolicySection>

      <PolicySection heading="Where we ship">
        <p>
          Local delivery covers {SITE.serviceArea}. Freight covers{" "}
          {SITE.broaderServiceArea}. We do not currently ship outside the
          continental United States, and some equipment cannot be shipped to
          addresses where local code prohibits homeowner-purchased installation.
          If in doubt, call before ordering.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
