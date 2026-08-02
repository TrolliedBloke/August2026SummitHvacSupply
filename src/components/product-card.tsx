import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Leaf } from "lucide-react";
import { type Series, CATEGORY_LABEL, ENERGY_STAR_LABEL } from "@/lib/products";
import { SpecStockStrip } from "./spec-stock-strip";
import { FulfillmentBadge } from "./fulfillment-badge";
import { AddToQuote } from "./add-to-quote";
import { Chip } from "./ui";
import type { SeriesCardSummary } from "@/lib/backend/catalog";
import { getSeriesPriceRange, getStorefrontSkus } from "@/lib/storefront/catalog";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProductCard({
  series,
  ops,
  priority = false,
}: {
  series: Series;
  ops?: SeriesCardSummary;
  priority?: boolean;
}) {
  const energyStar = ENERGY_STAR_LABEL[series.energyStar];
  const representativeSku = getStorefrontSkus().find((sku) => sku.seriesSlug === series.slug);
  const priceRange = getSeriesPriceRange(series.slug);
  return (
    <article className="group flex flex-col overflow-hidden rounded-(--r-md) border border-line bg-surface-1 shadow-[var(--shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--shadow-md)]">
      <Link
        href={`/products/${series.slug}`}
        className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-surface-2"
      >
        <Image
          src={series.image}
          alt={`${series.name} product image`}
          fill
          preload={priority}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {energyStar === "ENERGY STAR Most Efficient 2025" && (
          <span className="absolute left-3 top-3">
            <Chip tone="eco">
              <Leaf size={12} strokeWidth={2.5} /> Most Efficient 2025
            </Chip>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Chip tone="neutral">{CATEGORY_LABEL[series.category]}</Chip>
            {energyStar && energyStar !== "ENERGY STAR Most Efficient 2025" && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-eco-ink">
                ★ ENERGY STAR
              </span>
            )}
          </div>
          <h3 className="font-display text-xl font-semibold tracking-tight text-ink-1">
            <Link href={`/products/${series.slug}`} className="hover:text-brand">
              {series.name}
            </Link>
          </h3>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Type: {series.type}
          </p>
          <ul className="grid gap-1.5 text-sm leading-relaxed text-ink-2">
            {series.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-eco" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>

        <SpecStockStrip series={series} className="mt-auto" />
        <FulfillmentBadge inStock={series.stock === "ready"} />
        {ops && (
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-(--r-sm) border border-line bg-line text-center">
            <OpsCell label="SKUs" value={`${ops.skuCount}`} />
            <OpsCell label="Available" value={`${ops.availableUnits}`} />
            <OpsCell
              label="Retail from"
              value={priceRange ? currency(priceRange.low) : "Quote"}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          {representativeSku && <AddToQuote sku={representativeSku} size="sm" />}
          <Link
            href={`/products/${series.slug}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-brand"
          >
            Specs & support
            <ArrowUpRight size={15} strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function OpsCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-1 px-2 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">{label}</p>
      <p className="tnum mt-1 font-mono text-sm font-semibold text-ink-1">{value}</p>
    </div>
  );
}
