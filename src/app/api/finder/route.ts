import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { rememberFinderSession, runFinder } from "@/lib/backend/finder";
import { getSessionProfile } from "@/lib/backend/auth";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { tradeTier } from "@/lib/trade-tier";

/**
 * Finish a finder run: validate the answers, compute results against the live
 * catalog, store the session, and hand the browser a signed cookie for it.
 * The response never carries a price; account pricing stays on product pages
 * for signed-in trade accounts.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "finder"), 20, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const { id, segment, result } = await runFinder(await readJsonBody(request, BODY_LIMITS.tiny));
    await rememberFinderSession(id);
    const profile = await getSessionProfile().catch(() => null);
    const tier = tradeTier({ profile, finderPath: result.path });
    return NextResponse.json({ ok: true, segment, tier, result });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Some answers were not recognized. Start the finder again." }, { status: 400 });
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    console.error("[api/finder] failed", error);
    return NextResponse.json({ ok: false, error: "We could not load your results. Try again, or call the counter." }, { status: 500 });
  }
}
