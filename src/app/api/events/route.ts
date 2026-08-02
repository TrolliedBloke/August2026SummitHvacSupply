import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/backend/events";

export async function POST(request: Request) {
  try {
    const { name, page, metadata } = await request.json();
    if (typeof name !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await recordEvent(
      name,
      typeof page === "string" ? page.slice(0, 200) : null,
      metadata && typeof metadata === "object" ? metadata : null
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
