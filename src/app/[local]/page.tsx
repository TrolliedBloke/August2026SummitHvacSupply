import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Container, Eyebrow, LinkButton } from "@/components/ui";
import { getLocalPage, LOCAL_PAGES } from "@/lib/local-pages";
import { SITE } from "@/lib/site";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";

export function generateStaticParams() {
  return LOCAL_PAGES.map((page) => ({ local: page.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[local]">): Promise<Metadata> {
  const { local } = await params;
  const page = getLocalPage(local);
  if (!page) return { title: "Page not found" };
  return pageMetadata({ title: page.title, description: page.description, path: `/${page.slug}` });
}

export default async function LocalPage({ params }: PageProps<"/[local]">) {
  const { local } = await params;
  const page = getLocalPage(local);
  if (!page) notFound();

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.title,
    description: page.description,
    provider: {
      "@type": "HVACBusiness",
      name: SITE.name,
      telephone: SITE.phone,
      address: SITE.address.full,
    },
    areaServed: SITE.serviceArea,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(serviceJsonLd) }}
      />
      <section className="border-b border-line bg-surface-1">
        <Container className="py-14 lg:py-20">
          <Breadcrumbs items={[{ label: "Resources", href: "/resources" }, { label: page.eyebrow, href: `/${page.slug}` }]} />
          <div className="mt-5"><Eyebrow>{page.eyebrow}</Eyebrow></div>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
            {page.h1}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{page.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href={page.primaryHref} size="lg">
              {page.primaryCta} <ArrowRight size={18} />
            </LinkButton>
            <LinkButton href={page.secondaryHref} variant="secondary" size="lg">
              {page.secondaryCta}
            </LinkButton>
          </div>
        </Container>
      </section>
      <Container className="py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {page.points.map((point) => (
            <div key={point} className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]">
              <CheckCircle2 className="text-eco" size={22} />
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{point}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-(--r-md) border border-line bg-surface-2/60 p-6">
          <h2 className="font-display text-xl font-semibold text-ink-1">
            Not sure which path fits?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
            Homeowners can start without a model number. Contractors can go
            straight to SKU search and account setup. Property teams can request
            help with multi-unit or commercial scopes.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/homeowners" className="text-sm font-medium text-brand hover:text-brand-hover">
              For homeowners
            </Link>
            <Link href="/products" className="text-sm font-medium text-brand hover:text-brand-hover">
              Shop systems
            </Link>
            <Link href="/contact" className="text-sm font-medium text-brand hover:text-brand-hover">
              Contact Summit
            </Link>
          </div>
        </div>
      </Container>
    </>
  );
}
