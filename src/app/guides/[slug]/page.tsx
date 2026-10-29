import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarClock, MapPin } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Container, Eyebrow, LinkButton } from "@/components/ui";
import { getSeoGuide, SEO_GUIDES } from "@/lib/seo/guides";
import { pageMetadata } from "@/lib/seo/metadata";
import { TableOfContents } from "@/components/table-of-contents";

// Every valid slug is known at build time. Without this, an unknown slug is
// rendered on demand and notFound() is served with HTTP 200 -- a soft 404 that
// lets search engines index junk URLs. Unknown params now 404 outright.
export const dynamicParams = false;

export function generateStaticParams() { return SEO_GUIDES.map((guide) => ({ slug: guide.slug })); }

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getSeoGuide(slug);
  return guide ? pageMetadata({ title: guide.title, description: guide.description, path: `/guides/${guide.slug}` }) : { title: "Guide not found" };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = getSeoGuide(slug);
  if (!guide) notFound();

  const toc = [...guide.sections.map((section) => ({ id: section.id, label: section.heading })), { id: "primary-sources", label: "Primary sources" }];

  return (
    <>
      <header className="border-b border-line bg-surface-1">
        <Container className="py-12 sm:py-16">
          <Breadcrumbs items={[{ label: "Resources", href: "/resources" }, { label: guide.eyebrow, href: `/guides/${guide.slug}` }]} />
          <Eyebrow>{guide.eyebrow}</Eyebrow>
          <h1 className="mt-3 max-w-4xl break-words text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">{guide.h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-2">{guide.intro}</p>
        </Container>
      </header>
      <Container className="py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {/* Narrow screens: a compact, native disclosure at the top. */}
            <TableOfContents entries={toc} variant="compact" className="mb-6 lg:hidden" />
            <article className="prose-doc">
              {guide.sections.map((section) => (
                <section key={section.id} aria-labelledby={section.id} className="border-b border-line py-7 first:pt-0">
                  <h2 id={section.id} tabIndex={-1} className="outline-none">
                    {section.heading}
                  </h2>
                  <p className="mt-3">{section.body}</p>
                  {section.bullets && (
                    <ul className="mt-4 space-y-2 text-sm leading-6">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3">
                          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-1" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.references && section.references.length > 0 && (
                    <p className="mt-3 text-sm">
                      Source:{" "}
                      {section.references.map((reference, index) => (
                        <span key={reference.href}>
                          {index > 0 && ", "}
                          <a href={reference.href} target="_blank" rel="noreferrer">
                            {reference.label}
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                </section>
              ))}
              <section aria-labelledby="primary-sources" className="pt-7">
                <h2 id="primary-sources" tabIndex={-1} className="outline-none">
                  Primary sources
                </h2>
                <p className="mt-2 text-sm leading-6">
                  Use these agencies as the source of truth. Summit summarizes them for equipment planning and does not provide
                  legal, tax, engineering, or permit advice.
                </p>
                <div className="mt-4 grid gap-2">
                  {guide.sources.map((source) => (
                    <a
                      key={source.href}
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-(--r-sm) border border-line bg-surface-1 p-4 text-sm text-ink-1 no-underline"
                    >
                      <span className="min-w-0 break-words">
                        {source.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </span>
                      <ArrowUpRight size={17} aria-hidden className="shrink-0" />
                    </a>
                  ))}
                </div>
              </section>
            </article>
          </div>
          <aside className="flex h-fit flex-col gap-5 lg:sticky lg:top-6">
            <TableOfContents entries={toc} variant="sticky" className="hidden max-h-[45dvh] overflow-y-auto rounded-(--r-md) border border-line bg-surface-1 p-4 lg:block" />
            <div className="rounded-(--r-md) border border-line bg-surface-1 p-5">
              <h2 className="font-medium text-ink-1">Review record</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="flex items-center gap-2 text-ink-3">
                    <MapPin size={16} aria-hidden="true" />
                    Jurisdiction
                  </dt>
                  <dd className="mt-1 leading-6 text-ink-1">{guide.jurisdiction}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-ink-3">
                    <CalendarClock size={16} aria-hidden="true" />
                    Effective date
                  </dt>
                  <dd className="mt-1 leading-6 text-ink-1">{guide.effectiveDate}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Pending changes</dt>
                  <dd className="mt-1 leading-6 text-ink-1">{guide.pending}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Last reviewed</dt>
                  <dd className="mt-1 text-ink-1">{guide.reviewedAt}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Next review</dt>
                  <dd className="mt-1 text-ink-1">{guide.nextReviewAt}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Content owner</dt>
                  <dd className="mt-1 text-ink-1">Summit compliance desk</dd>
                </div>
              </dl>
              <LinkButton href="/contact" variant="secondary" className="mt-5 w-full">
                Ask the counter
              </LinkButton>
            </div>
          </aside>
        </div>
        <nav aria-label="Related guides" className="mt-12 border-t border-line pt-7">
          <h2 className="font-medium text-ink-1">Continue researching</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm">
            {SEO_GUIDES.filter((item) => item.slug !== guide.slug)
              .slice(0, 4)
              .map((item) => (
                <Link key={item.slug} href={`/guides/${item.slug}`} className="text-ink-1 underline underline-offset-4">
                  {item.eyebrow}
                </Link>
              ))}
          </div>
        </nav>
      </Container>
    </>
  );
}
