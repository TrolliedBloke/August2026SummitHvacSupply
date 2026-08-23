import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AddToQuote } from "@/components/add-to-quote";
import { getStorefrontSku, productHref, type StorefrontSku } from "@/lib/storefront/catalog";
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

/** The spec slot: two or three short facts on one monospace line, the way the
    counter labels a box. A2L rides along here rather than taking its own row. */
function specLine(sku: StorefrontSku): string {
  const parts: string[] = [];
  if (sku.btu) parts.push(`${sku.btu.toLocaleString("en-US")} BTU`);
  if (sku.voltage) parts.push(sku.voltage);
  if (parts.length === 0 && sku.dimensions) parts.push(sku.dimensions);
  if (sku.refrigerantClass === "A2L") parts.push("A2L rated");
  return parts.join("  ·  ");
}

export function CounterStock() {
  const skus = FEATURED.map((code) => getStorefrontSku(code)).filter(
    (sku): sku is StorefrontSku => Boolean(sku)
  );
  if (skus.length === 0) return null;

  return (
    <section className="bg-canvas pb-2 pt-9">
      <CounterWidth>
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
            {/* Not "in stock today": no SKU in the catalog carries a verified
                branch quantity yet, and the audit calls a stock claim the site
                cannot back the single most damaging thing on this page. The
                heading states what is true -- these ship and pick up from
                Newark -- and each card states its own stock position. */}
            <h2 className="counter-heading border-b-2 border-brand pb-1 text-[1.25rem] leading-none text-ink-1">
              Available from Newark
            </h2>
            <p className="max-w-[46ch] text-sm leading-6 text-ink-2">
              Prices shown are list. Trade accounts see net pricing.
              <br className="hidden sm:block" /> Pick up in 30 minutes or get next-day delivery.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-1 underline underline-offset-4"
          >
            View all products
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {skus.map((sku) => (
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

  return (
    <article className="flex flex-col rounded-(--r-md) border border-line bg-surface-1 p-3">
      <Link
        href={productHref(sku)}
        className="relative mb-2.5 block aspect-[13/5] w-full overflow-hidden"
      >
        <Image
          src={sku.image}
          alt={sku.title}
          fill
          loading="lazy"
          sizes="(min-width: 1024px) 220px, (min-width: 640px) 50vw, 100vw"
          className="object-contain"
        />
      </Link>

      <Link href={productHref(sku)} className="part-number text-sm font-medium text-ink-1">
        {sku.sku}
      </Link>
      <p className="mt-0.5 text-sm leading-5 text-ink-2">{sku.title}</p>
      {spec && (
        <p className="part-number mt-1.5 truncate text-[0.7rem] uppercase leading-5 text-ink-3" title={spec}>
          {spec}
        </p>
      )}

      <p className="mt-1.5 text-[1.05rem] font-medium text-ink-1">
        {sku.retailPrice === null ? "Price on request" : currency(sku.retailPrice)}
      </p>

      {/* Stock state and the action share one row, as in the reference. The
          button label is set by AddToQuote from the SKU's real purchase state,
          so it reads "Check availability" while the catalog is quote-only and
          becomes "Add to cart" the moment a SKU is sellable. */}
      {/* The reference puts stock and the action on one row, which works when
          the button says "Add" (54px). This catalog is quote-only, so the
          button says "Check availability" (119px) and leaves 59px for the
          stock text -- not enough. Stock and fulfillment share the row
          instead, and the button spans beneath. Revisit once real inventory
          makes these SKUs sellable and the label shortens to "Add to cart". */}
      <div className="mt-auto pt-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
            <span
              className={`size-2 shrink-0 rounded-full ${verified ? "bg-brand" : "bg-ink-4"}`}
              aria-hidden="true"
            />
            <span className="part-number truncate">
              {verified ? `${sku.available} in stock` : "Stock at order"}
            </span>
          </p>
          {/* Both fulfillment methods, on every card. The page named will-call
              three times and delivery zero times before this line existed. */}
          <p className="part-number shrink-0 text-[0.62rem] uppercase text-ink-3">
            {FULFILLMENT.bothMethods}
          </p>
        </div>
        <div className="mt-2">
          <AddToQuote sku={sku} size="sm" full />
        </div>
      </div>
    </article>
  );
}

function CounterWidth({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 w-auto max-w-[var(--counter-max)] px-0 sm:mx-auto sm:w-full sm:px-6 lg:px-[var(--counter-pad)]">
      {children}
    </div>
  );
}
