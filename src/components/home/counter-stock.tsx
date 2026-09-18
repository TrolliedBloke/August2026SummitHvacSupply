import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Container } from "@/components/ui";
import { getStorefrontSku, type StorefrontSku } from "@/lib/storefront/catalog";
import { applyLiveInventory, getLiveInventory } from "@/lib/storefront/live-inventory";

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

export async function CounterStock() {
  const live = await getLiveInventory();
  const skus = FEATURED.map((code) => getStorefrontSku(code))
    .filter((sku): sku is StorefrontSku => Boolean(sku))
    .map((sku) => applyLiveInventory(sku, live));
  if (skus.length === 0) return null;

  return (
    <section className="bg-canvas pb-1 pt-5">
      <Container>
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

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {skus.slice(0, 4).map((sku) => (
            <ProductCard key={sku.id} sku={sku} />
          ))}
        </div>
      </Container>
    </section>
  );
}
