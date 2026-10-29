import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SeoToolPanel } from "@/components/seo-tool";
import { Container } from "@/components/ui";
import { pageMetadata } from "@/lib/seo/metadata";
import { getSeoTool, SEO_TOOLS, TOOL_NEXT_STEP } from "@/lib/seo/tools";
import { LinkButton } from "@/components/ui";
import { SITE } from "@/lib/site";
import { getStorefrontSkus, productHref } from "@/lib/storefront/catalog";

// Every valid slug is known at build time. Without this, an unknown slug is
// rendered on demand and notFound() is served with HTTP 200 -- a soft 404 that
// lets search engines index junk URLs. Unknown params now 404 outright.
export const dynamicParams = false;

export function generateStaticParams() { return SEO_TOOLS.map((tool) => ({ slug: tool.slug })); }
export async function generateMetadata({ params }: PageProps<"/tools/[slug]">): Promise<Metadata> { const { slug } = await params; const tool = getSeoTool(slug); return tool ? pageMetadata({ title: tool.title, description: tool.description, path: `/tools/${tool.slug}` }) : { title: "Tool not found" }; }

export default async function ToolPage({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params; const tool = getSeoTool(slug); if (!tool) notFound();
  const skus = getStorefrontSkus().map((sku) => ({ id: sku.id, sku: sku.sku, sourceSku: sku.sourceSku, modelNumber: sku.modelNumber, title: sku.title, btu: sku.btu, voltage: sku.voltage, refrigerant: sku.refrigerant, ahriReference: sku.ahriReference, href: productHref(sku), available: sku.available, stockVerified: sku.availabilityVerified }));
  return <><header className="border-b border-line bg-surface-1"><Container className="py-10 sm:py-14"><Breadcrumbs items={[{ label: "Resources", href: "/resources" }, { label: tool.title, href: `/tools/${tool.slug}` }]} /><h1 className="mt-5 max-w-4xl font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">{tool.h1}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-ink-2">{tool.intro}</p></Container></header><Container className="py-10 sm:py-14"><div className="max-w-4xl" data-conversion-hook={`seo-tool-${tool.slug}`}><SeoToolPanel tool={tool} skus={skus} /><p className="mt-4 text-xs leading-5 text-ink-3">Results are planning aids based on the information entered and the current Summit catalog. A qualified contractor, program administrator, manufacturer documentation, AHRI certification record, and local authority may be required for the final decision.</p></div><ToolNextStep slug={tool.slug} /><nav className="mt-12 border-t border-line pt-7" aria-label="Other HVAC tools"><h2 className="font-medium text-ink-1">Other tools</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm">{SEO_TOOLS.filter((item) => item.slug !== tool.slug).map((item) => <Link key={item.slug} href={`/tools/${item.slug}`} className="text-ink-1 underline underline-offset-4">{item.title}</Link>)}</div></nav></Container></>;
}

/** Every tool ends with a way back into a buying task, and the counter. */
function ToolNextStep({ slug }: { slug: keyof typeof TOOL_NEXT_STEP }) {
  const next = TOOL_NEXT_STEP[slug];
  return (
    <section aria-labelledby="tool-next-step" className="mt-8 max-w-4xl rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-6" data-tool-next-step>
      <h2 id="tool-next-step" className="font-medium text-ink-1">Next step</h2>
      <p className="mt-1 text-sm leading-6 text-ink-2">{next.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <LinkButton href={next.href}>{next.label}</LinkButton>
        <LinkButton href="/quote" variant="secondary">Request a quote</LinkButton>
        <a href={SITE.phoneHref} className="inline-flex min-h-11 items-center text-sm font-medium text-ink-1 underline underline-offset-4">Ask the counter: {SITE.phone}</a>
      </div>
    </section>
  );
}
