import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createHomeownerRequest } from "@/lib/backend/homeowner";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { fieldErrorsFrom } from "@/lib/forms/result";

/** Typed homeowner requests. Same error contract as every public form (lib/forms/result.ts). */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "homeowner-request"), 5, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const receipt = await createHomeownerRequest(await readJsonBody(request, BODY_LIMITS.form));
    return NextResponse.json({ ok: true, ...receipt });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    console.error("[api/homeowner-requests] failed", error);
    return NextResponse.json({ ok: false, error: "We could not send your request. Your answers are still here -- try again, or call the counter." }, { status: 500 });
  }
}
