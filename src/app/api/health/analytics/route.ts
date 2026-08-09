import { NextResponse } from "next/server";
import { analyticsPersistenceHealth } from "@/lib/backend/events";

export async function GET() {
  const health = await analyticsPersistenceHealth();
  return NextResponse.json(health, {
    status: health.healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
