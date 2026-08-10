import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createContactRequest } from "@/lib/backend/services";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await createContactRequest(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // Log the real cause server-side; never return it. Provider and
    // Postgres messages carry table, column and constraint names.
    console.error("[api/contact-requests] failed", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid contact request", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Contact request failed" }, { status: 500 });
  }
}
