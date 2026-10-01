import Link from "next/link";
import { AddToQuote } from "@/components/add-to-quote";
import { ProductImage } from "@/components/product-image";
import { productHref, type StorefrontSku } from "@/lib/storefront/catalog";
import { presentCommerceState, publicCommerceState, type CommerceState } from "@/lib/commerce/state";

/* The one product card, used on the homepage, in the catalog and under related
   items so they can never drift apart. Price, status and action come from one
   CommerceState, so the three can never disagree with each other.

   The card spans six rows of its parent grid and adopts them as a subgrid, so
   titles, prices and actions line up across a row of cards however many lines
   each title wraps to -- no fixed title height, and no clipped names. Parents
   use the `.product-grid` track definition in globals.css. */

export const PRODUCT_CARD_ROWS = 6;

export function ProductCard({
  sku,
  state: stateProp,
  priority = false,
  headingLevel = 3,
  compactOnMobile = false,
}: {
  sku: StorefrontSku;
  state?: CommerceState;
  priority?: boolean;
  headingLevel?: 2 | 3 | 4;
  compactOnMobile?: boolean;
}) {
  const state = stateProp ?? publicCommerceState(sku);
  const view = presentCommerceState(state);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  // Provenance is always visible: a signed-in trade buyer must never read the
  // public list price as their account price (account prices appear only on
  // the product page, cart and checkout, from the session projection).
  const visibleQualifier = view.priceText ? view.priceQualifier : null;

  return (
    <article className={`group grid min-w-0 gap-y-0 ${compactOnMobile ? "row-span-1 grid-cols-[7rem_minmax(0,1fr)] grid-rows-[auto_auto_auto_auto_auto] gap-x-3 border-b border-line pb-4 sm:row-span-6 sm:grid-cols-none sm:grid-rows-subgrid sm:gap-x-0 sm:border-b-0 sm:pb-0" : "row-span-6 grid-rows-subgrid"}`}>
      {/* The title link is the card's one link stop; the image repeats it for
          pointer users only, so keyboard and screen-reader users meet it once. */}
      <Link href={productHref(sku)} tabIndex={-1} aria-hidden="true" className={`block ${compactOnMobile ? "col-start-1 row-span-4 row-start-1 sm:col-auto sm:row-span-1 sm:row-auto" : ""}`}>
        <ProductImage
          src={sku.imageVerified ? sku.image : null}
          alt=""
          sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 100vw"
          priority={priority}
        />
      </Link>

      <Heading className={`min-w-0 text-item font-medium leading-6 text-ink-1 ${compactOnMobile ? "col-start-2 row-start-1 sm:col-auto sm:row-auto sm:mt-3" : "mt-3"}`}>
        <Link href={productHref(sku)} className="line-clamp-3 break-words group-hover:underline" title={sku.title}>
          {sku.title}
        </Link>
      </Heading>
      <p className={`part-number mt-0.5 min-w-0 break-all text-micro text-ink-3 ${compactOnMobile ? "col-start-2 sm:col-auto" : ""}`}>{sku.sku}</p>

      <p className={`mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 text-item ${compactOnMobile ? "col-start-2 sm:col-auto" : ""}`}>
        {view.priceText ? (
          <>
            <span className="part-number font-semibold text-ink-1">{view.priceText}</span>
            {visibleQualifier && <span className="text-micro text-ink-3">{visibleQualifier.toLowerCase()}</span>}
          </>
        ) : (
          <span className="font-medium text-ink-1">{view.priceFallback}</span>
        )}
      </p>

      <p className={`mt-1.5 flex min-w-0 items-start gap-2 text-meta text-ink-2 ${compactOnMobile ? "col-start-2 sm:col-auto" : ""}`}>
        <span
          className={`mt-[0.4375rem] size-2 shrink-0 rounded-full ${
            view.tone === "ready" ? (view.statusLabel.includes("left") ? "bg-[var(--amber)]" : "bg-brand") : "bg-ink-4"
          }`}
          aria-hidden="true"
        />
        <span className="min-w-0">{view.statusLabel}</span>
      </p>

      <div className={`self-end pt-3 ${compactOnMobile ? "col-span-2 sm:col-span-1" : ""}`}>
        <AddToQuote sku={sku} state={state} size="sm" variant="outline" full />
      </div>
    </article>
  );
}
