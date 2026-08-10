import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createDealerApplication } from "@/lib/backend/services";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await createDealerApplication(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // Log the real cause server-side; never return it. Provider and
    // Postgres messages carry table, column and constraint names.
    console.error("[api/dealer-applications] failed", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid dealer application", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Dealer application failed" }, { status: 500 });
  }
}
