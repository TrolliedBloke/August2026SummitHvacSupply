import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui";
import { pageMetadata } from "@/lib/seo/metadata";
import { getStorefrontSkus } from "@/lib/storefront/catalog";

export const metadata: Metadata = pageMetadata({
  title: "Brands We Stock - TCL, Tosot, Carrier",
  description:
    "The equipment brands Summit HVAC Supply carries in Newark, California, with the SKU count and categories stocked for each.",
  path: "/brands",
});

/* Copy is per brand and written once. Anything factual about assortment --
   counts, categories, price floor -- is derived from the catalog below rather
   than typed here, so this page cannot drift from what is actually stocked. */
const BRAND_NOTES: Record<string, string> = {
  TCL: "Mini-split indoor and outdoor units, multi-zone condensers, air handlers, and cassettes.",
  Tosot: "Wall-mount mini-splits and multi-zone outdoor units, including R-32 A2L equipment.",
  Carrier: "Central-system equipment: furnaces, evaporator coils, and matched air handlers.",
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function BrandsPage() {
  const skus = getStorefrontSkus();

  // "Unbranded" covers fittings, covers, and line sets -- real inventory, but
  // not a brand anyone shops by. It stays out of a page about brands.
  const brands = Array.from(new Set(skus.map((sku) => sku.brand)))
    .filter((brand) => brand && brand !== "Unbranded")
    .sort()
    .map((brand) => {
      const owned = skus.filter((sku) => sku.brand === brand);
      const priced = owned.map((sku) => sku.retailPrice).filter((p): p is number => p !== null);
      const categories = Array.from(new Set(owned.map((sku) => sku.categoryLabel))).sort();
      return {
        name: brand,
        count: owned.length,
        from: priced.length > 0 ? Math.min(...priced) : null,
        categories,
      };
    });

  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="py-12 lg:py-16">
          <h1 className="counter-heading max-w-[18ch] text-[2.4rem] leading-[0.95] text-ink-1 sm:text-[3rem]">
            Brands we stock
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-2">
            Equipment lines carried at the Newark branch. Counts below are the SKUs in the
            current catalog, not a manufacturer&rsquo;s full range.
          </p>
        </Container>
      </section>

      <Container className="py-10 lg:py-14">
        <div className="grid gap-2 md:grid-cols-3">
          {brands.map((brand) => (
            <Link
              key={brand.name}
              href={`/products?brand=${encodeURIComponent(brand.name)}`}
              className="group flex flex-col rounded-(--r-md) border border-line bg-surface-1 p-5 transition-colors duration-150 hover:border-line-strong"
            >
              <h2 className="counter-heading text-[1.4rem] leading-none text-ink-1">{brand.name}</h2>
              <p className="part-number mt-2 text-xs uppercase text-ink-3">
                {brand.count} SKUs
                {brand.from !== null ? ` · from ${currency(brand.from)}` : ""}
              </p>
              <p className="mt-3 flex-1 text-sm leading-6 text-ink-2">
                {BRAND_NOTES[brand.name] ?? brand.categories.join(", ")}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink-1">
                Shop {brand.name}
                <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-6 text-ink-2">
          Line sets, covers, pads, disconnects, and other installation supplies are stocked
          unbranded.{" "}
          <Link
            href="/products?category=installation-supplies"
            className="text-ink-1 underline underline-offset-4"
          >
            Browse installation supplies
          </Link>
          .
        </p>
      </Container>
    </>
  );
}
