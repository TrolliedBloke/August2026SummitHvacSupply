import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FileText, BookOpen, Leaf, ArrowRight, ExternalLink } from "lucide-react";
import { Container, Eyebrow, Chip } from "@/components/ui";
import { REBATES, SITE } from "@/lib/site";
import { documentHref, getStorefrontSkus, productHref } from "@/lib/storefront/catalog";

export const metadata: Metadata = {
  title: "Resources - Spec Sheets, Install Manuals & Rebate Guides",
  description:
    "Download TCL HVAC spec sheets and install manuals by SKU, and get rebate guidance: Federal 25C and TECH Clean California.",
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does Summit HVAC Supply install systems?",
    a: "No. Summit supplies TCL equipment from our Newark, CA hub and refers homeowners to qualified local contractors. The installing contractor confirms sizing, placement, permits, startup, and labor.",
  },
  {
    q: "Can a homeowner buy a single mini split or heat pump?",
    a: "Yes. Homeowners can buy one system and get plain-English guidance plus Bay Area installer matching — no trade account or SKU fluency required.",
  },
  {
    q: "How do contractors get pro pricing?",
    a: "Open a contractor account and sign in. Retail (MSRP) shows publicly; contractor pricing and net terms appear after your pro account is approved and you are signed in.",
  },
  {
    q: "What rebates apply to Bay Area heat pumps?",
    a: "The Federal 25C tax credit covers up to $2,000 for qualifying heat pumps, and TECH Clean California offers additional incentives that vary by contractor enrollment and region. Confirm project-specific eligibility before a quote.",
  },
  {
    q: "Where do you deliver, and can I pick up?",
    a: "Free will-call pickup is available same-day in Newark, CA. We coordinate local delivery across the Bay Area (San Jose, Oakland, Fremont, San Francisco, the Peninsula, East Bay, South Bay, North Bay) and offer LTL freight, quoted after the order.",
  },
  {
    q: "Are TCL systems certified and warrantied?",
    a: "The lineup is AHRI Certified and ENERGY STAR listed, with ETL Intertek certification. Warranties are stated per SKU (for example, 7-year compressor / 5-year parts on core BreezeIN models).",
  },
];

export default function ResourcesPage() {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="border-b border-line bg-surface-1">
        <Container className="grid gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-14">
          <div>
            <Eyebrow>Resources</Eyebrow>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
              Everything you need to spec, install, and close the rebate.
            </h1>
            <p className="mt-3 max-w-2xl text-ink-2">
              SKU-level spec sheets, install manuals, and current rebate guidance in one place,
              so you spend less time hunting for documents and more time on the roof.
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

      {/* Document library */}
      <Container className="pb-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">
          Spec sheets &amp; install manuals
        </h2>
        <p className="mt-2 text-sm text-ink-3">
          Download exact support documents for the SKU you are quoting.
        </p>
        <div className="mt-6 overflow-hidden rounded-(--r-md) border border-line">
          {getStorefrontSkus().map((sku, i) => (
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
      className="inline-flex items-center gap-1.5 rounded-(--r-sm) border border-line bg-surface-1 px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:border-ink-4 hover:text-ink-1"
    >
      {icon}
      {label}
      <ArrowRight size={13} className="text-ink-4" />
    </a>
  );
}
