import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/ui";
import { Finder } from "@/components/finder/finder";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "HVAC system finder: size and match a heat pump or mini split",
  description:
    "Five questions to a starting size, the matched systems that meet California efficiency rules, and what your install will involve. Free, no account needed.",
  path: "/finder",
});

/**
 * A sizing and fit tool, not a personality quiz: the question set and the
 * rules behind the results live in lib/finder. The page is static; results
 * come from /api/finder.
 */
export default function FinderPage() {
  return (
    <Container className="py-10 lg:py-14">
      <div className="max-w-3xl">
        <Eyebrow>System finder</Eyebrow>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-ink-1 sm:text-4xl">Find a system that fits, then an installer.</h1>
        <p className="mt-3 text-ink-2">
          A few quick questions give you a starting size, the matched systems that meet California efficiency rules, and what your
          install will involve. Free, and no account needed.
        </p>
      </div>
      <div className="mt-8 max-w-3xl">
        <Finder />
      </div>
    </Container>
  );
}
