"use client"; // Error boundaries must be Client Components

import * as React from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Container } from "@/components/ui";
import { StatePanel } from "@/components/state";
import { SITE } from "@/lib/site";

/* The catalog failed to render. Recoverable: retry re-runs the route, the cart
   is untouched, and the counter is one call away. Distinct from the empty
   state (nothing matched) and the partial state (stock counts missing). */
export default function CatalogError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16 lg:py-24">
      <StatePanel
        tone="danger"
        role="alert"
        title="The catalog did not load"
        actions={
          <>
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink hover:bg-brand-hover"
            >
              <RotateCcw size={16} aria-hidden="true" /> Try again
            </button>
            <a
              href={SITE.phoneHref}
              className="inline-flex h-11 items-center justify-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-5 text-sm font-medium text-ink-1 hover:bg-surface-2"
            >
              Call {SITE.phone}
            </a>
          </>
        }
      >
        Your cart is safe. Try again, or <Link href="/" className="text-ink-1 underline underline-offset-4">go to the homepage</Link>.
        {error.digest && <span className="mt-2 block text-xs text-ink-3">Reference: {error.digest}</span>}
      </StatePanel>
    </Container>
  );
}
