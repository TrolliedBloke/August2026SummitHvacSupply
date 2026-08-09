import type { Metadata } from "next";
import { PolicyPage, PolicySection, PolicyList, PolicyLink } from "@/components/policy-page";
import { PURCHASE, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Returns & Refunds - 30-Day Policy & Freight Damage Claims",
  description:
    "30-day returns on unopened HVAC equipment. Freight damage, restocking fees, warranty claims, and how to start a return from Newark, CA.",
};

export default function ReturnsPage() {
  return (
    <PolicyPage
      eyebrow="Policies"
      title="Returns & refunds"
      intro={PURCHASE.returnsDetail}
      updated="August 2, 2026"
    >
      <PolicySection heading="The short version">
        <PolicyList
          items={[
            <>
              <strong className="font-medium text-ink-1">30 days</strong> to
              return unopened equipment for a full refund.
            </>,
            <>
              Opened or special-order items may carry a{" "}
              <strong className="font-medium text-ink-1">15% restocking fee</strong>.
            </>,
            <>
              Damaged in transit? We replace it free, but you must note the
              damage <strong className="font-medium text-ink-1">before signing</strong>{" "}
              the freight receipt.
            </>,
            <>Installed equipment cannot be returned. It moves to warranty.</>,
          ]}
        />
      </PolicySection>

      <PolicySection heading="Freight damage: inspect before you sign">
        <p>
          This is the one step that costs customers the most money, so it is
          worth being blunt about it. When an LTL freight carrier delivers a
          condenser, air handler, or packaged unit, you are asked to sign a
          delivery receipt. That signature is a legal statement that the
          equipment arrived in good condition.
        </p>
        <p>
          Inspect the crate and the unit <em>before</em> you sign. If you see
          crushed corners, punctured cardboard, oil residue, bent line stubs, or
          a tilted pallet, write the specific damage on the delivery receipt and
          photograph it while the driver is still there.
        </p>
        <PolicyList
          items={[
            <>
              <strong className="font-medium text-ink-1">Visible damage:</strong>{" "}
              note it on the receipt, photograph it, and call us the same day.
              We replace the unit at no cost.
            </>,
            <>
              <strong className="font-medium text-ink-1">Concealed damage:</strong>{" "}
              report within 5 business days of delivery with photos and the
              serial number. Carriers routinely deny concealed-damage claims
              filed later than this, and that denial passes through to you.
            </>,
            <>
              <strong className="font-medium text-ink-1">Signed clean:</strong>{" "}
              if the receipt was signed without notation, the carrier treats the
              shipment as delivered intact and our ability to recover the cost
              is limited. We will still help you file, but we cannot guarantee
              a free replacement.
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection heading="What can be returned">
        <PolicyList
          items={[
            <>
              <strong className="font-medium text-ink-1">Unopened, resalable equipment:</strong>{" "}
              in original packaging with all literature and accessories. Full
              refund within 30 days of delivery or pickup.
            </>,
            <>
              <strong className="font-medium text-ink-1">Opened but uninstalled equipment:</strong>{" "}
              refund less a 15% restocking fee, provided the unit is complete,
              undamaged, and never charged, wired, or mounted.
            </>,
            <>
              <strong className="font-medium text-ink-1">Parts and accessories:</strong>{" "}
              30 days, unopened, in resalable condition.
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection heading="What cannot be returned">
        <PolicyList
          items={[
            <>
              <strong className="font-medium text-ink-1">Installed equipment.</strong>{" "}
              Once a unit has been mounted, wired, brazed, or charged with
              refrigerant it is no longer resalable. Defects at that point are
              handled under the manufacturer warranty, not a return.
            </>,
            <>
              <strong className="font-medium text-ink-1">Special-order and non-stock items</strong>{" "}
              that we bring in specifically for your job, unless they arrive
              defective or damaged.
            </>,
            <>
              <strong className="font-medium text-ink-1">Refrigerant:</strong>{" "}
              cylinders that have been opened or partially used cannot be
              accepted back for safety and regulatory reasons.
            </>,
            <>
              <strong className="font-medium text-ink-1">Electrical components:</strong>{" "}
              boards, motors, and controls that have been installed and
              energized. A failed board is a warranty claim.
            </>,
            <>Items returned after 30 days without prior authorization.</>,
          ]}
        />
      </PolicySection>

      <PolicySection heading="Who pays return freight">
        <p>
          If the return is our error (wrong item shipped, unit arrived damaged
          or dead on arrival, or the product did not match its listing) we pay
          the freight both ways and there is no restocking fee.
        </p>
        <p>
          If the return is a change of mind, an ordering mistake on your end, or
          a job that fell through, the return freight is yours. For a mini split
          head this is modest. For a condenser or packaged unit moving by LTL
          freight it is not, and it is often a meaningful fraction of the unit
          price. Dropping the unit at our Newark will-call counter avoids that
          cost entirely and is almost always the cheaper path for Bay Area
          customers.
        </p>
      </PolicySection>

      <PolicySection heading="How to start a return">
        <p>
          Every return needs an RMA number before it ships. Unauthorized returns
          arriving at our dock cannot be matched to an order and may be refused.
        </p>
        <PolicyList
          items={[
            <>
              Call{" "}
              <a href={SITE.phoneHref} className="text-ink-1 underline underline-offset-4">
                {SITE.phone}
              </a>{" "}
              or email{" "}
              <a href={SITE.emailHref} className="text-ink-1 underline underline-offset-4">
                {SITE.email}
              </a>{" "}
              with your order number, the SKU, and the reason.
            </>,
            <>
              For damage or defect claims, include the unit serial number and
              photographs. A photo and the serial number is usually all we need.
            </>,
            <>
              We issue an RMA number and tell you whether to ship it back or
              bring it to will-call at {SITE.address.full}.
            </>,
            <>
              Refunds are issued to the original payment method within 5–10
              business days of the unit arriving and passing inspection.
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection heading="Warranty is separate from returns">
        <p>
          A return sends a product back for a refund. A warranty claim repairs
          or replaces a product that failed in service. Once equipment is
          installed, warranty is the applicable path. See the{" "}
          <PolicyLink href="/resources">Resources</PolicyLink> page for
          manufacturer warranty terms and registration, or{" "}
          <PolicyLink href="/contact">contact us</PolicyLink> and we will route
          the claim.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
