"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import * as React from "react";

type Suggestion = { href: string; title: string; detail: string };

const CATEGORY_SLUGS = [
  "mini-splits", "central-heat-pumps", "central-air-conditioners", "air-handlers", "evaporator-coils",
  "furnaces", "cassettes", "line-sets", "controls", "installation-supplies",
];

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/**
 * Reduce a missing URL to the parts recovery needs, and nothing else: path
 * segments only (never the query string, which can hold emails or tokens),
 * lowercased, with anything that looks like an email or a long secret dropped.
 */
export function recoveryTokens(pathname: string): { pattern: string; segments: string[] } {
  const segments = pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment).toLowerCase().trim())
    .filter(Boolean)
    .filter((segment) => !segment.includes("@") && segment.length <= 64 && !/^[a-z0-9_-]{32,}$/.test(segment));
  const pattern = segments.length === 0 ? "/" : `/${segments[0]}${segments.length > 1 ? "/*" : ""}`;
  return { pattern, segments };
}

/**
 * Client-side enhancement for the 404 page: Next's not-found boundary does not
 * receive the missing path, so the page's static fallback ships first and this
 * adds targeted suggestions -- only above a confidence threshold -- plus one
 * privacy-safe analytics event (route pattern and referrer class only). It
 * never touches the cart, the saved ZIP or the session.
 */
export function NotFoundRecovery() {
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);

  React.useEffect(() => {
    const { pattern, segments } = recoveryTokens(window.location.pathname);
    const referrer = !document.referrer ? "none" : new URL(document.referrer).host === window.location.host ? "internal" : "external";
    let cancelled = false;

    const found: Suggestion[] = [];
    const category = segments
      .map((segment) => ({ segment, match: CATEGORY_SLUGS.map((slug) => ({ slug, d: distance(segment, slug) })).sort((a, b) => a.d - b.d)[0] }))
      .find(({ segment, match }) => match.d > 0 && match.d <= Math.max(1, Math.floor(segment.length / 6)));
    if (category) {
      found.push({ href: `/products?category=${category.match.slug}`, title: category.match.slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()), detail: "Category" });
    }

    // A SKU-shaped segment: letters and digits, long enough to be specific.
    const code = [...segments].reverse().find((segment) => /[a-z]/.test(segment) && /\d/.test(segment) && segment.replace(/[^a-z0-9]/g, "").length >= 5);
    const lookup = code
      ? fetch(`/api/search?q=${encodeURIComponent(code.replace(/-/g, " "))}`)
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => {
            // Confidence threshold: an exact or near-exact identifier (score 55+
            // covers exact, normalized and a prefix missing a character or two).
            const exact = (payload?.results ?? []).filter((result: { identifierScore?: number }) => (result.identifierScore ?? 0) >= 55).slice(0, 2);
            for (const result of exact) found.push({ href: result.href, title: result.title, detail: `SKU ${result.sku}` });
          })
          .catch(() => undefined)
      : Promise.resolve();

    lookup.then(() => {
      if (cancelled) return;
      setSuggestions(found);
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "not_found", page: pattern, metadata: { referrer, suggestions: found.length } }),
        keepalive: true,
      }).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (suggestions.length === 0) return null;
  return (
    <section aria-labelledby="not-found-suggestions" className="mx-auto mt-10 max-w-xl">
      <h2 id="not-found-suggestions" className="text-center text-sm font-medium text-ink-1">
        Were you looking for
      </h2>
      <ul className="mt-3 grid gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.href}>
            <Link href={suggestion.href} className="group flex items-center justify-between gap-3 rounded-(--r-sm) border border-line bg-surface-1 px-4 py-3 text-sm hover:border-line-strong">
              <span className="min-w-0">
                <span className="block font-medium text-ink-1">{suggestion.title}</span>
                <span className="block text-xs text-ink-3">{suggestion.detail}</span>
              </span>
              <ArrowRight size={15} className="shrink-0 text-ink-3" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
