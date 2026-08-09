"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Ruler } from "lucide-react";
import * as React from "react";

/* A catalog-narrowing aid, not a compatibility or availability promise.
   Sizing bands are a public rule of thumb (9k ≈ 400 sq ft,
   12k ≈ 550, 18k ≈ 750, 24k ≈ 1,000); the installer's Manual J is the
   real number and we say so. */

export type SizerSku = {
  id: string;
  sku: string;
  title: string;
  btu: number;
  msrp: number;
  retailPrice?: number | null;
  seriesSlug: string;
  image: string;
  available: number;
  href: string;
};

const AREAS = [
  { value: 400, label: "Up to 400 sq ft", hint: "bedroom, office, garage" },
  { value: 550, label: "400–550 sq ft", hint: "large room, studio, ADU" },
  { value: 750, label: "550–750 sq ft", hint: "open living area" },
  { value: 1000, label: "750–1,000+ sq ft", hint: "large open plan" },
] as const;

const SCOPES = [
  { value: "one", label: "One room" },
  { value: "few", label: "2–4 rooms" },
  { value: "whole", label: "Whole home" },
] as const;

type Scope = (typeof SCOPES)[number]["value"];

function btuForArea(area: number): number {
  if (area <= 400) return 9000;
  if (area <= 550) return 12000;
  if (area <= 750) return 18000;
  return 24000;
}

function recommend(skus: SizerSku[], scope: Scope, area: number, ducts: boolean): SizerSku[] {
  const byCategory = (slug: string) =>
    skus.filter((sku) => sku.seriesSlug === slug).sort((a, b) => a.msrp - b.msrp);

  if (scope === "whole") {
    const lane = ducts ? byCategory("central-systems") : byCategory("mini-splits");
    return lane.slice(0, 2);
  }
  if (scope === "few") {
    return byCategory("mini-splits").filter((sku) => sku.title.toLowerCase().includes("mz")).slice(0, 2);
  }
  // Single room: closest catalog mini-split records to the target BTU.
  const target = btuForArea(area);
  return skus
    .filter((sku) => sku.seriesSlug === "mini-splits")
    .sort(
      (a, b) =>
        Math.abs(a.btu - target) - Math.abs(b.btu - target) || a.msrp - b.msrp
    )
    .slice(0, 2);
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SystemSizer({ skus }: { skus: SizerSku[] }) {
  const [scope, setScope] = React.useState<Scope>("one");
  const [area, setArea] = React.useState<number>(400);
  const [ducts, setDucts] = React.useState(false);

  const matches = recommend(skus, scope, area, ducts);

  return (
    <div className="min-w-0 rounded-(--r-lg) border border-line bg-surface-1 p-5 shadow-[var(--shadow-lg)] sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">
          <Ruler size={17} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-ink-1">
            What size do I need?
          </p>
          <p className="text-xs text-ink-3">Narrow the catalog; staff confirms the final match.</p>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-ink-1">I&apos;m conditioning</legend>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-(--r-sm) border border-line bg-surface-2 p-1">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setScope(option.value)}
              aria-pressed={scope === option.value}
              className={`h-9 rounded-(--r-sm) text-[13px] font-medium transition-colors ${
                scope === option.value
                  ? "bg-surface-1 text-brand shadow-[var(--shadow-sm)]"
                  : "text-ink-2 hover:text-ink-1"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {scope === "one" && (
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-ink-1">Room size</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {AREAS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setArea(option.value)}
                aria-pressed={area === option.value}
                className={`rounded-(--r-sm) border px-3 py-2 text-left transition-colors ${
                  area === option.value
                    ? "border-brand bg-brand-tint"
                    : "border-line bg-surface-1 hover:border-line-strong"
                }`}
              >
                <span className="block text-[13px] font-medium text-ink-1">{option.label}</span>
                <span className="block text-[11px] text-ink-3">{option.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {scope === "whole" && (
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-ink-1">Usable ductwork?</legend>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-(--r-sm) border border-line bg-surface-2 p-1">
            {[
              [true, "Yes, has ducts"],
              [false, "No / not sure"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setDucts(value as boolean)}
                aria-pressed={ducts === value}
                className={`h-9 rounded-(--r-sm) text-[13px] font-medium transition-colors ${
                  ducts === value
                    ? "bg-surface-1 text-brand shadow-[var(--shadow-sm)]"
                    : "text-ink-2 hover:text-ink-1"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-4 flex flex-col gap-2" aria-live="polite">
        {matches.map((sku) => (
          <Link
            key={sku.id}
            href={sku.href}
            className="group flex items-center gap-3 rounded-(--r-sm) border border-line bg-canvas p-3 transition-colors hover:border-brand"
          >
            <span className="relative size-14 shrink-0 overflow-hidden rounded-(--r-sm) bg-surface-2">
              <Image src={sku.image} alt="" fill sizes="56px" className="object-contain p-1" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-1">{sku.title}</span>
              <span className="block text-xs text-ink-3">
                {sku.btu.toLocaleString()} BTU · {sku.retailPrice !== null ? "retail ordering" : "contact for price"}
              </span>
            </span>
            <span className="text-right">
              <span className="tnum block font-display text-base font-semibold text-ink-1">
                {(sku.retailPrice ?? (sku.msrp > 0 ? sku.msrp : null)) !== null ? currency(sku.retailPrice ?? sku.msrp) : "Request price"}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-brand">
                View <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
        Rule-of-thumb estimate. Your installer confirms the final size with a
        Manual J load calculation before anything is ordered.
      </p>
    </div>
  );
}
