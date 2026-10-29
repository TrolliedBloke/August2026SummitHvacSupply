"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

export type TocEntry = { id: string; label: string };

/**
 * "On this page": ordinary anchor links generated from section ids, so it
 * works with JavaScript off. With JavaScript, it marks the section currently
 * in view (aria-current="location" plus a weight and a rule -- never color
 * alone) and moves keyboard focus to a heading reached by hash, so the next
 * Tab continues from there. It never implies progress or completion.
 *
 * `variant="sticky"` is the wide-layout rail; `variant="compact"` is a
 * native <details> disclosure for narrow screens.
 */
export function TableOfContents({
  entries,
  variant,
  label = "On this page",
  className = "",
}: {
  entries: TocEntry[];
  variant: "sticky" | "compact";
  label?: string;
  className?: string;
}) {
  const active = useActiveSection(entries);
  const list = (
    <ol className="space-y-0.5">
      {entries.map((entry) => {
        const current = entry.id === active;
        return (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={current ? "location" : undefined}
              className={`block border-l-2 py-1.5 pl-3 text-sm leading-snug transition-colors duration-120 hover:text-ink-1 ${
                current ? "border-ink-1 font-medium text-ink-1" : "border-transparent text-ink-2"
              }`}
            >
              {entry.label}
            </a>
          </li>
        );
      })}
    </ol>
  );

  if (variant === "compact") {
    return (
      <details className={`group rounded-(--r-sm) border border-line bg-surface-1 ${className}`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-ink-1 [&::-webkit-details-marker]:hidden">
          {label}
          <ChevronDown size={16} aria-hidden="true" className="transition-transform duration-120 group-open:rotate-180" />
        </summary>
        <nav aria-label={label} className="border-t border-line px-2 py-2">
          {list}
        </nav>
      </details>
    );
  }
  return (
    <nav aria-label={label} className={className}>
      <p className="mb-2 pl-3 text-meta font-medium text-ink-3">{label}</p>
      {list}
    </nav>
  );
}

function useActiveSection(entries: TocEntry[]): string | null {
  const [active, setActive] = React.useState<string | null>(null);
  const key = entries.map((entry) => entry.id).join("|");

  React.useEffect(() => {
    const targets = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) visible.set(record.target.id, record.boundingClientRect.top);
          else visible.delete(record.target.id);
        }
        const first = targets.find((target) => visible.has(target.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "0px 0px -65% 0px", threshold: 0 }
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [key]);

  // A heading reached by hash gets focus, so keyboard and screen-reader users
  // continue from the section, not from the top of the page.
  React.useEffect(() => {
    const focusHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    focusHash();
    window.addEventListener("hashchange", focusHash);
    return () => window.removeEventListener("hashchange", focusHash);
  }, []);

  return active;
}
