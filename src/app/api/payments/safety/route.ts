import { NextResponse } from "next/server";
import { runPaymentSafetyJobs } from "@/lib/backend/payments";
import { cronAuthorized } from "@/lib/backend/cron-auth";

/**
 * Money-safety jobs (docs/LIABILITY-REMEDIATION-PLAN.md, phase 1), every 15
 * minutes from pg_cron (migration 041) with CRON_SECRET as a bearer token:
 * stale checkout expiry, Stripe reconciliation, authorization deadlines,
 * confirmation-email retries and alerts for held orders.
 *
 * Separate from /api/lifecycle/dispatch on purpose: that route also sends
 * marketing email, and must be able to stay off while this one runs.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Fails closed outside development: this route moves card holds.
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const results = await runPaymentSafetyJobs();
  return NextResponse.json({ ok: true, results });
}
