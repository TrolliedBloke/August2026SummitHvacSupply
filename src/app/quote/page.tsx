"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Phone } from "lucide-react";
import * as React from "react";
import { Container, Eyebrow, Button } from "@/components/ui";
import { Field, Input, Textarea } from "@/components/form";
import { useQuote } from "@/components/quote-context";
import { SITE } from "@/lib/site";
import { postJson } from "@/lib/client/post-json";

export default function QuotePage() {
  const { items, count, hydrated } = useQuote();
  const [sent, setSent] = React.useState(false);
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const payload = await postJson<{ ok: boolean; id?: string; error?: string }>("/api/quote-requests", {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        need: String(form.get("need") ?? ""),
        lines: items.map((item) => ({
          skuId: item.skuId,
          sku: item.sku,
          modelNumber: item.modelNumber,
          productName: item.title,
          quantity: item.qty,
        })),
      });
      setRequestId(payload.id ?? null);
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not prepare quote request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container className="py-12 lg:py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        {/* Form column */}
        <div className="max-w-xl">
          <Eyebrow>Get a quote</Eyebrow>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
            Tell us what you need. We&apos;ll prepare pricing &amp; lead times.
          </h1>
          <p className="mt-3 text-ink-2">
            Four fields, no account required. Staff reviews the exact identifiers,
            price, availability, and fulfillment before following up.
          </p>

          {sent ? (
            <div className="mt-8 rounded-(--r-md) border border-eco/30 bg-eco-tint/50 p-6">
              <CheckCircle2 className="text-eco" size={28} />
              <h2 className="mt-3 font-display text-xl font-semibold text-ink-1">
                Quote request prepared.
              </h2>
              <p className="mt-2 text-ink-2">
                Your request{count > 0 ? ` for ${count} unit${count === 1 ? "" : "s"}` : ""} is ready for pricing and availability review. For the fastest response, call{" "}
                <a href={SITE.phoneHref} className="font-medium text-brand">
                  {SITE.phone}
                </a>
                .
              </p>
              {requestId && (
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                  Request ID {requestId}
                </p>
              )}
              <Link
                href="/products"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
              >
                Keep browsing the lineup <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
              <Field label="Name" required>
                <Input name="name" required autoComplete="name" placeholder="Your name or company" />
              </Field>
              <Field label="Email" required>
                <Input name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
              </Field>
              <Field label="Phone" hint="Optional, fastest if you want a callback">
                <Input name="phone" type="tel" autoComplete="tel" placeholder="(415) 000-0000" />
              </Field>
              <Field label="What do you need?" required>
                <Textarea
                  name="need"
                  required
                  rows={4}
                  placeholder="e.g. (3) TCL24KIDU units for a Bay Area changeout, plus verified outdoor-unit compatibility and lead time."
                />
              </Field>
              <Button type="submit" size="lg" className="self-start" disabled={isSubmitting}>
                {isSubmitting ? "Preparing..." : "Prepare quote request"}
                <ArrowRight size={18} />
              </Button>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            </form>
          )}
        </div>

        {/* Aside: quote summary + reassurance */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4 overflow-hidden rounded-(--r-md) border border-line bg-surface-2 shadow-[var(--shadow-sm)]">
            <div className="relative aspect-[16/10]">
              <Image
                src="/site/generated/spec-workbench-documents.jpg"
                alt="HVAC quote preparation with spec sheets and installation materials"
                fill
                preload
                sizes="(min-width: 1024px) 380px, 100vw"
                className="object-cover"
              />
            </div>
            <p className="p-4 text-sm leading-relaxed text-ink-2">
              Quotes are reviewed against equipment details, stock, documents,
              and fulfillment timing before follow-up.
            </p>
          </div>
          <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-sm font-semibold text-ink-1">
              On your quote list
            </h2>
            {!hydrated ? (
              <div className="mt-3 h-12 animate-pulse rounded-(--r-sm) bg-surface-2" aria-label="Loading quote list" />
            ) : items.length === 0 ? (
              <p className="mt-2 text-sm text-ink-3">
                Nothing added yet. That is fine, just describe what you need above.
                Or{" "}
                <Link href="/products" className="font-medium text-brand">
                  browse products
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--line)]">
                {items.map((i) => (
                  <li key={i.skuId} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <Link href={`/products/sku/${encodeURIComponent(i.sku)}`} className="text-ink-1 hover:text-brand">
                      {i.title}
                    </Link>
                    <span className="tnum font-mono text-ink-3">×{i.qty}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <a
            href={SITE.phoneHref}
            className="mt-4 flex items-center gap-3 rounded-(--r-md) border border-line bg-surface-2 p-4 text-ink-1 transition-colors hover:bg-surface-3"
          >
            <span className="grid size-10 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">
              <Phone size={18} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-xs text-ink-3">Prefer to talk?</span>
              <span className="text-sm font-semibold">{SITE.phone}</span>
            </span>
          </a>
        </aside>
      </div>
    </Container>
  );
}
