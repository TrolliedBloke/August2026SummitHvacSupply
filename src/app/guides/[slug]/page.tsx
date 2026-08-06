import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarClock, MapPin } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Container, Eyebrow, LinkButton } from "@/components/ui";
import { getSeoGuide, SEO_GUIDES } from "@/lib/seo/guides";
import { pageMetadata } from "@/lib/seo/metadata";

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

  return <>
    <header className="border-b border-line bg-surface-1"><Container className="py-12 sm:py-16"><Breadcrumbs items={[{ label: "Resources", href: "/resources" }, { label: guide.eyebrow, href: `/guides/${guide.slug}` }]} /><Eyebrow>{guide.eyebrow}</Eyebrow><h1 className="mt-3 max-w-4xl font-display text-3xl font-medium leading-tight text-ink-1 sm:text-5xl">{guide.h1}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-ink-2">{guide.intro}</p></Container></header>
    <Container className="py-10 sm:py-14"><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"><article className="min-w-0">{guide.sections.map((section) => <section key={section.heading} className="border-b border-line py-7 first:pt-0"><h2 className="font-display text-2xl font-medium text-ink-1">{section.heading}</h2><p className="mt-3 leading-7 text-ink-2">{section.body}</p>{section.bullets && <ul className="mt-4 space-y-2 text-sm leading-6 text-ink-2">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-1" />{bullet}</li>)}</ul>}</section>)}<section className="pt-7"><h2 className="font-display text-2xl font-medium text-ink-1">Primary sources</h2><p className="mt-2 text-sm leading-6 text-ink-2">Use these agencies as the source of truth. Summit summarizes them for equipment planning and does not provide legal, tax, engineering, or permit advice.</p><div className="mt-4 grid gap-2">{guide.sources.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-(--r-sm) border border-line bg-surface-1 p-4 text-sm text-ink-1"><span>{source.label}</span><ArrowUpRight size={17} aria-hidden /></a>)}</div></section></article><aside className="h-fit rounded-(--r-md) border border-line bg-surface-1 p-5 lg:sticky lg:top-20"><h2 className="font-medium text-ink-1">Review record</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="flex items-center gap-2 text-ink-3"><MapPin size={16} />Jurisdiction</dt><dd className="mt-1 leading-6 text-ink-1">{guide.jurisdiction}</dd></div><div><dt className="flex items-center gap-2 text-ink-3"><CalendarClock size={16} />Effective date</dt><dd className="mt-1 leading-6 text-ink-1">{guide.effectiveDate}</dd></div><div><dt className="text-ink-3">Pending changes</dt><dd className="mt-1 leading-6 text-ink-1">{guide.pending}</dd></div><div><dt className="text-ink-3">Last reviewed</dt><dd className="mt-1 text-ink-1">{guide.reviewedAt}</dd></div><div><dt className="text-ink-3">Next review</dt><dd className="mt-1 text-ink-1">{guide.nextReviewAt}</dd></div><div><dt className="text-ink-3">Content owner</dt><dd className="mt-1 text-ink-1">Summit compliance desk</dd></div></dl><LinkButton href="/contact" variant="secondary" className="mt-5 w-full">Ask the counter</LinkButton></aside></div><nav aria-label="Related guides" className="mt-12 border-t border-line pt-7"><h2 className="font-medium text-ink-1">Continue researching</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm">{SEO_GUIDES.filter((item) => item.slug !== guide.slug).slice(0, 4).map((item) => <Link key={item.slug} href={`/guides/${item.slug}`} className="text-ink-1 underline underline-offset-4">{item.eyebrow}</Link>)}</div></nav></Container>
  </>;
}
