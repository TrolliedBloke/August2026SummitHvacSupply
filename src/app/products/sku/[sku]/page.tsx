import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Home,
  PackageCheck,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { NotifyMe } from "@/components/notify-me";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPurchasePanel } from "@/components/product-purchase-panel";
import { StickyBuyBar } from "@/components/sticky-buy-bar";
import { BuyBoxAssurance } from "@/components/buy-box-assurance";
import { ReviewStarsInline } from "@/components/product-reviews";
import { Container, LinkButton } from "@/components/ui";
import { accessoriesForCategory } from "@/lib/accessories";
import { reviewSummary } from "@/lib/reviews";
import { getPublishedReviews } from "@/lib/backend/reviews";
import {
  documentHref,
  getRelatedSkus,
  getStorefrontSku,
  getStorefrontSkus,
  productHref,
  skuSlug,
} from "@/lib/storefront/catalog";
import { SITE } from "@/lib/site";
import { getSkuAlternatives, getSkuSeoState } from "@/lib/seo/catalog";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";

export function generateStaticParams() {
  return getStorefrontSkus().map((sku) => ({ sku: skuSlug(sku.sku) }));
}

export async function generateMetadata({ params }: PageProps<"/products/sku/[sku]">): Promise<Metadata> {
  const { sku: skuParam } = await params;
  const sku = getStorefrontSku(decodeURIComponent(skuParam));
  if (!sku) return { title: "SKU not found" };
  const seo = getSkuSeoState(sku);
  return pageMetadata({
    title: `${sku.sku} - ${sku.title}`,
    description: `${sku.title}. ${sku.btu.toLocaleString()} BTU, ${sku.voltage}, ${sku.refrigerant}. See price and Newark availability.`,
    path: productHref(sku),
    image: sku.image,
    index: seo.indexable,
  });
}

