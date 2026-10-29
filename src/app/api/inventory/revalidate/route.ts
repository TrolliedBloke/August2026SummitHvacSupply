import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { INVENTORY_TAG } from "@/lib/storefront/live-inventory";
import { cronAuthorized } from "@/lib/backend/cron-auth";

/**
 * Drops the cached inventory map once new counts land in catalog_products.
 *
 * Without it the cached map lives out its 60-second TTL before new counts
 * appear. Anything that writes counts can POST here afterwards to collapse that
 * delay to nothing -- it is a cache-invalidation hook, not tied to any
 * particular source.
 *
 * Authorization matches the lifecycle dispatcher, including its fail-closed
 * default: outside development, no CRON_SECRET means no caller is trusted.
 * Cache invalidation is cheap for us and cheap to abuse -- an unauthenticated
 * caller could hammer it and force a database read on every request.
 */
function authorized(request: Request): boolean {
  return cronAuthorized(request);
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
