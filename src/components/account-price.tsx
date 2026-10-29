"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import * as React from "react";
import { Notice } from "./state";
import type { ProjectedLine } from "@/lib/commerce/projection";
import type { NavAccount } from "@/lib/access-state";

/**
 * Account pricing on the product page, for an approved trade session only.
 *
 * The page itself is static and public, so it only ever carries the list
 * price. This island asks the private projection endpoint -- after sign-in,
 * and again when the projection expires -- and renders the account's price
 * with its provenance, or says plainly that it could not be confirmed. It
 * never relabels the list price as a trade price.
 */
function hasSessionCookie() {
  return typeof document !== "undefined" && /sb-[^=]+-auth-token/.test(document.cookie);
}

type Result =
  | { status: "idle" }
  | { status: "ready"; nav: NavAccount; line: ProjectedLine; expiresAt: string }
  | { status: "error" };

export function AccountPrice({ skuId }: { skuId: string }) {
  const [result, setResult] = React.useState<Result>({ status: "idle" });
  // Bumped to re-request: Retry, and the projection's own expiry.
  const [attempt, setAttempt] = React.useState(0);
  const load = React.useCallback(() => setAttempt((value) => value + 1), []);

  React.useEffect(() => {
    if (!hasSessionCookie()) return;
    let cancelled = false;
    fetch("/api/commerce/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skuIds: [skuId] }),
      cache: "no-store",
    })
      .then(async (response) => ({ ok: response.ok, payload: await response.json() }))
      .then(({ ok, payload }) => {
        if (cancelled) return;
        if (!ok || !payload.ok) throw new Error();
        setResult({ status: "ready", nav: payload.nav, line: payload.lines[0], expiresAt: payload.expiresAt });
      })
      .catch(() => {
        if (!cancelled) setResult({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [skuId, attempt]);

  // Refresh when the projection expires, so an open tab cannot keep showing a
  // superseded account price.
  React.useEffect(() => {
    if (result.status !== "ready") return;
    const delay = Math.max(5_000, new Date(result.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(load, delay);
    return () => window.clearTimeout(timer);
  }, [result, load]);

  if (result.status === "error") {
    return (
      <Notice
        tone="warning"
        className="mt-4"
        title="Your account price could not be confirmed"
        action={
          <button type="button" onClick={load} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-1 underline underline-offset-4">
            <RotateCcw size={14} aria-hidden="true" /> Retry
          </button>
        }
      >
        The list price above is not your account price. Retry, or request a quote and the counter will confirm it.
      </Notice>
    );
  }
  if (result.status !== "ready" || result.nav.variant !== "tradeApproved") return null;
  const { line } = result;

  if (line.kind === "pricingUnavailable") {
    return (
      <Notice
        tone="warning"
        className="mt-4"
        title={line.statusLabel}
        action={<Link href="/quote" className="inline-flex min-h-11 items-center text-sm font-medium text-ink-1 underline underline-offset-4">Request a quote</Link>}
      >
        {line.statusDetail}
      </Notice>
    );
  }
  if (!line.priceText || !line.priceQualifier?.startsWith("Your account price")) return null;
  return (
    <div className="mt-4 rounded-(--r-sm) border border-state-success-line bg-state-success px-4 py-3" role="status">
      <p className="text-sm text-ink-2">{line.priceQualifier}</p>
      <p className="part-number mt-0.5 text-2xl font-semibold text-ink-1">{line.priceText}</p>
      <p className="mt-1 text-xs text-ink-3">
        {result.nav.accountName} · Tax on invoice · Confirmed again at checkout
      </p>
    </div>
  );
}
