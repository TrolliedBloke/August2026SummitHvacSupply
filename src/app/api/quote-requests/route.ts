import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { submitQuoteDraft } from "@/lib/backend/quote";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { fieldErrorsFrom } from "@/lib/forms/result";

/**
 * Typed quote requests. 400 responses carry `fieldErrors` for the form and,
 * when lines were the problem, `lines` with each line's outcome so the page
 * can show exactly which ones to fix.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "quote-request"), 8, 60);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many quote requests. Please wait a minute." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const receipt = await submitQuoteDraft(await readJsonBody(request, 64_000));
    return NextResponse.json({ ok: true, ...receipt });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    const lineErrors = (error as { lineErrors?: unknown }).lineErrors;
    if (lineErrors) return NextResponse.json({ ok: false, error: "Some products need attention.", fieldErrors: { lines: "Fix or remove the highlighted products." }, lines: lineErrors }, { status: 400 });
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Quote request is too large." }, { status: 413 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid quote request" }, { status: 400 });
    console.error("[api/quote-requests] failed", error);
    return NextResponse.json({ ok: false, error: "We could not send the request. Your entries are still here -- try again." }, { status: 500 });
  }
}
