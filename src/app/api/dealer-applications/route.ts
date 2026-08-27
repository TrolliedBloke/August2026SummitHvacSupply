import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createDealerApplication } from "@/lib/backend/services";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";

/**
 * Public and unauthenticated, writing through a service-role path. Applying for
 * a trade account is a once-per-business action, so the limit is tighter than
 * the contact form: 4 per 10 minutes.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "dealer-application"), 4, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const payload = await readJsonBody(request, BODY_LIMITS.application);
    const result = await createDealerApplication(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ ok: false, error: "Application too large" }, { status: 413 });
    }
    if (error instanceof BodyNotJsonError || error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid dealer application" }, { status: 400 });
    }
    // Log the real cause server-side; never return it. Provider and
    // Postgres messages carry table, column and constraint names.
    console.error("[api/dealer-applications] failed", error);
    return NextResponse.json({ ok: false, error: "Dealer application failed" }, { status: 500 });
  }
}
