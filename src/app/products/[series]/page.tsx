import { notFound } from "next/navigation";

/**
 * The six legacy marketing-series slugs are redirected to their catalog
 * category by `redirects()` in `next.config.ts`, which runs before this route
 * and emits a real 308.
 *
 * Anything else under `/products/<slug>` is not a real page. Serving a 404
 * rather than rendering keeps invented series URLs out of the index; the live
 * catalog lives at `/products` and `/products/sku/<slug>`.
 *
 * Restore a series page here only when it is generated from the catalog with
 * evidence behind every published claim -- the previous version published
 * SEER2, HSPF2, warranty and ENERGY STAR designations that had no per-model
 * record behind them, and its `confirm[]` caveat flags were never rendered.
 */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ series: string }> {
  return [];
}

export default function LegacySeriesPage() {
  notFound();
}
