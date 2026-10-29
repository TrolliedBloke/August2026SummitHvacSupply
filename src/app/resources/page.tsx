import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Container, Eyebrow } from "@/components/ui";
import { ResourceLibrary } from "@/components/resources/resource-library";
import { REBATES, SITE } from "@/lib/site";
import { getStorefrontSkus } from "@/lib/storefront/catalog";
import { SEO_GUIDES } from "@/lib/seo/guides";
import { SEO_TOOLS } from "@/lib/seo/tools";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";
import { fromDocuments, fromGuide, fromRebate, fromTool, validateResource, type ResourceItem } from "@/lib/resources";

export const metadata: Metadata = pageMetadata({ title: "HVAC Resources - Tools & Bay Area Guides", description: "Search model records and review Bay Area permit, refrigerant, rebate, and energy-code guidance. Exact-model documents publish only after verification.", path: "/resources" });

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does Summit HVAC Supply install systems?",
    a: "No. Summit supplies TCL equipment from our Newark, CA hub and refers homeowners to qualified local contractors. The installing contractor confirms sizing, placement, permits, startup, and labor.",
  },
  {
    q: "Can a homeowner buy a single mini split or heat pump?",
    a: "Yes. Homeowners can request a quote for one system and get plain-English guidance plus Bay Area installer matching, no trade account or SKU fluency required.",
  },
  {
    q: "How do contractors get pro pricing?",
    a: "Open a contractor account and sign in. Staff confirms account-specific pricing and any approved net terms before an order is accepted.",
  },
  {
    q: "What rebates apply to Bay Area heat pumps?",
    a: "The federal 25C credit is not available for property placed in service after December 31, 2025. California, regional, and utility programs can change by address, contractor, equipment match, and funding status, so verify the project before ordering.",
  },
  {
    q: "Where do you deliver, and can I pick up?",
    a: "Newark will-call, local Bay Area delivery, and LTL freight may be available. Staff confirms inventory, timing, and fees for the exact quote before an order is accepted.",
  },
  {
    q: "Where can I find certifications and warranty terms?",
    a: "Exact-model certifications, warranty terms, and registration requirements appear only after Summit verifies them against official manufacturer or AHRI evidence. Request the documents when they are not yet published.",
  },
];

/** Size and presence of a file hosted in /public, read at build time. */
function fileInfo(url: string) {
  const file = path.join(process.cwd(), "public", decodeURIComponent(url.split("?")[0]));
  return existsSync(file) ? { sizeBytes: statSync(file).size, exists: true } : { sizeBytes: null, exists: false };
}

/* Every rendered resource comes through the typed model in lib/resources.ts. */
function buildLibrary(): ResourceItem[] {
  return [
    ...SEO_TOOLS.map(fromTool),
    ...SEO_GUIDES.map(fromGuide),
    ...REBATES.map(fromRebate),
    ...fromDocuments(getStorefrontSkus(), fileInfo),
    validateResource({
      type: "external",
      id: "external:ahri",
      title: "AHRI Directory of Certified Product Performance",
      summary: "Verify a complete indoor/outdoor combination and its certified ratings.",
      topics: ["Model lookup", "Rebates"],
      audience: ["contractor", "homeowner"],
      updated: null,
      destination: SITE.ahriDirectory,
      source: "ahridirectory.org",
      opensInNewTab: true,
    }),
    validateResource({
      type: "external",
      id: "external:energy-star",
      title: "ENERGY STAR product finder",
      summary: "Check whether an exact model carries an ENERGY STAR certification.",
      topics: ["Rebates"],
      audience: ["homeowner", "contractor"],
      updated: null,
      destination: SITE.energyStar,
      source: "energystar.gov",
      opensInNewTab: true,
    }),
  ];
}

export default function ResourcesPage() {
  const library = buildLibrary();
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />
      <section className="border-b border-line bg-surface-1">
        <Container className="grid gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-14">
          <div>
            <Eyebrow>Resources</Eyebrow>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
              Tools and evidence for a better equipment decision.
            </h1>
            <p className="mt-3 max-w-2xl text-ink-2">
              Search exact identifiers, review current guidance, and request exact-model documents.
              Unverified files and claims stay unpublished.
            </p>
          </div>
          <div className="relative min-h-[260px] overflow-hidden rounded-(--r-md) border border-line bg-surface-2 shadow-[var(--shadow-sm)]">
            <Image
              src="/site/generated/spec-workbench-documents.jpg"
              alt="HVAC spec sheets, line set materials, and product documents on a contractor workbench"
              fill
              preload
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </Container>
      </section>

      <Container className="py-12 lg:py-14">
        <React.Suspense fallback={<p className="text-sm text-ink-3">Loading resources…</p>}>
          <ResourceLibrary items={library} />
        </React.Suspense>
        <div className="mt-10 border-t border-line pt-8">
          <h3 className="text-lg font-semibold text-ink-1">Need help choosing?</h3>
          <p className="mt-1.5 max-w-xl text-sm text-ink-2">
            Filter the lineup by capacity and efficiency, or send us the details and we&apos;ll spec it for you.
          </p>
          <Link href="/products" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover">
            Browse products <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </Container>

      {/* FAQ -- plain answers for buyers and AI assistants (FAQPage schema above) */}
      <Container className="pb-20">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">
          Frequently asked questions
        </h2>
        <div className="mt-6 overflow-hidden rounded-(--r-md) border border-line">
          {FAQS.map((item, i) => (
            <details
              key={item.q}
              className={`group bg-surface-1 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-base font-semibold text-ink-1 hover:bg-surface-2">
                {item.q}
                <ArrowRight
                  size={16}
                  className="shrink-0 text-ink-3 transition-transform group-open:rotate-90"
                />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </>
  );
}
