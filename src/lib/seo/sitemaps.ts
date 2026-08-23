import type { MetadataRoute } from "next";
import { LOCAL_PAGES } from "@/lib/local-pages";
import { SITE } from "@/lib/site";
import { catalogReconciliation } from "@/lib/catalog/reconciliation";
import { getSkuSeoState } from "@/lib/seo/catalog";
import { getStorefrontSkus, productHref } from "@/lib/storefront/catalog";

export type SitemapEntry = MetadataRoute.Sitemap[number];

/**
 * lastmod. This was a hardcoded date, so every entry in every sitemap reported
 * the same frozen timestamp no matter how often the catalog was regenerated --
 * which tells a crawler the site never changes and suppresses recrawls. It now
 * tracks the catalog build, the one timestamp that actually moves when product
 * data changes. Editorial routes below keep their own cadence.
 */
const changed = new Date(catalogReconciliation.generatedAt);

export function productSitemapEntries(): MetadataRoute.Sitemap {
  return getStorefrontSkus()
    .filter((sku) => getSkuSeoState(sku).indexable)
    .map((sku) => ({
      url: `${SITE.origin}${productHref(sku)}`,
      lastModified: changed,
      changeFrequency: "daily" as const,
      priority: 0.9,
    }));
}
export function seriesSitemapEntries(): MetadataRoute.Sitemap {
  // Legacy series pages contain intentional demo content and are not product truth.
  return [];
}

export function categorySitemapEntries(): MetadataRoute.Sitemap {
  return ["", "/products", "/homeowners", "/resources", "/about", "/contact", "/dealers", "/quote"].map(
    (path) => ({
      url: `${SITE.origin}${path}`,
      lastModified: changed,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );
}

export function locationSitemapEntries(): MetadataRoute.Sitemap {
  return ["/locations/newark", "/bay-area-hvac-supply", "/newark-hvac-will-call-contractors"].map((path) => ({
    url: `${SITE.origin}${path}`,
    lastModified: changed,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
}

export function guideSitemapEntries(): MetadataRoute.Sitemap {
  const localNonLocation = LOCAL_PAGES.filter(
    (page) => !["bay-area-hvac-supply", "newark-hvac-will-call-contractors"].includes(page.slug)
  ).map((page) => `/${page.slug}`);
  const guidePaths = [
    "/guides/baaqmd-rules-9-4-9-6",
    "/guides/bay-area-hvac-permits",
    "/guides/bay-area-heat-pump-rebates-by-zip",
    "/guides/r-32-r-454b-a2l-transition",
    "/guides/california-title-24-hvac-changeouts",
    "/tools/model-number-decoder",
    "/tools/rebate-lookup",
    "/tools/ahri-match-finder",
    "/tools/system-sizing-estimator",
    "/tools/operating-cost-comparison",
  ];
  return [...localNonLocation, ...guidePaths].map((path) => ({
    url: `${SITE.origin}${path}`,
    lastModified: changed,
    changeFrequency: "monthly" as const,
    priority: path.startsWith("/tools/") ? 0.65 : 0.7,
  }));
}

export function renderUrlSet(entries: MetadataRoute.Sitemap) {
  const body = entries
    .map(
      (entry) => `<url><loc>${escapeXml(entry.url)}</loc>${entry.lastModified ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>` : ""}${entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : ""}${entry.priority !== undefined ? `<priority>${entry.priority}</priority>` : ""}</url>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function renderSitemapIndex() {
  const names = ["products", "categories", "locations", "guides"];
  const body = names
    .map((name) => `<sitemap><loc>${SITE.origin}/sitemap-${name}.xml</loc><lastmod>${changed.toISOString()}</lastmod></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}
