import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createQuoteRequest } from "@/lib/backend/services";

const requests = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const entry = requests.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    requests.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > 8;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (isRateLimited(ip)) return NextResponse.json({ ok: false, error: "Too many quote requests. Please wait a minute." }, { status: 429 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 50_000) return NextResponse.json({ ok: false, error: "Quote request is too large." }, { status: 413 });
  try {
    const payload = await request.json();
    const result = await createQuoteRequest(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid quote request", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Quote request failed" }, { status: 500 });
  }
}
