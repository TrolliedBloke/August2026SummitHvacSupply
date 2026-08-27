"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui";
import { Field, Input, Select, Textarea } from "@/components/form";
import { SITE } from "@/lib/site";
import { postJson } from "@/lib/client/post-json";

export function HomeownerRequestForm() {
  const [sent, setSent] = React.useState(false);
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [homeType, setHomeType] = React.useState("");
  const [ducts, setDucts] = React.useState("");
  const [rebates, setRebates] = React.useState("");
  const [timeline, setTimeline] = React.useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    if (!homeType || !ducts || !rebates || !timeline) {
      setIsSubmitting(false);
      setError("Please choose a home type, duct status, rebate interest, and timeline.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const detailLines = [
      `ZIP: ${String(form.get("zip") ?? "")}`,
      `City: ${String(form.get("city") ?? "")}`,
      `Home type: ${homeType}`,
      `Rooms / zones: ${String(form.get("zones") ?? "")}`,
      `Existing ducts: ${ducts}`,
      `Interested in rebates: ${rebates}`,
      `Timeline: ${timeline}`,
      `Notes: ${String(form.get("message") ?? "")}`,
    ];
    try {
      const payload = await postJson<{ ok: boolean; id?: string; error?: string }>("/api/contact-requests", {
        topic: "homeowner_one_system",
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        message: detailLines.join("\n"),
      });
      setRequestId(payload.id ?? null);
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not prepare homeowner request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-(--r-md) border border-eco/30 bg-eco-tint/50 p-6">
        <CheckCircle2 className="text-eco" size={28} />
        <h2 className="mt-3 font-display text-xl font-semibold text-ink-1">
          Homeowner request prepared.
        </h2>
        <p className="mt-2 text-ink-2">
          We will review your home details, help identify the right equipment
          lane, and follow up about Bay Area installer help. For urgent timing,
          call{" "}
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
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-(--r-md) border border-line bg-surface-1 p-6 shadow-[var(--shadow-sm)]">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink-1">
        Ask about one system or installer help
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Share the basics. You do not need a model number, contractor license, or
        complete project scope to start.
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="ZIP code" required>
          <Input name="zip" required inputMode="numeric" placeholder="94536" />
        </Field>
        <Field label="City" required>
          <Input name="city" required placeholder="Fremont" />
        </Field>
        <Field label="Home type" required>
          <Select
            ariaLabel="Home type"
            value={homeType}
            onChange={setHomeType}
            placeholder="Select home type"
            options={[
              { value: "single_family", label: "Single-family home" },
              { value: "townhome", label: "Townhome / condo" },
              { value: "adu", label: "ADU / addition" },
              { value: "small_commercial", label: "Small commercial space" },
            ]}
          />
        </Field>
        <Field label="Rooms / zones" required>
          <Input name="zones" required placeholder="1 room, 3 bedrooms, whole home..." />
        </Field>
        <Field label="Existing ducts" required>
          <Select
            ariaLabel="Existing ducts"
            value={ducts}
            onChange={setDucts}
            placeholder="Select one"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "unknown", label: "Not sure" },
            ]}
          />
        </Field>
        <Field label="Interested in rebates" required>
          <Select
            ariaLabel="Interested in rebates"
            value={rebates}
            onChange={setRebates}
            placeholder="Select one"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "unknown", label: "Not sure" },
            ]}
          />
        </Field>
        <Field label="Timeline" required>
          <Select
            ariaLabel="Timeline"
            value={timeline}
            onChange={setTimeline}
            placeholder="Select timeline"
            options={[
              { value: "asap", label: "As soon as possible" },
              { value: "month", label: "This month" },
              { value: "quarter", label: "Next 1-3 months" },
              { value: "researching", label: "Just researching" },
            ]}
          />
        </Field>
        <Field label="Name" required>
          <Input name="name" required autoComplete="name" placeholder="Your name" />
        </Field>
        <Field label="Email" required>
          <Input name="email" type="email" required autoComplete="email" placeholder="you@email.com" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Anything else?" hint="Optional">
            <Textarea name="message" rows={4} placeholder="Comfort issue, preferred brand, existing quote, panel concerns, or anything you already know." />
          </Field>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" className="mt-6" disabled={isSubmitting}>
        {isSubmitting ? "Preparing..." : "Get Bay Area installer help"}
        <ArrowRight size={18} />
      </Button>
    </form>
  );
}
