import type { NextConfig } from "next";

/**
 * Legacy marketing-series URLs (BreezeIN, FreshIN, Elite, ...).
 *
 * These six pages predate the inventory-driven catalog and were never built
 * from `data/catalog/inventory-source.csv`, so nothing on them reconciled
 * against the inventory sheet. They also advertised "In stock, ships today"
 * while the sheet carries no on-hand quantity for any SKU.
 *
 * Redirecting here rather than from the route file matters: a `permanentRedirect()`
 * inside a prerendered page is served as HTTP 200 with an RSC payload, which a
 * crawler reads as a real page. A config redirect emits a genuine 308 before
 * rendering, which is what consolidates the old URLs' ranking signal.
 */
const LEGACY_SERIES_REDIRECTS: Array<[string, string]> = [
  ["breezein", "mini-splits"],
  ["freshin", "mini-splits"],
  ["elite", "mini-splits"],
  ["multi-zone", "mini-splits"],
  ["light-commercial", "central-heat-pumps"],
  ["central-system", "central-heat-pumps"],
];

const nextConfig: NextConfig = {
  // Release checks can build beside a running local dev server without both
  // processes clearing and rewriting the same .next directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return LEGACY_SERIES_REDIRECTS.map(([slug, category]) => ({
      source: `/products/${slug}`,
      destination: `/products?category=${category}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
