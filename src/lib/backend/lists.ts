import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";

/**
 * Saved lists ("truck stock") for signed-in accounts. Supabase when the 007
 * migration is applied; in-memory fallback otherwise, same convention as the
 * rest of lib/backend. Items are catalog snapshots — checkout reprices
 * server-side, so a stale unitPrice here is cosmetic, never charged.
 */

export type SavedListItem = {
  skuId: string;
  sku: string;
  modelNumber: string;
  title: string;
  image: string;
  available: number;
  unitPrice: number;
  qty: number;
};

export type SavedList = {
  id: string;
  name: string;
  items: SavedListItem[];
  createdAt: string;
};

const memLists = new Map<string, SavedList[]>();

export async function getSavedLists(userId: string): Promise<SavedList[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("saved_lists")
      .select("id, name, items, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        items: row.items as SavedListItem[],
        createdAt: row.created_at,
      }));
    }
    if (error) console.warn("saved_lists select failed (run migration 007?):", error.message);
  }
  return memLists.get(userId) ?? [];
}

export async function createSavedList(
  userId: string,
  name: string,
  items: SavedListItem[]
): Promise<SavedList> {
  const clean = name.trim().slice(0, 60) || "Untitled list";
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("saved_lists")
      .insert({ user_id: userId, name: clean, items })
      .select("id, name, items, created_at")
      .single();
    if (!error && data) {
      return { id: data.id, name: data.name, items: data.items as SavedListItem[], createdAt: data.created_at };
    }
    if (error) console.warn("saved_lists insert failed (run migration 007?):", error.message);
  }
  const list: SavedList = {
    id: `list-${Date.now()}`,
    name: clean,
    items,
    createdAt: new Date().toISOString(),
  };
  memLists.set(userId, [list, ...(memLists.get(userId) ?? [])]);
  return list;
}

export async function deleteSavedList(userId: string, listId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    await supabase.from("saved_lists").delete().eq("id", listId).eq("user_id", userId);
  }
  memLists.set(userId, (memLists.get(userId) ?? []).filter((list) => list.id !== listId));
}
