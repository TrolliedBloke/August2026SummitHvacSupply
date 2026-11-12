import { Star } from "lucide-react";
import { SITE } from "@/lib/site";

/** Bare domain Google expects, e.g. "summithvacsupply.com". */
const SOURCE_DOMAIN = new URL(SITE.origin).hostname.replace(/^www\./, "");

/** Google's "Preferred sources" page, pre-filled with our domain. */
export const GOOGLE_PREFERRED_SOURCE_URL = `https://www.google.com/preferences/source?q=${encodeURIComponent(SOURCE_DOMAIN)}`;

interface GooglePreferredSourceProps {
  className?: string;
}

/** Lets a visitor add the site as a preferred source in Google Search's Top Stories. */
export function GooglePreferredSource({ className = "" }: GooglePreferredSourceProps) {
  return (
    <a
      href={GOOGLE_PREFERRED_SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-white/40 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 ${className}`}
    >
      <Star size={18} strokeWidth={1.75} aria-hidden="true" />
      Add us as a preferred source on Google
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
