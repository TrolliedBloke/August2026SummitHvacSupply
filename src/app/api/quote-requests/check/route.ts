import { NextResponse } from "next/server";
import { z } from "zod";
import { checkQuoteLines, compatibilityNotes } from "@/lib/backend/quote";
import { quoteLineSchema, QUOTE_MAX_LINES } from "@/lib/forms/quote";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";

/** Preflight for the quote page: canonical lines, merges, and verified-only compatibility notes. */
const bodySchema = z.object({ lines: z.array(quoteLineSchema).max(QUOTE_MAX_LINES) });

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "quote-check"), 60, 600);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid lines" }, { status: 400 });
  const { lines, merged } = checkQuoteLines(parsed.data.lines);
  return NextResponse.json({ ok: true, lines, compatibility: compatibilityNotes(merged.map((line) => line.sku)) });
}
