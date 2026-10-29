import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { submitDealerApplication } from "@/lib/backend/dealer";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { fieldErrorsFrom } from "@/lib/forms/result";

/**
 * Public and unauthenticated, writing through a service-role path. Applying for
 * a trade account is a once-per-business action, so the limit is tighter than
 * the contact form: 4 per 10 minutes. Validation uses the same schema as the
 * form (lib/forms/dealer.ts), so a required field is required on both sides.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "dealer-application"), 4, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const receipt = await submitDealerApplication(await readJsonBody(request, BODY_LIMITS.application));
    return NextResponse.json({ ok: true, ...receipt });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Application too large" }, { status: 413 });
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid dealer application" }, { status: 400 });
    // Log the real cause server-side; never return it.
    console.error("[api/dealer-applications] failed", error);
    return NextResponse.json({ ok: false, error: "We could not submit the application. Your answers are saved on this device -- try again." }, { status: 500 });
  }
}
