import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Box, FileQuestion, ImageOff, PackageSearch, ShieldQuestion } from "lucide-react";
import { AddToQuote } from "@/components/add-to-quote";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductGallery } from "@/components/product-gallery";
import { Container, LinkButton } from "@/components/ui";
import { getRelatedSkus, getStorefrontSku, getStorefrontSkus, productHref, skuSlug } from "@/lib/storefront/catalog";
import { getSkuSeoState } from "@/lib/seo/catalog";
import { pageMetadata } from "@/lib/seo/metadata";

// Every valid slug is known at build time. Without this, an unknown slug is
// rendered on demand and notFound() is served with HTTP 200 -- a soft 404 that
// lets search engines index junk URLs. Unknown params now 404 outright.
export const dynamicParams = false;

export function generateStaticParams() {
  return getStorefrontSkus().map((sku) => ({ sku: skuSlug(sku.sku) }));
}

export async function generateMetadata({ params }: PageProps<"/products/sku/[sku]">): Promise<Metadata> {
  const { sku: skuParam } = await params;
  const sku = getStorefrontSku(decodeURIComponent(skuParam));
  if (!sku) return { title: "SKU not found" };
  const details = [sku.brand, sku.modelNumber, sku.btu ? `${sku.btu.toLocaleString()} BTU` : null, sku.productType].filter(Boolean).join(" · ");
  return pageMetadata({
    title: `${sku.sku} - ${sku.title}`,
    description: `${sku.title}. ${details}. Request verified price, availability, documents, and compatibility from Summit HVAC Supply.`,
    path: productHref(sku),
    index: getSkuSeoState(sku).indexable,
  });
}

