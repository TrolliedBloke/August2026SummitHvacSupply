import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/backend/auth";
import { createSavedList, deleteSavedList, getSavedLists, type SavedListItem } from "@/lib/backend/lists";

async function requireUser() {
  const profile = await getSessionProfile();
  if (!profile) return null;
  return profile;
}

export async function GET() {
  const profile = await requireUser();
  if (!profile) return NextResponse.json({ ok: false, error: "Sign in to use saved lists" }, { status: 401 });
  return NextResponse.json({ ok: true, lists: await getSavedLists(profile.userId) });
}

export async function POST(request: Request) {
  const profile = await requireUser();
  if (!profile) return NextResponse.json({ ok: false, error: "Sign in to use saved lists" }, { status: 401 });
  try {
    const { name, items } = await request.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: "Cart is empty" }, { status: 400 });
    }
    const clean = (items as SavedListItem[])
      .filter((i) => typeof i.skuId === "string" && typeof i.qty === "number" && i.qty > 0)
      .slice(0, 50);
    const list = await createSavedList(profile.userId, String(name ?? ""), clean);
    return NextResponse.json({ ok: true, list });
  } catch (error) {
    // Log the real cause server-side; never return it. Provider and
    // Postgres messages carry table, column and constraint names.
    console.error("[api/saved-lists] failed", error);
    return NextResponse.json(
      { ok: false, error: "Save failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const profile = await requireUser();
  if (!profile) return NextResponse.json({ ok: false, error: "Sign in to use saved lists" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await deleteSavedList(profile.userId, id);
  return NextResponse.json({ ok: true });
}
