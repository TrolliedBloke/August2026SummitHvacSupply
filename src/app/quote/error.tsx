"use client";

export default function QuoteError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="font-display text-2xl font-semibold text-ink-1">Quote request could not load</h1><p className="mt-2 text-sm text-ink-2">{error.message || "Your saved quote list is still on this device."}</p><button type="button" onClick={unstable_retry} className="mt-5 h-11 rounded-(--r-sm) bg-brand px-4 text-sm font-semibold text-brand-ink">Try again</button></main>;
}