export default async function SkuPage({ params }: PageProps<"/products/sku/[sku]">) {
  const { sku: skuParam } = await params;
  const sku = getStorefrontSku(decodeURIComponent(skuParam));
  if (!sku) notFound();
  const related = getRelatedSkus(sku, 4);
  const specs = [
    ["Brand", sku.brand],
    ["Internal SKU", sku.sku],
    ["Manufacturer model", sku.modelNumber],
    ["Equipment type", sku.productType],
    ["Capacity", sku.btu ? `${sku.btu.toLocaleString()} BTU${sku.tonnage ? ` (${sku.tonnage} ton)` : ""}` : null],
    ["Voltage", sku.voltage || null],
    // The sheet writes "R454B/A2L". A2L is the ASHRAE flammability class and
    // drives leak-detection, storage and handling requirements, so it travels
    // with the refrigerant rather than being normalised away.
    ["Refrigerant", sku.refrigerant ? `${sku.refrigerant}${sku.refrigerantClass ? ` (${sku.refrigerantClass})` : ""}` : null],
    ["Zones", sku.zones || null],
    ["Bundle / kit", sku.bundleName],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <>
      <div className="border-b border-line bg-surface-1">
        <Container className="py-3"><Breadcrumbs items={[{ label: "Products", href: "/products" }, { label: sku.categoryLabel, href: `/products?category=${sku.category}` }, { label: sku.sku, href: productHref(sku) }]} /></Container>
      </div>
      <Container className="py-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
          <div>
            {sku.imageVerified && sku.images.length > 0 ? (
              <>
                <ProductGallery images={sku.images} title={sku.title} />
                <p className="mt-3 text-xs leading-5 text-ink-3">{sku.imageExactModel ? "Exact-model manufacturer image verified." : "Official manufacturer family photography. Capacity-specific cabinet size, connections, and included components may vary; confirm the model before ordering."}</p>
              </>
            ) : (
              <div className="grid min-h-80 place-items-center rounded-(--r-md) border border-line bg-surface-2 p-8 text-center">
                <div><ImageOff className="mx-auto text-ink-3" size={36} aria-hidden="true" /><p className="mt-3 font-medium text-ink-1">Actual product image not yet available</p><p className="mt-1 max-w-sm text-sm text-ink-2">This item has no manufacturer-backed image match. Summit will not substitute a generated or unrelated product render.</p></div>
              </div>
            )}
          </div>

          <section aria-labelledby="product-title">
            <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-line bg-surface-1 px-3 py-1 text-ink-2">{sku.brand}</span><span className="rounded-full border border-line bg-surface-1 px-3 py-1 text-ink-2">{sku.categoryLabel}</span><span className="rounded-full border border-line bg-surface-1 px-3 py-1 text-ink-2">{sku.productType}</span></div>
            <p className="part-number mt-5 text-sm text-ink-3">SKU {sku.sku}</p>
            <h1 id="product-title" className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">{sku.title}</h1>
            <p className="part-number mt-3 text-sm text-ink-2">{sku.modelNumber ? `Manufacturer model ${sku.modelNumber}` : "Manufacturer model not supplied"}</p>

            <div className="mt-6 border-y border-line py-5">
              <p className="text-sm text-ink-3">Price</p>
              <p className="mt-1 text-3xl font-semibold text-ink-1">{sku.retailPrice !== null ? currency(sku.retailPrice) : "Request price"}</p>
              {sku.bundleName && <p className="mt-2 text-sm text-ink-2">This component may be priced as part of {sku.bundleName}. We confirm the complete configuration before quoting.</p>}
            </div>

            <div className="mt-5 rounded-(--r-md) border border-copper/30 bg-copper-tint p-4">
              <div className="flex gap-3"><PackageSearch className="mt-0.5 shrink-0 text-copper" size={20} /><div><h2 className="font-medium text-ink-1">Availability confirmation required</h2><p className="mt-1 text-sm text-ink-2">The inventory source does not contain a verified on-hand quantity. Summit will confirm Newark availability, lead time, and fulfillment before accepting an order.</p></div></div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3"><AddToQuote sku={sku} /><LinkButton href={`/contact?sku=${encodeURIComponent(sku.sku)}`} variant="secondary">Ask about compatibility</LinkButton></div>
            <p className="mt-4 text-xs leading-5 text-ink-3">Adding this item starts a quote request; it does not reserve stock or create a charge.</p>
          </section>
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-(--r-md) border border-line bg-surface-1 p-6">
            <div className="flex items-center gap-2"><Box size={19} /><h2 className="font-display text-xl font-semibold text-ink-1">Verified catalog information</h2></div>
            <dl className="mt-5 divide-y divide-line">{specs.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-sm text-ink-3">{label}</dt><dd className="text-sm font-medium text-ink-1">{value}</dd></div>)}</dl>
            <p className="mt-4 text-xs text-ink-3">Source: inventory catalog row {sku.sourceRow}. Manufacturer research status: {sku.researchStatus.replaceAll("_", " ")}.</p>
          </div>
          <div className="flex flex-col gap-4">
            <StatusCard icon={<ShieldQuestion size={20} />} title="Manufacturer warranty" body="Official warranty terms and registration requirements have not yet been verified for this exact model." />
            <StatusCard icon={<FileQuestion size={20} />} title="Documents" body="No exact-model manufacturer documents are published until their model match is verified." />
            <StatusCard icon={<AlertTriangle size={20} />} title="Compatibility" body="No system match or AHRI combination is claimed without manufacturer or AHRI evidence. Request a compatibility review before ordering." />
          </div>
        </section>

        {related.length > 0 && <section className="mt-10"><h2 className="font-display text-xl font-semibold text-ink-1">Related catalog items</h2><p className="mt-1 text-sm text-ink-2">Nearby products in the same category. Similar capacity does not prove compatibility.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{related.map((item) => <Link key={item.id} href={productHref(item)} className="rounded-(--r-sm) border border-line bg-surface-1 p-4 hover:border-line-strong"><span className="part-number text-xs text-ink-3">{item.sku}</span><span className="mt-2 block font-medium text-ink-1">{item.title}</span><span className="mt-2 block text-xs text-ink-2">{item.retailPrice !== null ? currency(item.retailPrice) : "Request price"} · availability confirmation required</span></Link>)}</div></section>}
      </Container>
    </>
  );
}

function StatusCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <article className="rounded-(--r-md) border border-line bg-surface-1 p-5"><div className="flex items-center gap-2 text-ink-1">{icon}<h2 className="font-medium">{title}</h2></div><p className="mt-2 text-sm leading-6 text-ink-2">{body}</p></article>;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}
