import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { recordAdSharingOptOut } from "@/lib/backend/consent";
import { recordEvent } from "@/lib/backend/events";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { AD_COOKIE_MAX_AGE_SECONDS, AD_CONSENT_COOKIE, AD_OPT_OUT_COOKIE } from "@/lib/privacy-cookies";
import { fieldErrorsFrom } from "@/lib/forms/result";
import { finderSessionIdFromCookie, getFinderSession } from "@/lib/backend/finder";
import { getSessionProfile } from "@/lib/backend/auth";

/**
 * "Do Not Sell or Share My Personal Information". Always sets the browser
 * opt-out cookie; with an email, also records the opt-out against that address
 * so it is honored in any list Summit holds, on any device.
 */
const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email("Enter an email address like you@example.com, or leave it blank.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "privacy-opt-out"), 10, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const body = schema.parse(await readJsonBody(request, BODY_LIMITS.tiny));
    const sessionId = await finderSessionIdFromCookie();
    const [session, profile] = await Promise.all([
      sessionId ? getFinderSession(sessionId) : null,
      getSessionProfile(),
    ]);
    const emails = [...new Set([body.email, session?.email, profile?.email].filter((email): email is string => Boolean(email)))];
    for (const email of emails) await recordAdSharingOptOut(email);
    const jar = await cookies();
    const options = { sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: AD_COOKIE_MAX_AGE_SECONDS };
    jar.set(AD_OPT_OUT_COOKIE, "1", options);
    jar.set(AD_CONSENT_COOKIE, "denied", options);
    await recordEvent("privacy_opt_out", "/privacy/opt-out", { withEmail: Boolean(body.email) });
    return NextResponse.json({ ok: true, withEmail: Boolean(body.email) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted field.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    console.error("[api/privacy/opt-out] failed", error);
    return NextResponse.json({ ok: false, error: "We could not record the request. Email or call us and we will do it by hand." }, { status: 500 });
  }
}
