import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SeoToolPanel } from "@/components/seo-tool";
import { Container } from "@/components/ui";
import { pageMetadata } from "@/lib/seo/metadata";
import { getSeoTool, SEO_TOOLS } from "@/lib/seo/tools";
import { getStorefrontSkus, productHref } from "@/lib/storefront/catalog";

export function generateStaticParams() { return SEO_TOOLS.map((tool) => ({ slug: tool.slug })); }
export async function generateMetadata({ params }: PageProps<"/tools/[slug]">): Promise<Metadata> { const { slug } = await params; const tool = getSeoTool(slug); return tool ? pageMetadata({ title: tool.title, description: tool.description, path: `/tools/${tool.slug}` }) : { title: "Tool not found" }; }

export default async function ToolPage({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params; const tool = getSeoTool(slug); if (!tool) notFound();
  const skus = getStorefrontSkus().map((sku) => ({ sku: sku.sku, modelNumber: sku.modelNumber, title: sku.title, btu: sku.btu, voltage: sku.voltage, refrigerant: sku.refrigerant, ahriReference: sku.ahriReference, href: productHref(sku), available: sku.available }));
  return <><header className="border-b border-line bg-surface-1"><Container className="py-10 sm:py-14"><Breadcrumbs items={[{ label: "Resources", href: "/resources" }, { label: tool.title, href: `/tools/${tool.slug}` }]} /><h1 className="mt-5 max-w-4xl font-display text-3xl font-medium leading-tight text-ink-1 sm:text-5xl">{tool.h1}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-ink-2">{tool.intro}</p></Container></header><Container className="py-10 sm:py-14"><div className="max-w-4xl" data-conversion-hook={`seo-tool-${tool.slug}`}><SeoToolPanel tool={tool} skus={skus} /><p className="mt-4 text-xs leading-5 text-ink-3">Results are planning aids based on the information entered and the current Summit catalog. A qualified contractor, program administrator, manufacturer documentation, AHRI certification record, and local authority may be required for the final decision.</p></div><nav className="mt-12 border-t border-line pt-7" aria-label="Other HVAC tools"><h2 className="font-medium text-ink-1">Other tools</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm">{SEO_TOOLS.filter((item) => item.slug !== tool.slug).map((item) => <Link key={item.slug} href={`/tools/${item.slug}`} className="text-ink-1 underline underline-offset-4">{item.title}</Link>)}</div></nav></Container></>;
}
