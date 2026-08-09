"use client";

import { BellRing, Check } from "lucide-react";
import * as React from "react";

/* Back-in-stock capture -- replaces the dead-end "Backorder" state with the
   highest-intent email flow there is (~6.7% conversion per Klaviyo data). */
export function NotifyMe({ skuId, compact = false }: { skuId: string; compact?: boolean }) {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) {
      setState("error");
      return;
    }
    setState("busy");
    try {
      const res = await fetch("/api/notify-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, skuId }),
      });
      const data = await res.json();
      setState(data.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className={`flex items-center gap-2 rounded-(--r-sm) bg-eco-tint/60 px-3 py-2 font-medium text-eco-ink ${compact ? "text-xs" : "text-sm"}`}>
        <Check size={compact ? 14 : 16} className="shrink-0" />
        We&apos;ll email you the moment it&apos;s back.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="w-full">
      {!compact && (
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink-1">
          <BellRing size={15} className="text-copper" />
          On backorder, get one email when it lands in Newark.
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
          placeholder="you@email.com"
          aria-label="Email for restock alert"
          aria-invalid={state === "error" ? true : undefined}
          className={`min-w-0 flex-1 rounded-(--r-sm) border bg-control-bg px-3 text-sm text-ink-1 placeholder:text-ink-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 ${
            state === "error" ? "border-danger" : "border-control-border"
          } ${compact ? "h-9" : "h-11"}`}
        />
        <button
          type="submit"
          disabled={state === "busy"}
          data-conversion-hook="notify-me-submit"
          className={`shrink-0 rounded-(--r-sm) bg-brand px-3.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-50 ${compact ? "h-9 text-xs" : "h-11"}`}
        >
          {state === "busy" ? "Saving…" : "Notify me"}
        </button>
      </div>
      {state === "error" && (
        <p className="mt-1.5 text-xs font-medium text-danger">Enter a valid email address.</p>
      )}
    </form>
  );
}
