import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createHomeownerRequest } from "@/lib/backend/homeowner";
import { finderSessionIdFromCookie, linkHomeownerRequest } from "@/lib/backend/finder";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { fieldErrorsFrom } from "@/lib/forms/result";
import { stopPlanningSeries } from "@/lib/backend/lifecycle";

/** Typed homeowner requests. Same error contract as every public form (lib/forms/result.ts). */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "homeowner-request"), 5, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const body = await readJsonBody<{ email?: unknown }>(request, BODY_LIMITS.form);
    const receipt = await createHomeownerRequest(body);
    if (typeof body.email === "string") await stopPlanningSeries(body.email.trim().toLowerCase(), "requested_installer");
    // A request that came out of the system finder: link the two through the
    // finder's signed cookie, stop the planning series, count it in the funnel.
    // Best-effort -- the request itself has already been recorded.
    if (!receipt.duplicate && typeof body.email === "string") {
      const finderSession = await finderSessionIdFromCookie();
      if (finderSession) await linkHomeownerRequest(finderSession, receipt.id, body.email).catch((error) => console.warn("[api/homeowner-requests] finder link failed", error));
    }
    return NextResponse.json({ ok: true, ...receipt });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    console.error("[api/homeowner-requests] failed", error);
    return NextResponse.json({ ok: false, error: "We could not send your request. Your answers are still here -- try again, or call the counter." }, { status: 500 });
  }
}
