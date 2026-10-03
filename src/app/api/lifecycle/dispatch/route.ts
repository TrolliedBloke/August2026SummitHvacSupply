import { NextResponse } from "next/server";
import {
  dispatchAbandonedCarts,
  dispatchBackInStock,
  dispatchCategoryAlerts,
  dispatchMaintenanceEmails,
  dispatchPlanningSeries,
  dispatchReviewRequests,
  dispatchWarrantyReminders,
} from "@/lib/backend/lifecycle";
import { cleanupExpiredCheckouts } from "@/lib/backend/checkout";

/**
 * Runs every lifecycle flow. pg_cron calls GET hourly at seven past the hour
 * (migration 033, private.invoke_site_route) with CRON_SECRET as a bearer
 * token. The Vercel cron that used to do this was removed in d52a1fb so
 * deploys pass on the Hobby plan; until 033 nothing called this route at all.
 *
 * POST supports { advanceMinutes } so the abandoned-cart sequence can be
 * exercised end-to-end in dev without waiting 72 hours, and { advanceDays }
 * for the day-based flows (review request, planning series, post-purchase).
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed. This route sends real email to real customers -- back-in-stock
  // alerts and abandoned-cart sequences -- and releases checkout reservations.
  // Returning true when CRON_SECRET is absent meant that in any deployment where
  // the variable was forgotten, an anonymous GET could send the entire mailing.
  // Outside development, no secret means no dispatch.
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(advanceMinutes = 0, advanceDays = 0) {
  const [stock, categoryAlerts, carts, reviews, planning, warranty, maintenance, expiredCheckouts] = await Promise.all([
    dispatchBackInStock(),
    dispatchCategoryAlerts(),
    dispatchAbandonedCarts(advanceMinutes),
    dispatchReviewRequests(advanceDays),
    dispatchPlanningSeries(advanceDays),
    dispatchWarrantyReminders(advanceDays),
    dispatchMaintenanceEmails(advanceDays),
    cleanupExpiredCheckouts(),
  ]);
  return {
    ok: true,
    backInStockSent: stock.sent,
    categoryAlertsSent: categoryAlerts.sent,
    cartEmailsSent: carts.sent,
    reviewRequestsSent: reviews.sent,
    planningEmailsSent: planning.sent,
    warrantyRemindersSent: warranty.sent,
    maintenanceEmailsSent: maintenance.sent,
    expiredCheckouts,
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const advance = process.env.NODE_ENV === "production" ? 0 : Math.max(0, Math.min(43200, Number(body?.advanceMinutes) || 0));
  const advanceDays = process.env.NODE_ENV === "production" ? 0 : Math.max(0, Math.min(60, Number(body?.advanceDays) || 0));
  return NextResponse.json(await run(advance, advanceDays));
}
