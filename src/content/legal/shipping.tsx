import { PolicyList, PolicyLink } from "@/components/policy-page";
import { PURCHASE, SITE } from "@/lib/site";
import type { LegalDocument } from "./schema";

/**
 * Shipping, delivery & will-call, version 1.1. Section ids are permanent: they are
 * deep-link targets and must never be renamed once published. To revise this
 * document, copy it to ./archive/shipping-1.0.tsx first, then edit
 * here and add a history entry.
 */
export const SHIPPING: LegalDocument = {
  id: "shipping",
  path: "/shipping",
  eyebrow: "Policies",
  title: "Shipping, delivery & will-call",
  intro: `${PURCHASE.delivery}. Freight beyond the Bay Area is quoted before any charge.`,
  version: "1.1",
  effectiveDate: "2026-09-30",
  updatedDate: "2026-09-30",
  owner: "Newark counter operations (fulfillment)",
  review: { status: "pending_counsel", reviewedAt: null },
  history: [
    {
      version: "1.1",
      effectiveDate: "2026-09-30",
      summary: [
        "Local delivery coverage now refers to the route list the ZIP check and checkout use, instead of a broader marketing description that could disagree with it.",
        "Branch hours now come from the branch schedule, including holidays.",
      ],
    },
    { version: "1.0", effectiveDate: "2026-08-02", summary: ["First published version."] },
  ],
  sections: [
    {
      id: "three-ways-to-get-equipment",
      heading: "Three ways to get equipment",
      body: (
        <>
          <PolicyList
            items={[
              <>
                <strong className="font-medium text-ink-1">Will-call pickup is free.</strong>{" "}
                After staff confirms the item is ready, schedule pickup at{" "}
                {SITE.address.full}, {SITE.counterHours}, closed on branch holidays. This is
                the fastest and cheapest option, and the only one with no freight
                risk at all.
              </>,
              <>
                <strong className="font-medium text-ink-1">Bay Area jobsite delivery.</strong>{" "}
                To the ZIPs on our Newark routes -- check yours on the{" "}
                <PolicyLink href="/delivery">delivery page</PolicyLink>. Any fee is
                shown on the order before it is accepted.
              </>,
              <>
                <strong className="font-medium text-ink-1">LTL freight.</strong>{" "}
                Curbside delivery beyond our local radius, including{" "}
                {SITE.broaderServiceArea}. Cost and carrier timing are quoted
                before the order is accepted or anything is charged.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "what-curbside-freight-actually-means",
      heading: "What curbside freight actually means",
      body: (
        <>
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
            determines whether a damaged unit is replaced free. The details are
            on the <PolicyLink href="/returns">returns page</PolicyLink>.
          </p>
        </>
      ),
    },
    {
      id: "lead-times",
      heading: "Lead times",
      body: (
        <>
          <PolicyList
            items={[
              <>
                <strong className="font-medium text-ink-1">Staff-confirmed Newark inventory:</strong>{" "}
                the quote states the available pickup window and local-delivery estimate.
              </>,
              <>
                <strong className="font-medium text-ink-1">Freight:</strong>{" "}
                carrier timing is quoted by destination and equipment class.
              </>,
              <>
                <strong className="font-medium text-ink-1">Special order:</strong>{" "}
                quoted per item. We confirm the date before taking the order, and
                we tell you if it slips.
              </>,
            ]}
          />
          <p className="text-ink-3">
            The current imported catalog does not publish shelf counts. Staff confirms
            inventory, reservation terms, and fulfillment timing before accepting an order.
          </p>
        </>
      ),
    },
    {
      id: "contractor-and-account-orders",
      heading: "Contractor and account orders",
      body: (
        <>
          <p>
            Account holders can stage will-call orders for a specific crew or job
            and pick up without re-quoting. If you need a standing delivery day or
            a scheduled drop for a multi-unit job, call the counter and we will
            set it up. See{" "}
            <PolicyLink href="/dealers">contractor accounts</PolicyLink>.
          </p>
        </>
      ),
    },
    {
      id: "where-we-ship",
      heading: "Where we ship",
      body: (
        <>
          <p>
            Local delivery covers the ZIPs on our Newark routes, listed on the{" "}
            <PolicyLink href="/delivery">delivery page</PolicyLink>. Freight covers{" "}
            {SITE.broaderServiceArea}. We do not currently ship outside the
            continental United States, and some equipment cannot be shipped to
            addresses where local code prohibits homeowner-purchased installation.
            If in doubt, call before ordering.
          </p>
        </>
      ),
    },
  ],
};
