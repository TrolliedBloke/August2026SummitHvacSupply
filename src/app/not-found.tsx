import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Container, LinkButton } from "@/components/ui";
import { getCatalogFacets } from "@/lib/storefront/catalog";
import { SITE } from "@/lib/site";

export default function NotFound() {
  return (
    <Container className="py-20 lg:py-28">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-copper">
          404: page not found
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
          That page moved, or the model number changed.
        </h1>
        <p className="mt-3 text-ink-2">
          Try a search by SKU or model number, browse the lineup, or call the
          Newark counter at{" "}
          <a href={SITE.phoneHref} className="font-medium text-brand hover:text-brand-hover">
            {SITE.phone}
          </a>{" "}
          and we&apos;ll find the part.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href="/products" size="lg">
            <Search size={16} /> Search the catalog
          </LinkButton>
          <LinkButton href="/" variant="secondary" size="lg">
            Back to home
          </LinkButton>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-2xl">
        <h2 className="text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">
          Browse categories
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {/* Categories that hold SKUs. The fixed slice offered "Central
              systems", which has no products -- a dead end reached from a
              page the visitor already landed on by mistake. */}
          {getCatalogFacets().categories.slice(0, 6).map((category) => (
            <li key={category.value}>
              <Link
                href={`/products?category=${category.value}`}
                className="group flex items-center justify-between rounded-(--r-sm) border border-line bg-surface-1 px-4 py-3 text-sm font-medium text-ink-1 transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                {category.label}
                <ArrowRight size={15} className="text-ink-3 group-hover:text-brand" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
