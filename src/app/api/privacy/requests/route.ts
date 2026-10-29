import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PrivacyRequestError, submitPrivacyRequest } from "@/lib/backend/privacy-requests";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { fieldErrorsFrom } from "@/lib/forms/result";

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "privacy-request"), 5, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests from this connection. Email or call us instead." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const receipt = await submitPrivacyRequest(await readJsonBody(request, 8_000));
    return NextResponse.json({ ok: true, ...receipt }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    if (error instanceof BodyTooLargeError || error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "That request couldn't be read." }, { status: 400 });
    if (error instanceof PrivacyRequestError) return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    console.error("[api/privacy/requests] failed", error);
    return NextResponse.json({ ok: false, error: "We couldn't record the request. Email or call us and we'll log it by hand." }, { status: 500 });
  }
}
