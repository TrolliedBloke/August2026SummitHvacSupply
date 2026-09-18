import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { AddToQuote } from "@/components/add-to-quote";
import { ProductImage } from "@/components/product-image";
import { getStorefrontSku, productHref, type StorefrontSku } from "@/lib/storefront/catalog";
import { applyLiveInventory, getLiveInventory } from "@/lib/storefront/live-inventory";
import { FULFILLMENT } from "@/lib/site";

/* The five models the counter leads with. Real catalog SKUs, resolved at build
   time -- a SKU that is pulled from the catalog disappears from the landing
   page instead of rendering a dead card. */
const FEATURED = [
  "TCL24KAHU",
  "TCL-27K-MZ-ODU-R-454B",
  "TCL12KIDU",
  "TOS12KODU",
  "TCL42KMZODU",
] as const;

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function specLine(sku: StorefrontSku): string {
  const capacity = sku.tonnage
    ? `${Number.isInteger(sku.tonnage) ? sku.tonnage : sku.tonnage.toFixed(1)} TON`
    : sku.btu
      ? `${sku.btu.toLocaleString("en-US")} BTU`
      : "";
  return [capacity, sku.refrigerant, sku.voltage].filter(Boolean).join(" / ");
}

export async function CounterStock() {
  const live = await getLiveInventory();
  const skus = FEATURED.map((code) => getStorefrontSku(code))
    .filter((sku): sku is StorefrontSku => Boolean(sku))
    .map((sku) => applyLiveInventory(sku, live));
  if (skus.length === 0) return null;

  return (
    <section className="bg-canvas pb-1 pt-5">
      <CounterWidth>
        <div className="flex items-baseline justify-between gap-5">
          <h2 className="counter-heading text-2xl leading-tight text-ink-1">
            Available from Newark
          </h2>
          <Link
            href="/products"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-brand hover:underline hover:underline-offset-4"
          >
            View all products
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:gap-x-6 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-9">
          {skus.slice(0, 4).map((sku) => (
            <StockCard key={sku.id} sku={sku} />
          ))}
        </div>
      </CounterWidth>
    </section>
  );
}

function StockCard({ sku }: { sku: StorefrontSku }) {
  const spec = specLine(sku);
  // Only a quantity the catalog actually verified is allowed to render as a
  // count. Everything else says so plainly rather than implying a shelf.
  const verified = sku.availabilityVerified && sku.available > 0;

  const low = verified && sku.available <= 2;
  const productName = sku.title.replace(new RegExp(`^${sku.brand}\\s*`, "i"), "") || sku.title;

  return (
    <article className="flex min-w-0 flex-col rounded-(--r-sm) border border-transparent px-3 pb-3 pt-2 transition-[background-color,border-color] duration-150 ease-out hover:border-line hover:bg-surface-1 sm:px-4 sm:pb-4 sm:pt-3">
      <Link href={productHref(sku)} className="mb-3 block">
        <ProductImage src={sku.image} alt={sku.title} sizes="(min-width: 1280px) 300px, (min-width: 1024px) 33vw, 50vw" />
      </Link>

      <p className="text-xs font-medium text-ink-1">{sku.brand}</p>
      <Link href={productHref(sku)} className="mt-0.5 min-h-9 text-sm font-medium leading-[18px] text-ink-1 hover:underline">
        {productName}
      </Link>
      {spec && (
        <p className="part-number mt-1 truncate text-xs leading-5 text-ink-2 sm:text-xs" title={spec}>
          {spec}
        </p>
      )}
      <p className="part-number mt-0.5 truncate text-xs leading-5 text-ink-2 sm:text-xs">
        {sku.sku}
      </p>

      <p className="part-number mt-1 text-base font-medium text-ink-1">
        {sku.retailPrice === null ? "Price on request" : currency(sku.retailPrice)}
        {sku.retailPrice !== null && <span className="ml-2 font-sans text-xs font-normal text-ink-2">List</span>}
      </p>
      <Link href="/portal/login" className="mt-0.5 text-xs text-ink-2 hover:underline hover:decoration-brand hover:underline-offset-4">
        Sign in for net pricing
      </Link>

      <div className="mt-auto pt-2">
        <p className="flex min-w-0 items-center gap-2 text-xs text-ink-1">
          <span
            className={`size-2 shrink-0 rounded-full ${low ? "bg-[var(--amber)]" : verified ? "bg-brand" : "bg-ink-4"}`}
            aria-hidden="true"
          />
          <span className="truncate">
            {verified ? (low ? `${sku.available} left` : `${sku.available} in Newark`) : "Stock at order"}
          </span>
        </p>
        <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-2">
          <Store size={13} strokeWidth={1.7} aria-hidden="true" />
          {verified ? "Pickup today" : FULFILLMENT.bothMethods}
        </p>
        <div className="mt-2.5">
          <AddToQuote sku={sku} size="sm" withQuantity variant="outline" />
        </div>
      </div>
    </article>
  );
}

function CounterWidth({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[var(--page-max)] px-5 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
