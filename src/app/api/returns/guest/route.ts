import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ReturnRejectedError, startGuestReturn } from "@/lib/backend/returns";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";

/** Start a return from a signed guest link (the token scopes it to one order). */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "guest-return"), 10, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again in a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  const body = (await request.json().catch(() => null)) as ({ token?: unknown } & Record<string, unknown>) | null;
  const token = typeof body?.token === "string" ? body.token.slice(0, 1000) : "";
  try {
    const result = await startGuestReturn(token, body);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ReturnRejectedError) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the return details." }, { status: 400 });
    console.error("[api/returns/guest] failed", error);
    return NextResponse.json({ ok: false, error: "The return could not be started. Call the counter." }, { status: 500 });
  }
}