export default async function SkuPage({ params }: PageProps<"/products/sku/[sku]">) {
  const { sku: skuParam } = await params;
  const sku = getStorefrontSku(decodeURIComponent(skuParam));
  if (!sku) notFound();

  const reviews = await getPublishedReviews(sku.id, sku.seriesSlug);
  const summary = reviewSummary(reviews);
  const isEquipment = sku.msrp >= 500;
  const needsProfessionalInstall = isEquipment || sku.refrigerant !== "None" || sku.voltage.includes("230");
  const needsJobKit = isEquipment;
  const hasWarrantyWindow = isEquipment;
  const hasCompliance = ["R-32", "R-454B"].includes(sku.refrigerant) || isEquipment;
  const hasRebatePath = isEquipment && (sku.title.toLowerCase().includes("heat") || sku.category === "ducted");
  const systemBuilder = isEquipment && ["ductless", "ducted", "commercial"].includes(sku.category);
  const related = getRelatedSkus(sku, 6);
  const alternatives = getSkuAlternatives(sku, getStorefrontSkus());
  const seo = getSkuSeoState(sku);
  const equivalent = related.find((item) => item.available > 0);
  const branches = branchStock(sku.available);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: sku.title,
    description: `${sku.title}, ${sku.btu.toLocaleString()} BTU, ${sku.voltage}, ${sku.refrigerant}.`,
    sku: sku.sku,
    mpn: sku.modelNumber,
    image: `${SITE.origin}${sku.image}`,
    brand: { "@type": "Brand", name: "TCL" },
    offers: {
      "@type": "Offer",
      url: `${SITE.origin}${productHref(sku)}`,
      priceCurrency: "USD",
      price: sku.msrp,
      availability: sku.available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: SITE.name },
    },
    ...(summary ? { aggregateRating: { "@type": "AggregateRating", ratingValue: summary.average, reviewCount: summary.count } } : {}),
  };

  return (
    <>
      {seo.indexable && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />}
      <div className="border-b border-line bg-surface-1">
        <Container className="py-3">
          <Breadcrumbs items={[
            { label: "Shop systems", href: "/products" },
            { label: sku.categoryLabel, href: `/products?category=${sku.category}` },
            { label: sku.sku, href: productHref(sku) },
          ]} />
        </Container>
      </div>

      <Container className="py-6 sm:py-8">
        <div className="grid gap-7 lg:grid-cols-[1fr_1.03fr] lg:gap-8">
          <ProductGallery
            images={[sku.image]}
            title={sku.title}
            specs={[
              { label: "Capacity", value: `${sku.btu.toLocaleString()} BTU` },
              { label: "Dimensions", value: sku.dimensions },
              { label: "Weight", value: `${sku.weightLbs} lb` },
              { label: "Voltage", value: sku.voltage },
            ]}
          />

          <section aria-labelledby="product-identity">
            <span className="hidden rounded-full border border-line bg-surface-1 px-3 py-1 text-xs text-ink-2 sm:inline-flex">{sku.categoryLabel}</span>
            <h1 id="product-identity" className="part-number mt-0 break-all text-3xl font-medium leading-tight text-ink-1 sm:mt-4 sm:text-4xl">{sku.sku}</h1>
            <p className="mt-2 text-xl text-ink-2">{sku.title}</p>
            <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-ink-2">
              <span>{sku.btu.toLocaleString()} BTU</span><span aria-hidden>·</span><span className="part-number">{sku.voltage}</span><span aria-hidden>·</span><span>{sku.unitType}</span><span aria-hidden>·</span><span className="part-number">{sku.refrigerant}</span>
            </p>
            {summary && <a href="#reviews" className="mt-3 inline-flex"><ReviewStarsInline summary={summary} /></a>}

            <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span className="text-3xl font-medium text-ink-1">{currency(sku.msrp)}</span>
              <span className="text-sm text-ink-3">List price</span>
              <Link href="/portal/login" className="text-sm text-ink-1 underline underline-offset-4">Sign in for your price</Link>
            </div>

            <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-(--r-sm) border border-line sm:grid-cols-4">
              <Metric label="Capacity" value={`${sku.btu.toLocaleString()} BTU`} />
              <Metric label="Voltage" value={sku.voltage} mono />
              <Metric label="Refrigerant" value={sku.refrigerant} mono />
              <Metric label="Unit type" value={shortUnitType(sku.unitType)} />
            </dl>

            <div className="mt-5 rounded-(--r-md) border border-line bg-surface-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-medium text-ink-1"><PackageCheck size={18} />{sku.available > 0 ? "Available for pickup - free" : "Pickup availability"}</h2>
                <span className={`text-xs ${sku.available > 0 ? "text-stock-ready" : "text-ink-2"}`}>{sku.available > 0 ? "Delivery available" : "Delivery after receipt"}</span>
              </div>

              {sku.available > 0 ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {branches.map((branch, index) => (
                      <div key={branch.name} className={`rounded-(--r-sm) border p-3 ${index === 0 ? "border-ink-1" : "border-line"}`}>
                        <p className="text-xs font-medium text-ink-1">{branch.name}</p>
                        <p className={`mt-1 text-xs ${branch.confirmed ? "text-stock-ready" : "text-ink-3"}`}>{branch.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-ink-2"><span>Will-call until 5:00pm today in Newark</span><Link href="/bay-area-hvac-supply" className="text-ink-1 underline underline-offset-4">View all locations</Link></div>
                  <div className="mt-5"><ProductPurchasePanel sku={sku} /></div>
                  <BuyBoxAssurance price={sku.msrp} className="mt-5" />
                </>
              ) : (
                <OutOfStock skuId={sku.id} equivalent={equivalent} />
              )}
            </div>
          </section>
        </div>

        {isEquipment && <AudienceSplit />}
        {systemBuilder && <SystemBuilder sku={sku} />}
        {needsJobKit && <JobKit category={sku.category} />}
        {!isEquipment && <BulkPricing sku={sku} />}
        {!isEquipment && related.length > 0 && <RelatedParts items={related.slice(0, 4)} />}
        {isEquipment && alternatives.length > 0 && <AlternativeModels items={alternatives} />}

        <section className="mt-6 overflow-hidden rounded-(--r-sm) border border-line bg-surface-1" aria-label="Product details">
          <Detail title="Specifications" summary="Performance, electrical, dimensions, and identifiers." icon={<Box size={19} />}>
            <dl className="grid sm:grid-cols-2">
              <Spec label="Part number" value={sku.sku} mono />
              <Spec label="Model number" value={sku.modelNumber} mono />
              <Spec label="Capacity" value={`${sku.btu.toLocaleString()} BTU`} />
              <Spec label="Voltage" value={sku.voltage} mono />
              <Spec label="Refrigerant" value={sku.refrigerant} mono />
              <Spec label="Dimensions" value={sku.dimensions} />
              <Spec label="Weight" value={`${sku.weightLbs} lb`} />
              <Spec label="AHRI reference" value={sku.ahriReference} mono />
            </dl>
          </Detail>
          <Detail title="Documents" summary="Submittals, manuals, wiring diagrams, and certificates." icon={<FileText size={19} />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {sku.documents.map((doc) => <a key={doc.id} href={documentHref(doc)} data-conversion-hook="product-document-download" className="flex items-center justify-between rounded-(--r-sm) border border-line p-3 text-sm text-ink-1"><span>{doc.title}</span><span aria-hidden>Download</span></a>)}
            </div>
          </Detail>
          {hasWarrantyWindow && <Detail title="Warranty" summary="Coverage details and registration information." icon={<ShieldCheck size={19} />}><p>{sku.warrantyCompressor} compressor coverage and {sku.warrantyParts} parts coverage. Confirm registration timing in the manufacturer warranty document.</p></Detail>}
          {needsProfessionalInstall && <Detail title="Who can install this" summary="Licensed contractor required for final installation." icon={<UserRound size={19} />}><p>Final sizing, electrical work, refrigerant work, permits, startup, and commissioning must be confirmed by a qualified local contractor.</p><Link href="/homeowners#homeowner-request" className="mt-3 inline-flex underline underline-offset-4">Get Bay Area installer help</Link></Detail>}
          {hasCompliance && <Detail title="Compliance and permits" summary="A2L refrigerant and local code requirements." icon={<FileText size={19} />}><p>Installer must confirm current Bay Area permit, California code, Title 24, and refrigerant handling requirements for the project address.</p><Link href="/guides/california-title-24-hvac-changeouts" className="mt-3 inline-flex underline underline-offset-4">Read California changeout guidance</Link></Detail>}
          {hasRebatePath && <Detail title="Rebate eligibility" summary="Check program and matched-system requirements before ordering." icon={<Check size={19} />}><p>Eligibility depends on the complete matched system, installation address, contractor documentation, and active program rules. Verify before purchase.</p><Link href="/bay-area-heat-pump-rebates" className="mt-3 inline-flex underline underline-offset-4">See Bay Area rebate guidance</Link></Detail>}
          <Detail title="Q&A" summary="Get product questions answered." icon={<CircleHelp size={19} />}><p>Need a compatibility or application check? Send the part number and job conditions to the Summit counter.</p><LinkButton href={`/contact?sku=${encodeURIComponent(sku.sku)}`} variant="secondary" className="mt-4">Ask a product question</LinkButton></Detail>
          <Detail title={`Customer reviews${summary ? ` (${summary.count})` : ""}`} summary={summary ? `${summary.average.toFixed(1)} average rating` : "No reviews yet"} icon={<Star size={19} />} id="reviews">
            {reviews.length ? reviews.map((review, index) => <article key={index} className="border-b border-line py-3 last:border-0"><p className="font-medium text-ink-1">{review.title || `${review.rating} out of 5`}</p><p className="mt-1">{review.body}</p><p className="mt-2 text-xs text-ink-3">{review.author}</p></article>) : <p>No customer reviews have been submitted for this part number.</p>}
          </Detail>
        </section>
      </Container>
      {sku.available > 0 && <StickyBuyBar sku={sku} priceLabel={currency(sku.msrp)} />}
    </>
  );
}

function AlternativeModels({ items }: { items: NonNullable<ReturnType<typeof getStorefrontSku>>[] }) {
  return <section className="mt-5" aria-labelledby="alternative-models"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="alternative-models" className="font-medium text-ink-1">Alternative models</h2><p className="mt-1 text-sm text-ink-2">Nearby capacities in the same equipment category. Confirm the final match before ordering.</p></div><Link href="/tools/ahri-match-finder" className="text-sm text-ink-1 underline underline-offset-4">Check AHRI matches</Link></div><div className="mt-3 grid gap-3 sm:grid-cols-3">{items.map((item) => <Link key={item.id} href={productHref(item)} className="rounded-(--r-sm) border border-line bg-surface-1 p-4"><span className="part-number text-sm text-ink-1">{item.sku}</span><span className="mt-2 block text-sm text-ink-2">{item.title}</span><span className={`mt-3 block text-xs ${item.available > 0 ? "text-stock-ready" : "text-ink-3"}`}>{item.available > 0 ? `${item.available} on the shelf in Newark` : "Contact the counter for lead time"}</span></Link>)}</div></section>;
}

function AudienceSplit() {
  return <section className="mt-7 grid gap-4 sm:grid-cols-2" aria-label="Buying paths">
    <BuyerCard icon={<Home size={25} />} title="Buying this for your home?" body="Ships from Newark or ready for will-call. We can refer you to a qualified Bay Area installer." href="/homeowners#homeowner-request" cta="Get installer help" />
    <BuyerCard icon={<UserRound size={25} />} title="Contractor or property buyer?" body="Sign in or open a contractor account for trade pricing, quotes, and job tools." href="/dealers" cta="Create contractor account" />
  </section>;
}

function BuyerCard({ icon, title, body, href, cta }: { icon: React.ReactNode; title: string; body: string; href: string; cta: string }) {
  return <article className="rounded-(--r-sm) border border-line bg-surface-1 p-5"><div className="flex items-center gap-3 text-ink-1">{icon}<h2 className="font-medium">{title}</h2></div><p className="mt-2 text-sm leading-6 text-ink-2">{body}</p><Link href={href} className="mt-4 inline-flex text-sm text-ink-1 underline underline-offset-4">{cta}</Link></article>;
}

function SystemBuilder({ sku }: { sku: NonNullable<ReturnType<typeof getStorefrontSku>> }) {
  return <section className="mt-5 rounded-(--r-sm) border border-line bg-surface-1 p-5">
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-medium text-ink-1">Build the right system</h2><p className="mt-1 text-sm text-ink-2">AHRI-certified combinations matched for performance and warranty.</p></div><span className="font-mono text-xs text-ink-2">{sku.ahriReference}</span></div>
    <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
      <SystemItem image={sku.image} title={sku.title} identifier={sku.sku} />
      <span className="hidden sm:block">+</span>
      <SystemItem image={sku.image} title="Matched outdoor unit" identifier="AHRI match" />
      <span className="hidden sm:block">+</span>
      <SystemItem image={sku.image} title="Matched indoor unit" identifier="Confirm selection" />
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div><p className="text-sm font-medium text-ink-1">System match</p><p className="text-xs text-ink-2">Counter staff confirms the final combination.</p></div><LinkButton href={`/quote?sku=${encodeURIComponent(sku.sku)}`} variant="secondary">Build system quote</LinkButton></div>
  </section>;
}

function SystemItem({ image, title, identifier }: { image: string; title: string; identifier: string }) {
  return <div className="flex min-w-0 items-center gap-3"><div className="relative size-16 shrink-0"><Image src={image} alt="" fill sizes="64px" className="object-contain" /></div><div><p className="text-xs font-medium text-ink-1">{title}</p><p className="part-number mt-1 text-[11px] text-ink-2">{identifier}</p></div></div>;
}

function JobKit({ category }: { category: Parameters<typeof accessoriesForCategory>[0] }) {
  return <section className="mt-5"><h2 className="font-medium text-ink-1">What else you need for this job</h2><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{accessoriesForCategory(category).slice(0, 6).map((item) => <label key={item.key} className="rounded-(--r-sm) border border-line bg-surface-1 p-3"><span className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" /><span className="text-xs font-medium text-ink-1">{item.name}</span></span><span className="mt-2 block text-[11px] leading-4 text-ink-2">{item.blurb}</span></label>)}</div></section>;
}

function BulkPricing({ sku }: { sku: NonNullable<ReturnType<typeof getStorefrontSku>> }) {
  return <section className="mt-5 rounded-(--r-sm) border border-line bg-surface-1 p-4"><h2 className="font-medium text-ink-1">Bulk and case pricing</h2><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-ink-3">Each</p><p className="mt-1 text-ink-1">{currency(sku.msrp)}</p></div><div><p className="text-ink-3">Case quantity</p><Link href="/portal/login" className="mt-1 inline-flex text-ink-1 underline underline-offset-4">Sign in for case pricing</Link></div></div></section>;
}

function RelatedParts({ items }: { items: NonNullable<ReturnType<typeof getStorefrontSku>>[] }) {
  return <section className="mt-5"><h2 className="font-medium text-ink-1">Related parts and consumables</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <Link key={item.id} href={productHref(item)} className="rounded-(--r-sm) border border-line bg-surface-1 p-3"><span className="part-number text-xs text-ink-1">{item.sku}</span><span className="mt-2 block text-sm text-ink-2">{item.title}</span><span className={`mt-2 block text-xs ${item.available > 0 ? "text-stock-ready" : "text-ink-3"}`}>{item.available > 0 ? `${item.available} on the shelf` : "Backorder"}</span></Link>)}</div></section>;
}

function OutOfStock({ skuId, equivalent }: { skuId: string; equivalent?: NonNullable<ReturnType<typeof getStorefrontSku>> }) {
  return <div className="mt-4"><p className="font-medium text-ink-1">Zero on the shelf in Newark</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-(--r-sm) border border-line p-3"><p className="text-xs text-ink-3">Nearest branch stock</p><p className="mt-1 text-sm text-ink-1">Counter confirmation required</p></div><div className="rounded-(--r-sm) border border-line p-3"><p className="text-xs text-ink-3">Next Newark receipt</p><p className="mt-1 text-sm text-ink-1">Expected in 7-10 business days</p></div></div><div className="mt-4"><NotifyMe skuId={skuId} /></div>{equivalent && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-(--r-sm) border border-line p-3"><div><p className="text-xs text-ink-3">Nearest equivalent on the shelf</p><Link href={productHref(equivalent)} className="part-number mt-1 inline-flex text-sm text-ink-1 underline underline-offset-4">{equivalent.sku}</Link><p className="mt-1 text-xs text-stock-ready">{equivalent.available} available in Newark</p></div><LinkButton href={productHref(equivalent)} variant="secondary">View equivalent</LinkButton></div>}</div>;
}

function Detail({ title, summary, icon, children, id }: { title: string; summary: string; icon: React.ReactNode; children: React.ReactNode; id?: string }) {
  return <details id={id} className="group border-b border-line last:border-b-0"><summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4"><span className="text-ink-1">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink-1">{title}</span><span className="mt-0.5 block text-xs text-ink-2">{summary}</span></span><ChevronDown size={17} className="transition-transform duration-150 group-open:rotate-180" /></summary><div className="border-t border-line px-4 py-4 text-sm leading-6 text-ink-2">{children}</div></details>;
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="border-b border-r border-line p-3 last:border-r-0 sm:border-b-0"><dt className="text-[10px] text-ink-3">{label}</dt><dd className={`mt-1 text-xs font-medium text-ink-1 ${mono ? "part-number" : ""}`}>{value}</dd></div>;
}

function Spec({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="grid grid-cols-[130px_1fr] border-b border-line py-2 sm:odd:pr-5 sm:even:pl-5"><dt className="text-ink-3">{label}</dt><dd className={`text-ink-1 ${mono ? "part-number" : ""}`}>{value}</dd></div>;
}

function branchStock(available: number) {
  return [
    { name: "Newark", label: `${available} on the shelf`, confirmed: available > 0 },
    { name: "Hayward", label: "Call to confirm", confirmed: false },
    { name: "San Jose", label: "Call to confirm", confirmed: false },
    { name: "Sacramento", label: "Call to confirm", confirmed: false },
  ];
}

function shortUnitType(value: string) {
  return value.replace("single-zone ", "").replace("multi-zone ", "");
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}
