import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Container, Eyebrow, LinkButton } from "@/components/ui";
import { getLocalPage, LOCAL_PAGES, localAreaServed, servingBranches } from "@/lib/local-pages";
import { SITE } from "@/lib/site";
import { FulfillmentAnswer } from "@/components/fulfillment-answer";
import { BranchStatusText } from "@/components/branch-status";
import { branchAddressLine, directionsHref } from "@/lib/branch";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";

// Every valid slug is known at build time. Without this, an unknown slug is
// rendered on demand and notFound() is served with HTTP 200 -- a soft 404 that
// lets search engines index junk URLs. Unknown params now 404 outright.
export const dynamicParams = false;

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

  const areaServed = localAreaServed(page);
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
    // From this page's approved coverage, not the global marketing radius.
    ...(areaServed.length > 0
      ? { areaServed: areaServed.map((name) => ({ "@type": "Place", name })) }
      : {}),
  };
  const branches = servingBranches(page);

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
            <div key={point}>
              <CheckCircle2 className="text-brand" size={22} aria-hidden="true" />
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{point}</p>
            </div>
          ))}
        </div>
        {/* Coverage is answered from a ZIP the visitor types -- never inferred
            from their location -- using the same calculator as checkout. */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <FulfillmentAnswer title={`Check delivery in ${page.locality.name}`} />
          <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
            <h2 className="text-lead font-semibold text-ink-1">{branches.length === 1 ? "Serving branch" : "Serving branches"}</h2>
            {branches.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-ink-2">
                No branch serves this area directly. <Link href="/contact?topic=quote" className="font-medium text-ink-1 underline underline-offset-4">Ask for a quote</Link> and we will confirm freight.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-4">
                {branches.map((branch) => (
                  <li key={branch.id} className="text-sm leading-6 text-ink-2">
                    <p className="font-medium text-ink-1">{branch.name}</p>
                    <p>{branchAddressLine(branch)}</p>
                    <BranchStatusText withDot />
                    <a href={directionsHref(branch)} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium text-ink-1 underline underline-offset-4">
                      Directions<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-10 border-t border-line pt-8">
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
            <Link href="/finder" className="text-sm font-medium text-brand hover:text-brand-hover">
              Find your system
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
