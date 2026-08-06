"use client";

import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import * as React from "react";
import { Field, Input, Select } from "@/components/form";
import { Button } from "@/components/ui";
import { postJson } from "@/lib/client/post-json";

const homeTypeOptions = [
  { value: "single_family", label: "Single-family" },
  { value: "townhome_condo", label: "Townhome / condo" },
  { value: "adu_addition", label: "ADU / addition" },
  { value: "small_commercial", label: "Small commercial" },
];

const ductsOptions = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not sure" },
];

const timelineOptions = [
  { value: "asap", label: "ASAP" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "1-3 months" },
  { value: "researching", label: "Researching" },
];

export function HeroRoutingPanel() {
  const [buyerType, setBuyerType] = React.useState<"homeowner" | "contractor" | "property">("homeowner");
  const [zip, setZip] = React.useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const base =
      buyerType === "contractor"
        ? "/products"
        : buyerType === "property"
          ? "/quote"
          : "/homeowners";
    const params = zip.trim() ? `?zip=${encodeURIComponent(zip.trim())}` : "";
    const anchor = buyerType === "homeowner" ? "#homeowner-request" : "";
    window.location.href = `${base}${params}${anchor}`;
  }

  return (
    <form
      onSubmit={onSubmit}
      data-conversion-hook="zip-routing-start"
      className="rounded-(--r-lg) border border-line bg-surface-1 p-4 shadow-[var(--shadow-lg)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl font-semibold tracking-tight text-ink-1">
            Start here
          </p>
          <p className="mt-1 text-sm text-ink-2">No model number needed.</p>
        </div>
        <span className="rounded-full bg-stock-ready-tint px-3 py-1 text-xs font-medium text-stock-ready-ink">
          Bay Area help
        </span>
      </div>

      <div className="mt-4 sm:mt-5">
        <Field label="ZIP code">
          <Input
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            inputMode="numeric"
            placeholder="94560"
            aria-label="ZIP code"
          />
        </Field>
      </div>

      <div className="mt-4 sm:mt-5">
        <span className="text-sm font-medium text-ink-1">I am a</span>
        <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-(--r-sm) border border-line bg-surface-2 p-1">
          {[
            ["homeowner", "Homeowner"],
            ["contractor", "Contractor"],
            ["property", "Property"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setBuyerType(value as "homeowner" | "contractor" | "property")}
              className={`h-10 rounded-(--r-sm) text-sm font-medium transition-colors ${
                buyerType === value
                  ? "bg-surface-1 text-brand shadow-[var(--shadow-sm)]"
                  : "text-ink-2 hover:text-ink-1"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" full className="mt-4 sm:mt-5" data-conversion-hook="hero-routing-submit">
        Start
        <ArrowRight size={18} />
      </Button>
      <p className="mt-3 hidden text-xs leading-relaxed text-ink-3 sm:block">
        Homeowners get equipment guidance and installer referral. Contractors go straight to
        systems, stock, and documents.
      </p>
    </form>
  );
}

export function HomepageHomeownerMiniForm() {
  const [sent, setSent] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [homeType, setHomeType] = React.useState("");
  const [ducts, setDucts] = React.useState("");
  const [timeline, setTimeline] = React.useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!homeType || !ducts || !timeline) {
      setError("Please choose home type, duct status, and timeline.");
      return;
    }
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await postJson<{ ok: boolean; error?: string }>("/api/contact-requests", {
        topic: "homeowner_one_system",
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        message: [
          "Homepage mini form",
          `ZIP: ${String(form.get("zip") ?? "")}`,
          `Home type: ${homeType}`,
          `Rooms / zones: ${String(form.get("zones") ?? "")}`,
          `Existing ducts: ${ducts}`,
          `Timeline: ${timeline}`,
        ].join("\n"),
      });
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not send request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-(--r-md) border border-eco/30 bg-eco-tint/50 p-6">
        <CheckCircle2 size={28} className="text-eco" />
        <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-ink-1">
          Request received.
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          We&apos;ll review your details and explain the next step before you buy equipment.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-conversion-hook="homeowner-mini-form-submit"
      className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">
          <Search size={18} />
        </span>
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight text-ink-1">
            Get Bay Area installer help
          </h3>
          <p className="mt-1 text-sm text-ink-2">A short start for one-system buyers.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="ZIP code" required>
          <Input name="zip" required inputMode="numeric" placeholder="94560" />
        </Field>
        <Field label="Home type" required>
          <Select value={homeType} onChange={setHomeType} placeholder="Select" options={homeTypeOptions} />
        </Field>
        <Field label="Rooms / zones" required>
          <Input name="zones" required placeholder="1 room, whole home..." />
        </Field>
        <Field label="Existing ducts" required>
          <Select value={ducts} onChange={setDucts} placeholder="Select" options={ductsOptions} />
        </Field>
        <Field label="Timeline" required>
          <Select value={timeline} onChange={setTimeline} placeholder="Select" options={timelineOptions} />
        </Field>
        <Field label="Name" required>
          <Input name="name" required autoComplete="name" placeholder="Your name" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email" required>
            <Input name="email" type="email" required autoComplete="email" placeholder="you@email.com" />
          </Field>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" full className="mt-5" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Get Bay Area installer help"}
        <ArrowRight size={18} />
      </Button>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        We&apos;ll review your details and explain the next step before you buy equipment.
      </p>
    </form>
  );
}
