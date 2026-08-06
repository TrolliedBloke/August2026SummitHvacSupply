import { renderUrlSet, seriesSitemapEntries } from "@/lib/seo/sitemaps";
export function GET() { return new Response(renderUrlSet(seriesSitemapEntries()), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" } }); }
