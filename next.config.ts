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
  // Baseline security headers. None were set: no HSTS, no clickjacking
  // protection, no MIME-sniffing protection, and a Referer that leaked full
  // URLs cross-origin.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          // Stripe needs its js/frames; manufacturer PDFs and images are linked
          // out rather than embedded, so no wildcard is needed for them.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://*.supabase.co",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return LEGACY_SERIES_REDIRECTS.map(([slug, category]) => ({
      source: `/products/${slug}`,
      destination: `/products?category=${category}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
