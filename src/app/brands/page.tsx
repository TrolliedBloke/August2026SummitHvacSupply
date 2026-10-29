import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { pageMetadata } from "@/lib/seo/metadata";
import { getStorefrontSkus } from "@/lib/storefront/catalog";
import { BRAND_GROUPING_THRESHOLD, brandDirectory, type BrandCard } from "@/lib/brands";

export const metadata: Metadata = pageMetadata({
  title: "Brands We Stock - TCL, Tosot, Carrier",
  description: "The equipment brands Summit HVAC Supply carries in Newark, California, with the SKU count and categories stocked for each.",
  path: "/brands",
});

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

/* Every brand renders through the registry (lib/brands.ts) and one card: no
   brand-name conditionals. Counts, price floors and categories are read from
   the catalog. Cards share a subgrid so mark, heading, note and action line up
   across a row without fixed heights. */
export default function BrandsPage() {
  const brands = brandDirectory(getStorefrontSkus());
  const grouped = brands.length > BRAND_GROUPING_THRESHOLD;
  const groups = grouped
    ? Array.from(new Set(brands.map((brand) => brand.displayName[0].toUpperCase()))).map((letter) => ({
        letter,
        brands: brands.filter((brand) => brand.displayName[0].toUpperCase() === letter),
      }))
    : [{ letter: "", brands }];

  return (
    <section className="bg-surface-1">
      <div className="mx-auto w-full max-w-[var(--page-max)] px-5 py-12 sm:py-14 lg:pb-8 lg:pt-20">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Brands we stock</h1>
          <p className="mt-4 max-w-[790px] text-base leading-8 text-ink-2 sm:text-lg">
            Equipment lines carried at the Newark branch. Counts below are the SKUs in the current catalog, not a
            manufacturer&rsquo;s full range.
          </p>
        </header>

        {grouped && (
          <nav aria-label="Brands by letter" className="mt-6 flex flex-wrap gap-1">
            {groups.map((group) => (
              <a key={group.letter} href={`#brands-${group.letter}`} className="grid size-11 place-items-center rounded-(--r-sm) border border-line text-sm font-medium text-ink-1 hover:bg-surface-2">
                {group.letter}
              </a>
            ))}
          </nav>
        )}

        {groups.map((group) => (
          <section key={group.letter || "all"} id={group.letter ? `brands-${group.letter}` : undefined} aria-label={group.letter ? `Brands starting with ${group.letter}` : undefined} className="mt-8 scroll-mt-6">
            {group.letter && <h2 className="mb-3 text-lg font-semibold text-ink-1">{group.letter}</h2>}
            <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
              {group.brands.map((brand) => (
                <BrandCardView key={brand.key} brand={brand} headingLevel={group.letter ? 3 : 2} />
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-8 max-w-[820px] text-base leading-7 text-ink-2">
          Line sets, covers, pads, disconnects, and other installation supplies are stocked unbranded.{" "}
          <Link href="/products?category=installation-supplies" className="font-medium text-brand underline underline-offset-4">
            Browse installation supplies
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

function BrandCardView({ brand, headingLevel }: { brand: BrandCard; headingLevel: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <li className="row-span-4 grid grid-rows-subgrid">
      <Link
        href={brand.href}
        className="group row-span-4 grid grid-rows-subgrid gap-0 overflow-hidden rounded-(--r-sm) border border-line bg-surface-1 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-strong"
      >
        <BrandMark entry={brand} />
        <div className="px-6 pt-6">
          <Heading className="counter-heading break-words text-2xl leading-tight text-ink-1">{brand.displayName}</Heading>
          <p className="part-number mt-2 text-xs text-ink-3">
            {brand.productCount} {brand.productCount === 1 ? "SKU" : "SKUs"}
            {brand.priceFrom !== null ? ` · from ${currency(brand.priceFrom)}` : ""}
          </p>
        </div>
        <p className="px-6 pt-4 text-base leading-7 text-ink-2">{brand.note ?? brand.categories.join(", ")}</p>
        <span className="inline-flex items-center gap-2 self-end px-6 pb-6 pt-5 text-base font-semibold text-brand">
          Shop {brand.displayName}
          <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-1" />
        </span>
      </Link>
    </li>
  );
}
