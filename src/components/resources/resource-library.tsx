"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ExternalLink, FileText, Search, Wrench, X } from "lucide-react";
import * as React from "react";
import { StatePanel } from "@/components/state";
import {
  behaviorLabel,
  filterResources,
  parseResourceFilters,
  resourceActionLabel,
  RESOURCE_TOPICS,
  RESOURCE_TYPE_LABEL,
  serializeResourceFilters,
  type ResourceFilters,
  type ResourceItem,
  type ResourceType,
} from "@/lib/resources";

const ICON: Record<ResourceType, React.ReactNode> = {
  guide: <BookOpen size={18} aria-hidden="true" />,
  tool: <Wrench size={18} aria-hidden="true" />,
  document: <FileText size={18} aria-hidden="true" />,
  external: <ExternalLink size={18} aria-hidden="true" />,
};

/**
 * The resource library: text search plus type and topic filters, all in the
 * URL (shareable, and Back/Forward restore them). Each card says what
 * activating it does -- "PDF, 1.2 MB · Opens in a new tab" -- in words, with
 * the icon as a second signal.
 */
export function ResourceLibrary({ items }: { items: ResourceItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = parseResourceFilters(params);
  const [query, setQuery] = React.useState(filters.q);
  const [synced, setSynced] = React.useState(filters.q);
  if (filters.q !== synced) {
    setSynced(filters.q);
    setQuery(filters.q);
  }
  const shown = filterResources(items, filters);
  const filterKey = serializeResourceFilters(filters);
  const [visibility, setVisibility] = React.useState({ key: filterKey, count: 12 });
  const visibleCount = visibility.key === filterKey ? visibility.count : 12;
  const visible = shown.slice(0, visibleCount);

  function commit(next: ResourceFilters) {
    const qs = serializeResourceFilters(next);
    router.push(qs ? `${pathname}?${qs}#library` : `${pathname}#library`, { scroll: false });
  }

  const counts = (type: ResourceType | null) => filterResources(items, { ...filters, type }).length;
  const active = Boolean(filters.q || filters.type || filters.topic);

  return (
    <section id="library" aria-labelledby="library-title" className="scroll-mt-6">
      <h2 id="library-title" className="text-2xl font-semibold tracking-tight text-ink-1">Guides, tools &amp; documents</h2>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          commit({ ...filters, q: query.trim() });
        }}
        className="mt-5 flex max-w-xl items-center gap-2 rounded-(--r-md) border border-line bg-surface-1 p-2"
      >
        <label htmlFor="resource-search" className="sr-only">Search resources</label>
        <Search size={17} className="ml-1 shrink-0 text-ink-3" aria-hidden="true" />
        <input id="resource-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by topic, model, or keyword" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-4" />
        <button type="submit" className="h-11 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">Search</button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Resource type">
        {([null, "guide", "tool", "document", "external"] as const).map((type) => (
          <button
            key={type ?? "all"}
            type="button"
            aria-pressed={filters.type === type}
            onClick={() => commit({ ...filters, type })}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm ${filters.type === type ? "border-brand bg-brand-tint font-medium text-ink-1" : "border-line text-ink-1 hover:border-line-strong"}`}
          >
            {type ? `${RESOURCE_TYPE_LABEL[type]}s` : "All"}
            <span className="part-number text-xs text-ink-3">{counts(type)}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Topic">
        {RESOURCE_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            aria-pressed={filters.topic === topic}
            onClick={() => commit({ ...filters, topic: filters.topic === topic ? null : topic })}
            className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm ${filters.topic === topic ? "border-brand bg-brand-tint font-medium text-ink-1" : "border-line text-ink-2 hover:border-line-strong"}`}
          >
            {topic}
          </button>
        ))}
        {active && (
          <button type="button" onClick={() => commit({ q: "", type: null, topic: null })} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-ink-2 underline underline-offset-4">
            <X size={14} aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      <p role="status" className="mt-4 text-sm text-ink-3">
        {shown.length} {shown.length === 1 ? "resource" : "resources"}
        {filters.q ? ` for “${filters.q}”` : ""}
      </p>

      {shown.length === 0 ? (
        <StatePanel
          className="mt-3"
          title="No resources match"
          actions={
            <>
              <button type="button" onClick={() => commit({ q: "", type: null, topic: null })} className="inline-flex h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">Clear filters</button>
              <Link href="/contact?topic=product" className="inline-flex h-11 items-center rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium text-ink-1">Request a document</Link>
            </>
          }
        >
          Try another word, or ask the counter for the exact-model document you need.
        </StatePanel>
      ) : (
        <ul className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
          {visible.map((item) => (
            <li key={item.id} className="min-w-0">
              <ResourceCard item={item} />
            </li>
          ))}
          {visible.length < shown.length && (
            <li className="col-span-full flex justify-center pt-3">
              <button
                type="button"
                onClick={() => setVisibility({ key: filterKey, count: visibleCount + 12 })}
                className="inline-flex min-h-11 items-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-5 text-sm font-medium text-ink-1 hover:border-ink-3"
              >
                Show 12 more <span className="ml-2 text-ink-3">({shown.length - visible.length} remaining)</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function ResourceCard({ item }: { item: ResourceItem }) {
  const unavailable = item.type === "document" && !item.available;
  const label = behaviorLabel(item);
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium text-ink-3">
        {ICON[item.type]}
        <span>{label}</span>
      </span>
      <span className="mt-2 block break-words font-medium text-ink-1">{item.title}</span>
      <span className="mt-1 block text-sm leading-6 text-ink-2">{item.summary}</span>
      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
        {item.topics.map((topic) => (
          <span key={topic}>{topic}</span>
        ))}
        {item.updated && <span>Updated {item.updated}</span>}
      </span>
    </>
  );
  const shell = "flex h-full flex-col rounded-(--r-sm) border border-line bg-surface-1 p-4";

  if (unavailable) {
    return (
      <div className={`${shell} border-dashed`}>
        {body}
        <span className="mt-3 text-sm text-ink-2">
          This file is temporarily unavailable.{" "}
          <Link href="/contact?topic=product" className="font-medium text-ink-1 underline underline-offset-4">Request it</Link>
        </span>
      </div>
    );
  }
  const external = item.type === "external" || (item.type === "document" && item.opensInNewTab);
  if (external) {
    return (
      <a href={item.destination} target="_blank" rel="noopener noreferrer" data-conversion-hook="resource-document-download" className={`${shell} transition-colors hover:border-line-strong`}>
        {body}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-ink-1">
          {resourceActionLabel(item)} <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only">, opens in a new tab</span>
        </span>
      </a>
    );
  }
  return (
    <Link href={item.destination} className={`${shell} transition-colors hover:border-line-strong`}>
      {body}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-ink-1">
        {resourceActionLabel(item)} <ArrowRight size={14} aria-hidden="true" />
      </span>
    </Link>
  );
}
