import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FileText, BookOpen, Leaf, ArrowRight, ExternalLink } from "lucide-react";
import { Container, Eyebrow, Chip } from "@/components/ui";
import { REBATES, SITE } from "@/lib/site";
import { documentHref, getStorefrontSkus, productHref } from "@/lib/storefront/catalog";
import { SEO_GUIDES } from "@/lib/seo/guides";
import { SEO_TOOLS } from "@/lib/seo/tools";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({ title: "HVAC Resources - Tools & Bay Area Guides", description: "Search model records and review Bay Area permit, refrigerant, rebate, and energy-code guidance. Exact-model documents publish only after verification.", path: "/resources" });

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does Summit HVAC Supply install systems?",
    a: "No. Summit supplies TCL equipment from our Newark, CA hub and refers homeowners to qualified local contractors. The installing contractor confirms sizing, placement, permits, startup, and labor.",
  },
  {
    q: "Can a homeowner buy a single mini split or heat pump?",
    a: "Yes. Homeowners can request a quote for one system and get plain-English guidance plus Bay Area installer matching — no trade account or SKU fluency required.",
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

export default function ResourcesPage() {
  const documentedSkus = getStorefrontSkus().filter((sku) => sku.documents.length > 0);
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

      {/* Rebates */}
      <Container className="py-12 lg:py-14">
        <div className="flex items-center gap-2">
          <Leaf size={18} className="text-eco" />
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">
            Rebate &amp; incentive guides
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          Help your customers buy on total cost with current program guidance and support for project-specific eligibility.
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {REBATES.map((r) => (
            <div key={r.name} className="rounded-(--r-md) border border-line bg-surface-1 p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-(--r-md) bg-eco-tint text-eco-ink">
                  <Leaf size={20} strokeWidth={2.2} />
                </span>
                {r.confirm && <Chip tone="copper">Project guidance</Chip>}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink-1">
                {r.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{r.detail}</p>
              <Link
                href="/contact"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
              >
                Request guidance <ArrowRight size={15} />
              </Link>
            </div>
          ))}
        </div>
      </Container>

      <Container className="pb-14">
        <div className="grid gap-8 lg:grid-cols-2">
          <section><h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">Equipment tools</h2><p className="mt-2 text-sm leading-6 text-ink-2">Use exact identifiers and project inputs to narrow the next step.</p><div className="mt-5 grid gap-2">{SEO_TOOLS.map((tool) => <Link key={tool.slug} href={`/tools/${tool.slug}`} className="rounded-(--r-sm) border border-line bg-surface-1 p-4"><span className="font-medium text-ink-1">{tool.title}</span><span className="mt-1 block text-sm leading-6 text-ink-2">{tool.description}</span></Link>)}</div></section>
          <section><h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">Bay Area compliance guides</h2><p className="mt-2 text-sm leading-6 text-ink-2">Reviewed summaries with jurisdiction, effective date, pending changes, and primary sources.</p><div className="mt-5 grid gap-2">{SEO_GUIDES.map((guide) => <Link key={guide.slug} href={`/guides/${guide.slug}`} className="rounded-(--r-sm) border border-line bg-surface-1 p-4"><span className="font-medium text-ink-1">{guide.eyebrow}</span><span className="mt-1 block text-sm leading-6 text-ink-2">{guide.description}</span></Link>)}</div></section>
        </div>
      </Container>

      {/* Document library */}
      <Container className="pb-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">
          Spec sheets &amp; install manuals
        </h2>
        <p className="mt-2 text-sm text-ink-3">
          Exact-model documents appear here only after their model match and source are verified.
        </p>
        <div className="mt-6 overflow-hidden rounded-(--r-md) border border-line">
          {documentedSkus.length === 0 && (
            <div className="bg-surface-1 p-6">
              <p className="font-medium text-ink-1">No exact-model documents are published yet.</p>
              <p className="mt-2 text-sm leading-6 text-ink-2">The imported catalog remains quote-ready while manufacturer documents are verified. Send the SKU or OEM model and we will locate the correct file without substituting a similar product.</p>
              <Link href="/contact" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand">Request a document <ArrowRight size={15} /></Link>
            </div>
          )}
          {documentedSkus.map((sku, i) => (
            <div
              key={sku.id}
              className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                i % 2 === 0 ? "bg-surface-1" : "bg-surface-2/50"
              } ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div>
                <Link href={productHref(sku)} className="font-display text-base font-semibold text-ink-1 hover:text-brand">
                  {sku.title}
                </Link>
                <span className="ml-2 font-mono text-xs text-ink-3">{sku.sku}</span>
                <p className="mt-1 text-xs text-ink-3">{sku.modelNumber} · {sku.btu.toLocaleString()} BTU · {sku.voltage}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {sku.documents.map((doc) => (
                  <DocChip
                    key={doc.id}
                    href={documentHref(doc)}
                    icon={doc.kind === "spec_sheet" ? <FileText size={14} /> : <BookOpen size={14} />}
                    label={doc.kind === "spec_sheet" ? "Spec sheet" : "Install manual"}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* SEO/help cross-links */}
        <div className="mt-10 rounded-(--r-md) border border-line bg-surface-2/50 p-6">
          <h3 className="font-display text-lg font-semibold text-ink-1">Need help choosing?</h3>
          <p className="mt-1.5 max-w-xl text-sm text-ink-2">
            Not sure which series fits a job? Filter the lineup by capacity and
            efficiency, or send us the details and we&apos;ll spec it for you.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover">
              Browse products <ArrowRight size={15} />
            </Link>
            <a href={SITE.ahriDirectory} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-brand">
              AHRI Directory <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </Container>

      {/* FAQ — plain answers for buyers and AI assistants (FAQPage schema above) */}
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

function DocChip({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      data-conversion-hook="resource-document-download"
      className="inline-flex items-center gap-1.5 rounded-(--r-sm) border border-line bg-surface-1 px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:border-ink-4 hover:text-ink-1"
    >
      {icon}
      {label}
      <ArrowRight size={13} className="text-ink-4" />
    </a>
  );
}
