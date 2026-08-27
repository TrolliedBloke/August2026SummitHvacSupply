import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * The page itself is a client component (it owns a form with local state), and
 * a client component cannot export `metadata`. This layout carries it instead,
 * which is the only reason the file exists.
 */
export const metadata: Metadata = pageMetadata({
  title: "Contact the Newark Counter",
  description:
    "Reach Summit HVAC Supply in Newark, California by phone, text, or email for stock checks, model lookups, quote support, and will-call questions.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
