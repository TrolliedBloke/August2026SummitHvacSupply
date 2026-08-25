import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Metadata lives here because the page is a client component -- see the note in
 * contact/layout.tsx.
 */
export const metadata: Metadata = pageMetadata({
  title: "Apply for a Trade Account",
  description:
    "Trade pricing, net terms, and will-call priority for licensed HVAC contractors in the Bay Area. Applications are reviewed by Summit HVAC Supply staff.",
  path: "/dealers",
});

export default function DealersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
