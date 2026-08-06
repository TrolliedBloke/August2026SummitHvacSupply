import { renderSitemapIndex } from "@/lib/seo/sitemaps";

export function GET() {
  return xml(renderSitemapIndex());
}
function xml(body: string) {
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
