import { PolicyList, PolicyLink } from "@/components/policy-page";
import { SITE } from "@/lib/site";
import type { LegalDocument } from "../schema";

/**
 * Archived: terms of service as published on August 2, 2026 (version 1.0).
 * Frozen -- served at /legal/terms/1.0 so links into the old wording keep
 * working. Do not edit.
 */
export const TERMS_1_0: LegalDocument = {
  id: "terms",
  path: "/terms",
  eyebrow: "Legal",
  title: "Terms of service",
  intro: `The terms that govern buying equipment from ${SITE.legalName}. Placing an order means you accept them.`,
  version: "1.0",
  effectiveDate: "2026-08-02",
  updatedDate: "2026-08-02",
  owner: "Summit HVAC Supply operations (legal)",
  review: { status: "pending_counsel", reviewedAt: null },
  history: [{ version: "1.0", effectiveDate: "2026-08-02", summary: ["First structured, versioned publication. Wording unchanged from the August 2, 2026 page."] }],
  sections: [
    {
      id: "we-supply-equipment-we-do-not-install-it",
      heading: "We supply equipment; we do not install it",
      body: (
        <>
          <p>
            This is the most important term on the page.{" "}
            {SITE.legalName} sells HVAC equipment and parts. We do not perform
            installation, and we are not a licensed contractor. Installation must
            be performed by a qualified, licensed HVAC contractor in accordance
            with local code, manufacturer instructions, and applicable permit
            requirements.
          </p>
          <p>
            We are happy to refer you to local installers, but a referral is not
            an endorsement, a subcontract, or a warranty of their work. Your
            agreement for installation is with that contractor, not with us.
          </p>
        </>
      ),
    },
    {
      id: "equipment-must-be-installed-correctly-to-stay-warranted",
      heading: "Equipment must be installed correctly to stay warranted",
      body: (
        <>
          <p>
            Manufacturer warranties are generally void where equipment is
            installed by an unlicensed party, installed outside the
            manufacturer&apos;s published specifications, or not registered within the required
            window. Refrigerant handling is federally regulated and requires EPA
            Section 608 certification. Buying a unit here does not confer the
            right to charge it yourself.
          </p>
        </>
      ),
    },
    {
      id: "orders-pricing-and-errors",
      heading: "Orders, pricing, and errors",
      body: (
        <>
          <PolicyList
            items={[
              <>
                Prices are in US dollars and may change without notice. The price
                that governs is the one confirmed on your order.
              </>,
              <>
                We try hard to keep listings accurate, but specifications, images,
                stock counts, and prices can contain errors. We reserve the right
                to correct an error and to cancel an order placed at an
                obviously incorrect price, refunding you in full.
              </>,
              <>
                An order confirmation is an acknowledgment of receipt, not a
                guarantee of stock. If a unit is committed elsewhere before we
                pick it, we contact you the same day with options.
              </>,
              <>
                Freight cost on LTL orders is quoted after the order is placed and
                confirmed with you before it is charged.
              </>,
              <>
                California sales tax applies unless a valid resale or exemption
                certificate is on file with your account.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "payment",
      heading: "Payment",
      body: (
        <>
          <p>
            Card payments are processed by a third-party payment processor; we do
            not store card numbers. Account holders approved for terms are subject
            to those terms and to credit limits set at account opening. Past-due
            balances may be assessed a late charge and may suspend open-account
            purchasing until cleared.
          </p>
        </>
      ),
    },
    {
      id: "delivery-risk-of-loss-and-returns",
      heading: "Delivery, risk of loss, and returns",
      body: (
        <>
          <p>
            Risk of loss passes on delivery to you or your carrier. Inspect
            shipments before signing. What you write on the delivery receipt
            controls whether damage can be recovered. Full detail is on the{" "}
            <PolicyLink href="/shipping">shipping</PolicyLink> and{" "}
            <PolicyLink href="/returns">returns</PolicyLink> pages, which are part
            of these terms.
          </p>
        </>
      ),
    },
    {
      id: "warranty-disclaimer",
      heading: "Warranty disclaimer",
      body: (
        <>
          <p>
            Equipment sold here carries the manufacturer&apos;s warranty, and that
            warranty is the exclusive remedy for a defective product. Except for
            the express commitments we make on our returns page,{" "}
            {SITE.legalName} disclaims all other warranties, express or implied,
            including implied warranties of merchantability and fitness for a
            particular purpose, to the fullest extent permitted by California law.
          </p>
          <p>
            Sizing guidance, product recommendations, and system-selector output
            are informational estimates, not engineering judgments. A licensed
            contractor performing a load calculation is the authority on what your
            building needs.
          </p>
        </>
      ),
    },
    {
      id: "limitation-of-liability",
      heading: "Limitation of liability",
      body: (
        <>
          <p>
            To the fullest extent permitted by law, {SITE.legalName} is not liable
            for indirect, incidental, special, or consequential damages, including
            lost profits, property damage, or costs arising from installation,
            removal, or downtime. Our total liability for any claim relating to a
            product is limited to the amount you paid for that product.
          </p>
          <p>
            Nothing here limits liability that cannot be limited under California
            law.
          </p>
        </>
      ),
    },
    {
      id: "accounts",
      heading: "Accounts",
      body: (
        <>
          <p>
            You are responsible for keeping your account credentials secure and
            for activity under your account, including orders placed by your
            employees. Tell us immediately if you believe an account has been
            compromised. We may suspend an account for non-payment, misuse, or
            fraudulent activity.
          </p>
        </>
      ),
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      body: (
        <>
          <p>
            Do not scrape, resell, or republish our catalog data, pricing, or
            documentation without written permission. Do not attempt to access
            accounts, orders, or administrative areas that are not yours. Site
            content, layout, and product photography are ours or our suppliers&apos;;
            manufacturer trademarks belong to their owners.
          </p>
        </>
      ),
    },
    {
      id: "governing-law",
      heading: "Governing law",
      body: (
        <>
          <p>
            These terms are governed by the laws of the State of California
            without regard to conflict-of-law rules. Venue for any dispute is
            Alameda County, California.
          </p>
        </>
      ),
    },
    {
      id: "changes-and-contact",
      heading: "Changes and contact",
      body: (
        <>
          <p>
            We may update these terms; the date at the top reflects the current
            version, and continued use of the site constitutes acceptance.
            Questions go to{" "}
            <a href={SITE.emailHref} className="text-ink-1 underline underline-offset-4">
              {SITE.email}
            </a>{" "}
            or {SITE.address.full}. See also our{" "}
            <PolicyLink href="/privacy">privacy policy</PolicyLink>.
          </p>
        </>
      ),
    },
  ],
};
