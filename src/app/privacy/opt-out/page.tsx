import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow } from "@/components/ui";
import { OptOutForm } from "@/components/privacy/opt-out-form";
import { PRIVACY_DISCLOSES_AD_SHARING } from "@/content/legal/privacy";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Do Not Sell or Share My Personal Information",
  description: "Opt out of the sale or sharing of your personal information with Summit HVAC Supply. Global Privacy Control signals are honored automatically.",
  path: "/privacy/opt-out",
});

/**
 * The CCPA opt-out page every footer links to. It works whether or not Summit
 * is sharing anything: the request is recorded now and holds if that changes.
 */
export default function PrivacyOptOutPage() {
  return (
    <Container className="py-12 lg:py-16">
      <div className="max-w-2xl">
        <Eyebrow>Privacy choices</Eyebrow>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-ink-1 sm:text-4xl">Do not sell or share my personal information</h1>
        <p className="mt-4 text-ink-2">
          {PRIVACY_DISCLOSES_AD_SHARING
            ? "Summit shares some personal information with Meta and Google to measure and target its ads, as our privacy policy describes. Opting out stops that for you."
            : "Summit does not sell personal information or share it for cross-context behavioral advertising today. You can still record your choice now, and it will hold if that ever changes."}
        </p>
        <p className="mt-3 text-ink-2">
          Your browser&apos;s Global Privacy Control signal counts as this request, with nothing to fill in. Opting out does not
          change your prices or the service you get.
        </p>

        <OptOutForm />

        <p className="mt-8 text-sm leading-6 text-ink-3">
          You can also make the request by email at{" "}
          <a href={SITE.emailHref} className="text-ink-1 underline underline-offset-4">
            {SITE.email}
          </a>{" "}
          or by phone at{" "}
          <a href={SITE.phoneHref} className="text-ink-1 underline underline-offset-4">
            {SITE.phone}
          </a>
          . Read the full{" "}
          <Link href="/privacy" className="text-ink-1 underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
