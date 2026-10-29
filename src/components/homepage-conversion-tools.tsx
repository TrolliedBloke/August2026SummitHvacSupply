"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Field, Input } from "@/components/form";
import { Button } from "@/components/ui";

/* The homeowner mini form that lived here posted free text to the contact
   endpoint; homeowner requests are now typed (HomeownerRequestForm ->
   /api/homeowner-requests), so the routing panel sends people there. */

export function HeroRoutingPanel() {
  const router = useRouter();
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
    router.push(`${base}${params}${anchor}`);
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
              aria-pressed={buyerType === value}
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
