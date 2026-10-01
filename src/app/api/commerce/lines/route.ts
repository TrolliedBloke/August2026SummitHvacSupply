import { NextResponse } from "next/server";
import { z } from "zod";
import { projectCommerceLines } from "@/lib/commerce/projection";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";

/**
 * Revalidates cart lines against the server: CommerceState, intent and price
 * as THIS session's account sees them. The drawer calls it on open and before
 * checkout; the response is private to the session and never cached.
 */
const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const bodySchema = z.object({ skuIds: z.array(z.string().min(1).max(120)).min(1).max(100) });

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "commerce-lines"), 120, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { ...PRIVATE, "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const body = bodySchema.safeParse(await readJsonBody(request, BODY_LIMITS.batch));
    if (!body.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400, headers: PRIVATE });
    const projection = await projectCommerceLines(body.data.skuIds);
    return NextResponse.json({ ok: true, ...projection }, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413, headers: PRIVATE });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400, headers: PRIVATE });
    console.error("[api/commerce/lines] failed", error);
    return NextResponse.json({ ok: false, error: "Could not confirm prices right now." }, { status: 503, headers: PRIVATE });
  }
}
