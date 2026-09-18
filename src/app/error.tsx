"use client"; // Error boundaries must be Client Components

import * as React from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { SITE } from "@/lib/site";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  React.useEffect(() => {
    // Surface for local debugging; wire an error reporter here in production.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[var(--page-max)] px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-copper">
          Something went wrong
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-1">
          We hit a snag loading this page.
        </h1>
        <p className="mt-3 text-ink-2">
          Your cart is safe. Try again, or call us at{" "}
          <a href={SITE.phoneHref} className="font-medium text-brand hover:text-brand-hover">
            {SITE.phone}
          </a>{" "}
          and we&apos;ll take the order by phone.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-ink-4">Reference: {error.digest}</p>
        )}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={() => unstable_retry()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-(--r-sm) bg-brand px-6 text-[15px] font-medium text-brand-ink shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-hover"
          >
            <RotateCcw size={16} /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-6 text-[15px] font-medium text-ink-1 transition-colors hover:bg-surface-2"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
