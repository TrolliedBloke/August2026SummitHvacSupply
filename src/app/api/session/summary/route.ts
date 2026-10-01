import { NextResponse } from "next/server";
import { resolvePortalAccess, toNavAccount } from "@/lib/backend/session-access";

/**
 * The header's account summary. Public pages are cached and shared, so they
 * render the account menu without session data; this private, uncacheable
 * endpoint fills it in for the one browser that asked. It returns names and a
 * price-tier label only -- never prices, account ids or another session's data.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const nav = toNavAccount(await resolvePortalAccess());
  return NextResponse.json({ ok: true, nav }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
