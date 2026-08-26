import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createContactRequest } from "@/lib/backend/services";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";

/**
 * Public and unauthenticated: it writes a row through a service-role path and
 * notifies staff. That makes it both a database-write amplifier and a way to
 * put attacker-chosen text in front of the counter, so it is rate limited and
 * size bounded like cart-snapshots and reviews already are.
 *
 * 6 per 10 minutes: a person correcting a typo and resubmitting stays well
 * inside it; a script does not.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "contact-request"), 6, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const payload = await readJsonBody(request, BODY_LIMITS.form);
    const result = await createContactRequest(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ ok: false, error: "Message too large" }, { status: 413 });
    }
    if (error instanceof BodyNotJsonError || error instanceof ZodError) {
      // Log the real cause server-side; never return it. Provider and
      // Postgres messages carry table, column and constraint names.
      return NextResponse.json({ ok: false, error: "Invalid contact request" }, { status: 400 });
    }
    console.error("[api/contact-requests] failed", error);
    return NextResponse.json({ ok: false, error: "Contact request failed" }, { status: 500 });
  }
}
