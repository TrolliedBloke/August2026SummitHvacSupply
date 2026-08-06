import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  FileText,
  BookOpen,
  Check,
  Leaf,
  ArrowRight,
  Wrench,
} from "lucide-react";
import {
  SERIES,
  getSeries,
  btuLabel,
  CATEGORY_LABEL,
  ENERGY_STAR_LABEL,
  type Series,
} from "@/lib/products";
import { Container, Chip, LinkButton } from "@/components/ui";
import { SpecStockStrip } from "@/components/spec-stock-strip";
import { AddToQuote } from "@/components/add-to-quote";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BuyBoxAssurance } from "@/components/buy-box-assurance";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { ProductReviews, ReviewStarsInline } from "@/components/product-reviews";
import { DeliveryEstimate } from "@/components/delivery-estimate";
import { StickyBuyBar } from "@/components/sticky-buy-bar";
import { reviewSummary } from "@/lib/reviews";
import { getPublishedReviews } from "@/lib/backend/reviews";
import { accessoriesForCategory } from "@/lib/accessories";
import { PURCHASE, REBATES, SITE } from "@/lib/site";
import { getSeriesBackendSummary } from "@/lib/backend/services";
import { getSeededSeriesCardSummary } from "@/lib/backend/catalog";
import {
  documentHref,
  getSeriesPriceRange,
  getStorefrontSkus,
  productHref,
} from "@/lib/storefront/catalog";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function generateStaticParams() {
  return SERIES.map((s) => ({ series: s.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[series]">): Promise<Metadata> {
  const { series } = await params;
  const s = getSeries(series);
  if (!s) return { title: "Product not found" };
  return pageMetadata({
    title: `${s.name} - ${s.family}`,
    description: `${s.tagline} ${s.description}`,
    path: `/products/${s.slug}`,
    image: s.image,
    index: s.confirm.length === 0,
  });
}

export default async function SeriesPage({ params }: PageProps<"/products/[series]">) {
  const { series } = await params;
  const s = getSeries(series);
  if (!s) notFound();

  const energyStar = ENERGY_STAR_LABEL[s.energyStar];
  const related = SERIES.filter((x) => x.slug !== s.slug && x.category === s.category).slice(0, 3);
  const fallbackRelated = SERIES.filter((x) => x.slug !== s.slug).slice(0, 3);
  const relatedList = related.length ? related : fallbackRelated;
  const backendSummary = await getSeriesBackendSummary(s.slug);
  const storefrontSkus = getStorefrontSkus().filter((sku) => sku.seriesSlug === s.slug);
  const representativeSku = storefrontSkus[0];
  const priceRange = getSeriesPriceRange(s.slug);
  const msrpBySkuId = new Map(storefrontSkus.map((sku) => [sku.id, sku.msrp]));
  const reviews = await getPublishedReviews(s.slug, s.slug);
  const ratingSummary = reviewSummary(reviews);

  const faqs = [
    {
      q: "Can I buy this without a contractor account?",
      a: "Yes. Every system is sold at the listed retail price with no trade account required — check out online for Newark will-call pickup or Bay Area delivery. Contractors sign in for pro pricing and net terms.",
    },
    {
      q: "What size system do I need?",
      a: "Sizing depends on square footage, insulation, windows, and climate zone — a licensed installer confirms it with a load calculation before purchase. As a rough guide, 9–12k BTU covers a typical bedroom or office, 18–24k a large living area, and 36k+ whole-home or light-commercial zones. Start a homeowner request and we'll help you land on the right capacity.",
    },
    {
      q: "Who installs the equipment?",
      a: "Installation is handled by licensed HVAC contractors. If you don't have one, Summit can refer qualified Bay Area installers who work with TCL equipment — request installer help and we'll connect you.",
    },
    {
      q: "What rebates or tax credits apply?",
      a: REBATES.map((r) => `${r.name}: ${r.detail}`).join(" ") +
        " Your installing contractor confirms final eligibility for each program.",
    },
    {
      q: "What is the return policy?",
      a: PURCHASE.returnsDetail,
    },
    {
      q: "How fast can I get it?",
      a: `${PURCHASE.delivery}. Freight to the broader West Coast is quoted before any charge.`,
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // Product structured data (escaped per Next.js JSON-LD guidance).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${s.family} (${s.name})`,
    description: s.description,
    brand: { "@type": "Brand", name: "TCL" },
    category: CATEGORY_LABEL[s.category],
    offers: priceRange
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: priceRange.low,
          highPrice: priceRange.high,
          offerCount: priceRange.count,
          availability:
            s.stock === "ready"
              ? "https://schema.org/InStock"
              : "https://schema.org/PreOrder",
          seller: { "@type": "Organization", name: SITE.name },
        }
      : {
          "@type": "Offer",
          availability:
            s.stock === "ready"
              ? "https://schema.org/InStock"
              : "https://schema.org/PreOrder",
          seller: { "@type": "Organization", name: SITE.name },
        },
    ...(ratingSummary
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: ratingSummary.average,
            reviewCount: ratingSummary.count,
          },
        }
      : {}),
    additionalProperty: [
      { "@type": "PropertyValue", name: "SEER2", value: s.seer2 },
      ...(s.hspf2 ? [{ "@type": "PropertyValue", name: "HSPF2", value: s.hspf2 }] : []),
      { "@type": "PropertyValue", name: "Capacity (BTU)", value: btuLabel(s) },
      { "@type": "PropertyValue", name: "Min operating temp", value: s.minTemp },
      { "@type": "PropertyValue", name: "Refrigerant", value: s.refrigerant },
    ],
  };

  return (
    <>
      {s.confirm.length === 0 && <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />

      {/* Breadcrumb (visible trail + BreadcrumbList JSON-LD) */}
      <div className="border-b border-line bg-surface-1">
        <Container className="py-3">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Shop Systems", href: "/products" },
              { label: s.name, href: `/products/${s.slug}` },
            ]}
          />
        </Container>
      </div>

      <Container className="py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Gallery — same component as the SKU page: real zoom, keyboard nav,
              and a spec frame as the honest second slide (no duplicate thumbs). */}
          <div>
            <ProductGallery
              images={[s.image]}
              title={s.name}
              specs={[
                { label: "SEER2", value: `${s.seer2}` },
                { label: "HSPF2", value: s.hspf2 ? `${s.hspf2}` : "n/a" },
                { label: "Capacity", value: `${btuLabel(s)} BTU` },
                { label: "Min temp", value: s.minTemp },
              ]}
            />
          </div>

          {/* Buy box */}
          <div>
            <div className="flex items-center gap-2">
              <Chip tone="neutral">{CATEGORY_LABEL[s.category]}</Chip>
              {energyStar && <Chip tone="eco"><Leaf size={12} strokeWidth={2.5} /> {energyStar}</Chip>}
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
              {s.name}
            </h1>
            <p className="mt-1 font-mono text-sm text-ink-3">{s.family}</p>
            {ratingSummary && (
              <a href="#reviews" className="mt-2 inline-block">
                <ReviewStarsInline summary={ratingSummary} />
              </a>
            )}
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
              Type: {s.type}
            </p>

            {/* Retail price up front — homeowners see a number before any CTA. */}
            {priceRange && (
              <div className="mt-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tnum font-display text-3xl font-semibold tracking-tight text-ink-1">
                    From {currency(priceRange.low)}
                  </span>
                  <span className="text-sm text-ink-2">
                    retail · {priceRange.count} sizes up to {currency(priceRange.high)}
                  </span>
                </div>
                {/* Advertising a specific monthly payment triggers Regulation Z
                    §1026.24(d) disclosure duties (APR, repayment terms, down
                    payment). Stating that financing exists does not. */}
                <p className="mt-1.5 text-sm text-ink-2">
                  <span className="font-semibold text-ink-1">Financing available</span>{" "}
                  on approved credit.{" "}
                  <Link href="/portal/login" className="font-medium text-brand hover:text-brand-hover">
                    Contractor? Sign in for pro pricing
                  </Link>
                </p>
              </div>
            )}

            <SpecStockStrip series={s} className="mt-6" />
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-(--r-sm) border border-line bg-line text-center">
              <BackendCell label="SKUs" value={`${backendSummary.skus.length}`} />
              <BackendCell label="Available" value={`${backendSummary.availableUnits}`} />
              <BackendCell
                label="Retail from"
                value={priceRange ? currency(priceRange.low) : "Quote"}
              />
            </div>

            <ul className="mt-6 grid gap-2.5">
              {s.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2.5 text-[15px] text-ink-1">
                  <Check size={17} className="shrink-0 text-eco" strokeWidth={2.5} />
                  {h}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {representativeSku && <AddToQuote sku={representativeSku} full />}
              <LinkButton href="/quote" variant="secondary" size="md" className="sm:w-auto">
                Request a Quote
              </LinkButton>
            </div>
            <p className="mt-3 text-sm text-ink-2">
              No trade account required — buy retail online, pick up at Newark
              will-call, or get Bay Area delivery.
            </p>
            <DeliveryEstimate inStock={s.stock === "ready"} />

            <BuyBoxAssurance price={priceRange?.low} className="mt-5" />

            {/* Support requests */}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <RequestRow
                href="/contact"
                icon={<FileText size={18} />}
                title="Download spec sheets"
                sub="SKU-level performance PDFs"
              />
              <RequestRow
                href="/resources"
                icon={<BookOpen size={18} />}
                title="Download install manuals"
                sub="Line set, wiring, startup notes by SKU"
              />
            </div>
          </div>
        </div>

        {/* Full spec table */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">
            Full specifications
          </h2>
          <div className="mt-5 overflow-hidden rounded-(--r-md) border border-line">
            <SpecTable series={s} />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">
            SKU availability
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            Newark warehouse stock, public documents, and contractor pricing after sign-in.
          </p>
          <div className="mt-5 overflow-x-auto rounded-(--r-md) border border-line">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-xs uppercase tracking-[0.12em] text-ink-3">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">BTU</th>
                  <th className="px-4 py-3 font-medium">Retail</th>
                  <th className="px-4 py-3 font-medium">Pro price</th>
                  <th className="px-4 py-3 font-medium">Available</th>
                  <th className="px-4 py-3 font-medium">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {backendSummary.skus.map((sku) => (
                  <tr key={sku.id} className="bg-surface-1">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink-1">
                      <Link href={productHref(sku)} className="hover:text-brand">{sku.sku}</Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{sku.modelNumber}</td>
                    <td className="px-4 py-3 tnum font-mono">{sku.btu.toLocaleString()}</td>
                    <td className="px-4 py-3 tnum font-mono font-semibold text-ink-1">
                      {msrpBySkuId.has(sku.id) ? currency(msrpBySkuId.get(sku.id)!) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link href="/portal/login" className="text-brand hover:text-brand-hover">
                        Sign in
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Chip tone={sku.status === "ready" ? "stock" : sku.status === "low" ? "copper" : "lead"}>
                        {sku.available} {sku.status}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-3">
                      <div className="flex flex-wrap gap-2">
                        {backendSummary.documents.filter((doc) => doc.skuId === sku.id).map((doc) => (
                          <a key={doc.id} href={documentHref(doc)} className="font-medium text-brand hover:text-brand-hover">
                            {doc.kind === "spec_sheet" ? "Spec" : "Manual"}
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cross-sell — the accessories a bare-condenser order is missing. */}
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">
                Complete your install
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                Common companion items for this system — add them to your quote and we&apos;ll confirm exact parts.
              </p>
            </div>
            <Link href="/quote" className="text-sm font-medium text-brand hover:text-brand-hover">
              Add accessories to quote →
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accessoriesForCategory(s.category).map((item) => (
              <div key={item.key} className="rounded-(--r-md) border border-line bg-surface-1 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-(--r-sm) bg-copper-tint text-copper">
                    <Wrench size={16} />
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink-1">{item.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-2">{item.blurb}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Side-by-side comparison — real spec deltas, not just related cards. */}
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">
              Compare across the lineup
            </h2>
            <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover">
              All series <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-6 overflow-x-auto rounded-(--r-md) border border-line">
            <ComparisonTable current={s} others={relatedList} />
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedList.map((r) => (
              <ProductCard key={r.slug} series={r} ops={getSeededSeriesCardSummary(r.slug)} />
            ))}
          </div>
        </section>

        <ProductReviews reviews={reviews} summary={ratingSummary} />

        <section className="mt-16 border-t border-line pt-7" aria-labelledby="planning-guides">
          <h2 id="planning-guides" className="font-display text-2xl font-semibold tracking-tight text-ink-1">Project planning guides</h2>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <Link href="/tools/ahri-match-finder" className="text-ink-1 underline underline-offset-4">AHRI match finder</Link>
            <Link href="/tools/system-sizing-estimator" className="text-ink-1 underline underline-offset-4">Sizing conversation starter</Link>
            <Link href="/guides/bay-area-hvac-permits" className="text-ink-1 underline underline-offset-4">Bay Area permit planning</Link>
            <Link href="/guides/r-32-r-454b-a2l-transition" className="text-ink-1 underline underline-offset-4">A2L refrigerant guide</Link>
          </div>
        </section>

        {/* FAQ — mirrors the FAQPage JSON-LD above (one content source). */}
        <section className="mt-16" aria-labelledby="series-faq">
          <h2 id="series-faq" className="font-display text-2xl font-semibold tracking-tight text-ink-1">
            Common questions
          </h2>
          <div className="mt-5 grid gap-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-(--r-md) border border-line bg-surface-1 px-5 py-4 open:bg-surface-2/40"
              >
                <summary className="cursor-pointer list-none font-display text-[15px] font-semibold text-ink-1 marker:content-none">
                  {f.q}
                </summary>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </Container>

      {representativeSku && priceRange && (
        <StickyBuyBar sku={representativeSku} priceLabel={`From ${currency(priceRange.low)}`} />
      )}
    </>
  );
}

function ComparisonTable({ current, others }: { current: Series; others: Series[] }) {
  const columns = [current, ...others];
  const rows: { label: string; value: (x: Series) => string }[] = [
    { label: "Retail from", value: (x) => {
      const range = getSeriesPriceRange(x.slug);
      return range ? currency(range.low) : "Quote";
    } },
    { label: "SEER2", value: (x) => `${x.seer2}` },
    { label: "HSPF2", value: (x) => (x.hspf2 ? `${x.hspf2}` : "n/a") },
    { label: "Capacity", value: (x) => `${btuLabel(x)} BTU` },
    { label: "Max zones", value: (x) => `${x.zones}` },
    { label: "Min operating temp", value: (x) => x.minTemp },
    { label: "Refrigerant", value: (x) => x.refrigerant },
    { label: "Warranty", value: (x) => `${x.warrantyCompressor} / ${x.warrantyParts}` },
  ];
  return (
    <table className="w-full min-w-[720px] text-left text-sm">
      <thead className="border-b border-line bg-surface-2/60">
        <tr>
          <th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
            Spec
          </th>
          {columns.map((x, i) => (
            <th key={x.slug} className="px-4 py-3">
              <Link
                href={`/products/${x.slug}`}
                className={`font-display text-sm font-semibold ${i === 0 ? "text-brand" : "text-ink-1 hover:text-brand"}`}
              >
                {x.name}
                {i === 0 && <span className="ml-1.5 font-sans text-xs font-medium text-ink-3">(this page)</span>}
              </Link>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr key={row.label} className="bg-surface-1">
            <th scope="row" className="px-4 py-3 font-medium text-ink-2">
              {row.label}
            </th>
            {columns.map((x) => (
              <td key={x.slug} className="tnum px-4 py-3 font-mono font-medium text-ink-1">
                {row.value(x)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BackendCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-1 px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">{label}</p>
      <p className="tnum mt-1 font-mono text-sm font-semibold text-ink-1">{value}</p>
    </div>
  );
}

function RequestRow({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-(--r-sm) border border-line bg-surface-1 p-3 text-left transition-colors hover:border-ink-4 hover:bg-surface-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-1">{title}</span>
        <span className="block truncate text-xs text-ink-3">{sub}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-ink-3 group-hover:text-brand" />
    </Link>
  );
}

function SpecTable({ series: s }: { series: Series }) {
  const rows: { label: string; value: string }[] = [
    { label: "Series family", value: s.family },
    { label: "Live site type", value: s.type },
    { label: "System type", value: CATEGORY_LABEL[s.category] },
    { label: "Configuration", value: s.ducted ? "Ducted" : "Ductless" },
    { label: "SEER2 (cooling efficiency)", value: `${s.seer2}` },
    { label: "HSPF2 (heating efficiency)", value: s.hspf2 ? `${s.hspf2}` : "n/a" },
    { label: "Capacity range", value: `${btuLabel(s)} BTU` },
    { label: "Max zones", value: `${s.zones}` },
    { label: "Min operating temp", value: s.minTemp },
    { label: "Refrigerant", value: s.refrigerant },
    {
      label: "Warranty",
      value: `${s.warrantyCompressor} compressor · ${s.warrantyParts} parts`,
    },
  ];

  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={r.label}
            className={i % 2 === 0 ? "bg-surface-1" : "bg-surface-2/50"}
          >
            <th
              scope="row"
              className="w-1/2 border-b border-line px-4 py-3 font-medium text-ink-2 sm:w-2/5"
            >
              {r.label}
            </th>
            <td className="tnum border-b border-line px-4 py-3 font-mono font-medium text-ink-1">
              {r.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
