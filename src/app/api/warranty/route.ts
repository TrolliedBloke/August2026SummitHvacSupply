import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { submitWarrantyClaim, WarrantyUnavailableError } from "@/lib/backend/warranty";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { fieldErrorsFrom } from "@/lib/forms/result";

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "warranty"), 5, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many claims from this connection. Call the counter." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const receipt = await submitWarrantyClaim(await readJsonBody(request, 32_000));
    return NextResponse.json({ ok: true, ...receipt }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    if (error instanceof BodyTooLargeError || error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "That request couldn't be read." }, { status: 400 });
    if (error instanceof WarrantyUnavailableError) return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    console.error("[api/warranty] failed", error);
    return NextResponse.json({ ok: false, error: "We couldn't record the claim. Call the counter and we'll take it by phone." }, { status: 500 });
  }
}
