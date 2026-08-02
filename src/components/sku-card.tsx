import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, FileText } from "lucide-react";
import { AddToQuote } from "./add-to-quote";
import { NotifyMe } from "./notify-me";
import { Chip } from "./ui";
import { ReviewStarsInline } from "./product-reviews";
import { getReviews, reviewSummary } from "@/lib/reviews";
import { documentHref, productHref, type StorefrontSku } from "@/lib/storefront/catalog";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function SkuCard({ sku, priority = false }: { sku: StorefrontSku; priority?: boolean }) {
  const docs = sku.documents;
  const rating = reviewSummary(getReviews(sku.id, sku.seriesSlug));
  return (
    <article className="group flex flex-col overflow-hidden rounded-(--r-md) border border-line bg-surface-1 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
      <Link href={productHref(sku)} className="relative flex aspect-[16/10] items-center justify-center bg-surface-2">
        <Image
          src={sku.image}
          alt={`${sku.title} product image`}
          fill
          preload={priority}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{sku.categoryLabel}</Chip>
          <Chip tone={sku.stockStatus === "ready" ? "stock" : sku.stockStatus === "low" ? "copper" : "lead"}>
            {sku.available} available
          </Chip>
        </div>
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {sku.sku}
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink-1">
            <Link href={productHref(sku)} className="hover:text-brand">
              {sku.title}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            {sku.modelNumber} · {sku.btu.toLocaleString()} BTU · {sku.voltage}
          </p>
          {rating && (
            <div className="mt-1.5">
              <ReviewStarsInline summary={rating} />
            </div>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-(--r-sm) border border-line bg-line text-center">
          <Spec label="Retail" value={currency(sku.msrp)} />
          {/* Not a number — render as a link, not in price typography. */}
          <Spec
            label="Pro price"
            value={
              <Link
                href="/portal/login"
                className="whitespace-nowrap font-sans text-xs font-semibold text-brand hover:text-brand-hover"
              >
                Sign in
              </Link>
            }
          />
          <Spec label="Docs" value={`${docs.length}`} />
        </dl>
        <div className="flex flex-wrap gap-2">
          {docs.slice(0, 2).map((doc) => (
            <a
              key={doc.id}
              href={documentHref(doc)}
              className="inline-flex items-center gap-1.5 rounded-(--r-sm) border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-ink-4 hover:text-ink-1"
            >
              <FileText size={13} />
              {doc.kind === "spec_sheet" ? "Spec sheet" : "Install manual"}
            </a>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-3">
          {sku.stockStatus === "backorder" ? (
            <NotifyMe skuId={sku.id} compact />
          ) : (
            <AddToQuote sku={sku} size="sm" />
          )}
          <Link href={productHref(sku)} className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-brand">
            Details
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function Spec({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col justify-center bg-surface-1 px-2 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">{label}</dt>
      <dd className="tnum mt-1 font-mono text-sm font-semibold text-ink-1">{value}</dd>
    </div>
  );
}
