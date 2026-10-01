import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ReturnRejectedError, startReturn } from "@/lib/backend/returns";

/** Start a return from an authenticated order line. */
export async function POST(request: Request) {
  try {
    const result = await startReturn(await request.json());
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ReturnRejectedError) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the return details." }, { status: 400 });
    // requireUser redirects by throwing; let Next handle it.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    console.error("[api/returns] failed", error);
    return NextResponse.json({ ok: false, error: "The return could not be started. Call the counter." }, { status: 500 });
  }
}
