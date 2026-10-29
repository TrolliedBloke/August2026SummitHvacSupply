import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/backend/auth";
import { exportAudience } from "@/lib/backend/audiences";
import { AUDIENCE_SEGMENTS } from "@/lib/audiences";

export async function POST(request: Request) {
  await requireStaff("/admin/audiences");
  // Unlike Server Actions, route handlers need their own cross-origin mutation guard.
  if (request.headers.get("origin") !== new URL(request.url).origin) return new NextResponse("Invalid origin", { status: 403 });
  const parsed = z.enum(AUDIENCE_SEGMENTS).safeParse((await request.formData()).get("segment"));
  if (!parsed.success) return new NextResponse("Invalid segment", { status: 400 });
  try {
    const csv = await exportAudience(parsed.data);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="summit-${parsed.data}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("Export unavailable. Return to Ad audiences to check consent counts and gates.", { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
