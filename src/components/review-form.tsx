"use client";

import { CheckCircle2, Star } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui";
import { Field, Input, Select, Textarea } from "@/components/form";
import { postJson } from "@/lib/client/post-json";
import { SITE } from "@/lib/site";

const AUDIENCES = [
  { value: "homeowner", label: "Homeowner" },
  { value: "contractor", label: "Contractor / installer" },
  { value: "property_manager", label: "Property manager" },
];

/**
 * Review form reached from the day-14 request email. Nothing here publishes:
 * every submission lands as 'pending' for a human to read, which is why the
 * copy promises moderation rather than instant posting.
 */
export function ReviewForm({
  skuId,
  productTitle,
  orderNumber,
}: {
  skuId?: string;
  productTitle?: string;
  orderNumber?: string;
}) {
  const [sent, setSent] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState(0);
  const [audience, setAudience] = React.useState("homeowner");
  const [consent, setConsent] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    if (!consent) {
      setError("We need your permission before we can publish this.");
      return;
    }
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/reviews", {
        skuId,
        authorName: String(form.get("authorName") ?? ""),
        city: String(form.get("city") ?? ""),
        audience,
        rating,
        title: String(form.get("title") ?? ""),
        body: String(form.get("body") ?? ""),
        orderNumber,
        consentPublish: consent,
      });
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save your review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-(--r-md) border border-eco/30 bg-eco-tint/50 p-6">
        <CheckCircle2 className="text-eco" size={28} />
        <h2 className="mt-3 font-display text-xl font-semibold text-ink-1">Thank you — we have it.</h2>
        <p className="mt-2 text-ink-2">
          A person reads every review before it goes up, so it will not appear
          immediately. We publish them as written.
        </p>
        <p className="mt-2 text-ink-2">
          If anything about the order still needs fixing, call {SITE.phone} — that
          reaches us faster than this form.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {productTitle && (
        <p className="text-sm text-ink-2">
          Reviewing <span className="font-medium text-ink-1">{productTitle}</span>
          {orderNumber ? ` · order ${orderNumber}` : ""}
        </p>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-ink-1">
          Overall rating<span className="ml-0.5 text-copper">*</span>
        </legend>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
              aria-pressed={rating === value}
              className="rounded-(--r-sm) p-1 text-ink-4 transition-colors hover:text-copper focus:outline-none focus:ring-2 focus:ring-brand/25"
            >
              <Star
                size={26}
                strokeWidth={1.75}
                className={value <= rating ? "fill-copper text-copper" : ""}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Your name" required>
        <Input name="authorName" required maxLength={80} autoComplete="name" />
      </Field>

      <Field label="City" hint="optional">
        <Input name="city" maxLength={60} placeholder="Fremont" />
      </Field>

      <Field label="You are a" required>
        <Select value={audience} onChange={setAudience} options={AUDIENCES} />
      </Field>

      <Field label="Headline" hint="optional">
        <Input name="title" maxLength={100} placeholder="Quiet, and it held through the heat wave" />
      </Field>

      <Field label="Your review" required hint="a sentence or two is plenty">
        <Textarea
          name="body"
          required
          rows={6}
          minLength={20}
          maxLength={4000}
          placeholder="How did the install go? Is it doing what you needed?"
        />
      </Field>

      <label className="flex items-start gap-2.5 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
        />
        <span>
          You may publish this review with my first name and city. I was not
          offered anything in exchange for it.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Sending…" : "Submit review"}
      </Button>
    </form>
  );
}
