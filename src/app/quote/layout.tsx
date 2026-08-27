import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Metadata lives here because the page is a client component -- see the note in
 * contact/layout.tsx.
 */
export const metadata: Metadata = pageMetadata({
  title: "Request a Quote",
  description:
    "Send a project list, model numbers, or a photo of the nameplate and get pricing, availability, and lead times from Summit HVAC Supply in Newark, California.",
  path: "/quote",
});

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
