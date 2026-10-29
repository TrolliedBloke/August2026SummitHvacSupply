import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createContactRequest } from "@/lib/backend/contact";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { fieldErrorsFrom } from "@/lib/forms/result";

/**
 * Public and unauthenticated: it writes a row through a service-role path and
 * notifies staff. That makes it both a database-write amplifier and a way to
 * put attacker-chosen text in front of the counter, so it is rate limited and
 * size bounded like cart-snapshots and reviews already are.
 *
 * 6 per 10 minutes: a person correcting a typo and resubmitting stays well
 * inside it; a script does not. Replays of the same client request id return
 * the stored receipt and do not create a second request.
 *
 * Errors follow lib/forms/result.ts: 400 with `fieldErrors` keyed by the shared
 * schema, 429 with Retry-After, 500 with a fixed message.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "contact-request"), 6, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests.", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const payload = await readJsonBody(request, BODY_LIMITS.form);
    const receipt = await createContactRequest(payload);
    return NextResponse.json({ ok: true, ...receipt });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ ok: false, error: "Message too large", fieldErrors: { message: "Keep the message under 5,000 characters." } }, { status: 413 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    }
    if (error instanceof BodyNotJsonError) {
      return NextResponse.json({ ok: false, error: "Invalid contact request" }, { status: 400 });
    }
    // Log the real cause server-side; never return it. Provider and
    // Postgres messages carry table, column and constraint names.
    console.error("[api/contact-requests] failed", error);
    return NextResponse.json({ ok: false, error: "We could not send your message. Your entries are still here -- try again, or call the counter." }, { status: 500 });
  }
}
