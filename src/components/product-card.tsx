import Link from "next/link";
import { AddToQuote } from "@/components/add-to-quote";
import { ProductImage } from "@/components/product-image";
import { productHref, type StorefrontSku } from "@/lib/storefront/catalog";

/* The one product card, used on the homepage and in the catalog so the two can
   never drift apart again. It carries what a shopper scans a grid for -- photo,
   brand, name, price, whether it's in stock -- and one action. Specs, SKU,
   net-pricing sign-in and quantity live on the product page. */

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

export function ProductCard({ sku, priority = false }: { sku: StorefrontSku; priority?: boolean }) {
  // Only a quantity the catalog actually verified may render as a count.
  // Everything else says so plainly rather than implying a shelf.
  const verified = sku.availabilityVerified && sku.available > 0;
  const low = verified && sku.available <= 2;
  const name = sku.title.replace(new RegExp(`^${sku.brand}\\s*`, "i"), "") || sku.title;

  return (
    <article className="group flex min-w-0 flex-col">
      <Link href={productHref(sku)} className="block">
        <ProductImage
          src={sku.imageVerified ? sku.image : null}
          alt={`${sku.title}, model ${sku.modelNumber}`}
          sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
          priority={priority}
        />
      </Link>

      <p className="mt-3 text-xs text-ink-2">{sku.brand}</p>
      <Link href={productHref(sku)} className="mt-0.5 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-ink-1 group-hover:underline">
        {name}
      </Link>
      <p className="part-number mt-2 text-base font-semibold text-ink-1">
        {sku.retailPrice === null ? "Price on request" : currency(sku.retailPrice)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-xs text-ink-2">
        <span
          className={`size-2 shrink-0 rounded-full ${low ? "bg-[var(--amber)]" : verified ? "bg-brand" : "bg-ink-4"}`}
          aria-hidden="true"
        />
        {verified ? (low ? `${sku.available} left` : `${sku.available} in Newark`) : "Stock at order"}
      </p>

      <div className="mt-auto pt-3">
        <AddToQuote sku={sku} size="sm" variant="outline" />
      </div>
    </article>
  );
}
