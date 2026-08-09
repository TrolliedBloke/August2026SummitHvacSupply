import type { Metadata } from "next";
import { PolicyPage, PolicySection, PolicyList, PolicyLink } from "@/components/policy-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy & California Privacy Rights",
  description:
    "How Summit HVAC Supply collects, uses, and protects personal information, including California privacy rights under the CCPA/CPRA.",
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="Privacy policy"
      intro="What we collect, why we collect it, who we share it with, and how to make us stop."
      updated="August 2, 2026"
    >
      <PolicySection heading="What we collect">
        <PolicyList
          items={[
            <>
              <strong className="font-medium text-ink-1">Information you give us:</strong>{" "}
              name, email, phone, billing and delivery address, company name and
              tax-exemption details for account holders, and anything you type
              into a quote request, contact form, or chat.
            </>,
            <>
              <strong className="font-medium text-ink-1">Order information:</strong>{" "}
              what you bought, when, where it shipped, and the status of the
              order.
            </>,
            <>
              <strong className="font-medium text-ink-1">Automatically collected:</strong>{" "}
              pages viewed, searches run, approximate location derived from IP,
              device and browser type, and referring site.
            </>,
            <>
              <strong className="font-medium text-ink-1">Saved activity:</strong>{" "}
              cart contents, saved lists, and back-in-stock notification
              requests, so those features work across sessions.
            </>,
          ]}
        />
        <p>
          We do not store full payment card numbers. Card details are entered
          directly with our payment processor and never touch our servers.
        </p>
      </PolicySection>

      <PolicySection heading="Why we collect it">
        <PolicyList
          items={[
            <>To process, fulfill, and support your orders.</>,
            <>To quote freight and confirm delivery.</>,
            <>
              To notify you about order status, back-in-stock items you asked
              about, and account activity.
            </>,
            <>
              To operate and improve the site, understanding which products get
              searched for, which pages fail people, and where checkout breaks.
            </>,
            <>To meet tax, warranty, and legal recordkeeping obligations.</>,
          ]}
        />
      </PolicySection>

      <PolicySection heading="We do not sell your personal information">
        <p>
          We do not sell personal information, and we do not share it for
          cross-context behavioral advertising as those terms are defined under
          California law. We share data only with service providers who need it
          to do their job for us: payment processing, freight carriers and
          delivery, email delivery, and site hosting and analytics. Those
          providers are contractually limited to using it for that purpose.
        </p>
        <p>
          We will also disclose information where legally required (subpoena,
          court order, or a lawful government request) and in connection with a
          merger or sale of the business, in which case we will say so here.
        </p>
      </PolicySection>

      <PolicySection heading="Your California privacy rights">
        <p>
          If you are a California resident, the CCPA as amended by the CPRA
          gives you the following rights:
        </p>
        <PolicyList
          items={[
            <>
              <strong className="font-medium text-ink-1">Know</strong> what
              personal information we have collected about you, where it came
              from, and who we disclosed it to.
            </>,
            <>
              <strong className="font-medium text-ink-1">Delete</strong> personal
              information we hold, subject to exceptions for completing
              transactions, warranty and tax records, and legal compliance.
            </>,
            <>
              <strong className="font-medium text-ink-1">Correct</strong>{" "}
              inaccurate personal information.
            </>,
            <>
              <strong className="font-medium text-ink-1">Opt out</strong> of sale
              or sharing. As stated above, we do not sell or share personal
              information, so there is nothing to opt out of, but the right
              stands if that ever changes.
            </>,
            <>
              <strong className="font-medium text-ink-1">Non-discrimination</strong>. Exercising these rights will not change your pricing or the
              service you get.
            </>,
          ]}
        />
        <p>
          To exercise any of these, email{" "}
          <a href={SITE.emailHref} className="text-ink-1 underline underline-offset-4">
            {SITE.email}
          </a>{" "}
          or call{" "}
          <a href={SITE.phoneHref} className="text-ink-1 underline underline-offset-4">
            {SITE.phone}
          </a>
          . We verify identity before acting on a request and respond within 45
          days. An authorized agent may submit a request on your behalf with
          written permission.
        </p>
      </PolicySection>

      <PolicySection heading="Email and marketing">
        <p>
          Transactional email (order confirmations, shipping notices, back-in-stock
          alerts you requested) is part of the service. Marketing email is
          separate and every message includes a one-click unsubscribe link that
          works without logging in. Unsubscribing from marketing does not stop
          order-related messages.
        </p>
      </PolicySection>

      <PolicySection heading="Cookies and analytics">
        <p>
          We use cookies and similar storage to keep you signed in, remember
          your cart, and understand aggregate site usage. You can block cookies
          in your browser, but sign-in, cart, and checkout will not work
          correctly without them.
        </p>
      </PolicySection>

      <PolicySection heading="Retention and security">
        <p>
          We keep order and tax records as long as law requires, and account
          information for as long as your account is open. Data is transmitted
          over encrypted connections and access is limited to staff who need it.
          No system is perfectly secure, and we will not claim otherwise. If a
          breach affects your information we will notify you as required by
          California law.
        </p>
      </PolicySection>

      <PolicySection heading="Children">
        <p>
          This site is for business and homeowner equipment purchasing and is
          not directed to children under 13. We do not knowingly collect their
          information.
        </p>
      </PolicySection>

      <PolicySection heading="Changes and contact">
        <p>
          If we change this policy we will update the date at the top of the
          page. Questions go to{" "}
          <a href={SITE.emailHref} className="text-ink-1 underline underline-offset-4">
            {SITE.email}
          </a>{" "}
          or {SITE.address.full}. See also our{" "}
          <PolicyLink href="/terms">terms of service</PolicyLink>.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
