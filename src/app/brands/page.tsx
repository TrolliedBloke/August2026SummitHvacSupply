import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

const BRAND_LOGOS: Record<string, { src: string; alt: string }> = {
  Carrier: { src: "/brands/carrier-logo.png", alt: "Carrier" },
  TCL: { src: "/brands/tcl-logo.png", alt: "TCL" },
  Tosot: { src: "/brands/tosot-logo.png", alt: "TOSOT" },
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
    <section className="bg-surface-1">
      <div className="mx-auto w-full max-w-[1344px] px-5 py-12 sm:px-7 sm:py-14 lg:px-8 lg:pb-8 lg:pt-20">
        <header>
          <h1 className="counter-heading text-[2.7rem] leading-[0.94] text-ink-1 sm:text-[3.25rem]">
            Brands we stock
          </h1>
          <p className="mt-4 max-w-[790px] text-[1.05rem] leading-8 text-ink-2 sm:text-lg">
            Equipment lines carried at the Newark branch. Counts below are the SKUs in the
            current catalog, not a manufacturer&rsquo;s full range.
          </p>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {brands.map((brand) => (
            <Link
              key={brand.name}
              href={`/products?brand=${encodeURIComponent(brand.name)}`}
              className="group flex min-h-[438px] flex-col overflow-hidden rounded-[5px] border border-line bg-surface-1 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-strong"
            >
              <div className="grid h-[224px] place-items-center border-b border-line bg-[#fbfaf7] px-7">
                {brand.name === "TCL" ? (
                  <div className="grid h-[112px] w-[248px] max-w-full place-items-center bg-[#c8102e] px-7">
                    <Image
                      src={BRAND_LOGOS.TCL.src}
                      alt={BRAND_LOGOS.TCL.alt}
                      width={286}
                      height={89}
                      sizes="248px"
                      className="h-auto w-full brightness-0 invert"
                    />
                  </div>
                ) : brand.name === "Tosot" ? (
                  <div className="relative h-[104px] w-[330px] max-w-full overflow-hidden">
                    <Image
                      src={BRAND_LOGOS.Tosot.src}
                      alt={BRAND_LOGOS.Tosot.alt}
                      fill
                      sizes="990px"
                      className="scale-[3] object-contain"
                    />
                  </div>
                ) : (
                  <Image
                    src={BRAND_LOGOS[brand.name]?.src ?? "/logo-summit.svg"}
                    alt={BRAND_LOGOS[brand.name]?.alt ?? brand.name}
                    width={800}
                    height={320}
                    sizes="288px"
                    className="h-auto w-[288px] max-w-[88%] object-contain"
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h2 className="counter-heading text-[1.45rem] leading-none text-ink-1">{brand.name}</h2>
                <p className="part-number mt-2 text-xs uppercase tracking-[0.02em] text-ink-3">
                  {brand.count} SKUs
                  {brand.from !== null ? ` · from ${currency(brand.from)}` : ""}
                </p>
                <p className="mt-4 flex-1 text-[0.95rem] leading-7 text-ink-2">
                  {BRAND_NOTES[brand.name] ?? brand.categories.join(", ")}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-[0.95rem] font-semibold text-brand">
                  Shop {brand.name}
                  <ArrowRight size={17} className="transition-transform duration-150 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-8 max-w-[820px] text-[0.95rem] leading-7 text-ink-2">
          Line sets, covers, pads, disconnects, and other installation supplies are stocked
          unbranded.{" "}
          <Link
            href="/products?category=installation-supplies"
            className="font-medium text-brand underline underline-offset-4"
          >
            Browse installation supplies
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
