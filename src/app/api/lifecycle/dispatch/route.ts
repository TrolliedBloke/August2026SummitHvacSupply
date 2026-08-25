import { NextResponse } from "next/server";
import { dispatchAbandonedCarts, dispatchBackInStock, dispatchReviewRequests } from "@/lib/backend/lifecycle";
import { cleanupExpiredCheckouts } from "@/lib/backend/checkout";

/**
 * Runs both lifecycle flows. Vercel cron hits GET hourly (vercel.json).
 * POST supports { advanceMinutes } so the abandoned-cart sequence can be
 * exercised end-to-end in dev without waiting 72 hours, and { advanceDays }
 * so the day-14 review request can be exercised without waiting two weeks.
 * If CRON_SECRET is set, requests must carry it (Vercel sends it as a Bearer
 * token on cron invocations automatically).
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
  const [stock, carts, reviews, expiredCheckouts] = await Promise.all([
    dispatchBackInStock(),
    dispatchAbandonedCarts(advanceMinutes),
    dispatchReviewRequests(advanceDays),
    cleanupExpiredCheckouts(),
  ]);
  return {
    ok: true,
    backInStockSent: stock.sent,
    cartEmailsSent: carts.sent,
    reviewRequestsSent: reviews.sent,
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
  const advance = Number(body?.advanceMinutes) || 0;
  const advanceDays = Number(body?.advanceDays) || 0;
  return NextResponse.json(await run(advance, advanceDays));
}
