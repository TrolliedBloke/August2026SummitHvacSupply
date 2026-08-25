import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { INVENTORY_TAG } from "@/lib/storefront/live-inventory";

/**
 * Drops the cached inventory map after the QuickBooks sync writes new counts.
 *
 * Without this the site still picks changes up on its own, but the two delays
 * compound: up to 15 minutes waiting for the next sync, then up to another 60
 * seconds for the cache entry to expire. The sync pings this on a run that
 * actually changed something, which collapses the second delay to nothing.
 *
 * Authorization matches the lifecycle dispatcher, including its fail-closed
 * default: outside development, no CRON_SECRET means no caller is trusted.
 * Cache invalidation is cheap for us and cheap to abuse -- an unauthenticated
 * caller could hammer it and force a database read on every request.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });

  // "max" is the recommended profile and gives stale-while-revalidate: the tag
  // is marked stale, the next visitor is served the old count while the fresh
  // one loads behind them, and the visitor after that sees the new number.
  // That one-request lag is immaterial against a sync that runs every fifteen
  // minutes, and it keeps a burst of traffic from stampeding the database.
  //
  // updateTag() would expire the entry outright, but it is callable only from
  // Server Actions -- not from a route handler like this one, which is what the
  // Edge Function can reach over HTTP. The single-argument form of
  // revalidateTag is deprecated in Next 16.
  revalidateTag(INVENTORY_TAG, "max");
  return NextResponse.json({ ok: true, revalidated: INVENTORY_TAG });
}
