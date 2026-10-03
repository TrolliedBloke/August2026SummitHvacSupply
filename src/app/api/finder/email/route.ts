import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { finderSessionIdFromCookie, FinderSessionMissing, sendShortlist } from "@/lib/backend/finder";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { fieldErrorsFrom } from "@/lib/forms/result";

/**
 * "Email me my shortlist", offered after results are shown -- never in front
 * of them. The message is built from the stored session, so the only thing
 * the caller chooses is the address. Marketing is a separate, unchecked box.
 */
const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter an email address like you@example.com."),
  marketingOptIn: z.boolean().default(false),
  adSharingOptOut: z.boolean().default(false),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "finder-email"), 5, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const body = schema.parse(await readJsonBody(request, BODY_LIMITS.tiny));
    const sessionId = await finderSessionIdFromCookie();
    if (!sessionId) throw new FinderSessionMissing();
    const headers = new Headers(request.headers);
    if (body.adSharingOptOut) headers.set("sec-gpc", "1");
    const receipt = await sendShortlist(sessionId, body.email, body.marketingOptIn, headers);
    return NextResponse.json({ ok: true, ...receipt });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted field.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    if (error instanceof FinderSessionMissing) return NextResponse.json({ ok: false, error: "Your results expired. Run the finder again to send them." }, { status: 404 });
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    console.error("[api/finder/email] failed", error);
    return NextResponse.json({ ok: false, error: "We could not send the email. Your results are still on this page." }, { status: 500 });
  }
}
