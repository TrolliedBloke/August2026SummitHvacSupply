import { NextResponse } from "next/server";
import { saveCartSnapshot } from "@/lib/backend/lifecycle";

export async function POST(request: Request) {
  try {
    const { email, items } = await request.json();
    if (typeof email !== "string" || !Array.isArray(items)) {
      return NextResponse.json({ ok: false, error: "Email and items required" }, { status: 400 });
    }
    await saveCartSnapshot(email.trim().toLowerCase(), items);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Snapshot failed" },
      { status: 500 }
    );
  }
}
