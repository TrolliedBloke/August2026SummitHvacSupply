import { NextResponse } from "next/server";
import { dispatchAbandonedCarts, dispatchBackInStock } from "@/lib/backend/lifecycle";

/**
 * Runs both lifecycle flows. Vercel cron hits GET hourly (vercel.json).
 * POST supports { advanceMinutes } so the abandoned-cart sequence can be
 * exercised end-to-end in dev without waiting 72 hours.
 * If CRON_SECRET is set, requests must carry it (Vercel sends it as a Bearer
 * token on cron invocations automatically).
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(advanceMinutes = 0) {
  const [stock, carts] = await Promise.all([
    dispatchBackInStock(),
    dispatchAbandonedCarts(advanceMinutes),
  ]);
  return { ok: true, backInStockSent: stock.sent, cartEmailsSent: carts.sent };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const advance = Number(body?.advanceMinutes) || 0;
  return NextResponse.json(await run(advance));
}
