import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";

/**
 * Lightweight first-party analytics ("never CVR alone"). Supabase-backed with
 * an in-memory fallback so the admin card works pre-migration. Best-effort:
 * analytics must never break a user-facing request.
 */

type MemEvent = { name: string; page: string | null; metadata: Record<string, unknown> | null; at: number };
const memEvents: MemEvent[] = [];

const NAME_RE = /^[a-z0-9_-]{2,48}$/;

export async function recordEvent(
  name: string,
  page?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  if (!NAME_RE.test(name)) return;
  const supabase = createServiceRoleSupabaseClient();
  let stored = false;
  if (supabase) {
    const { error } = await supabase
      .from("site_events")
      .insert({ name, page: page ?? null, metadata: metadata ?? null });
    if (error) console.warn("site_events insert failed (run migration 007?):", error.message);
    else stored = true;
  }
  if (!stored) {
    memEvents.push({ name, page: page ?? null, metadata: metadata ?? null, at: Date.now() });
    if (memEvents.length > 1000) memEvents.splice(0, memEvents.length - 1000);
  }
}

export type EventSummary = {
  counts: Array<{ name: string; count: number }>;
  zeroResultQueries: string[];
};

/** Last-30-days rollup for the admin metrics card. */
export async function getEventSummary(): Promise<EventSummary> {
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("site_events")
      .select("name, metadata")
      .gte("created_at", since)
      .limit(5000);
    if (!error && data) {
      return summarize(
        data.map((row) => ({ name: row.name, metadata: row.metadata as Record<string, unknown> | null }))
      );
    }
  }
  return summarize(memEvents);
}

function summarize(
  events: Array<{ name: string; metadata: Record<string, unknown> | null }>
): EventSummary {
  const counts = new Map<string, number>();
  const zero: string[] = [];
  for (const event of events) {
    counts.set(event.name, (counts.get(event.name) ?? 0) + 1);
    if (event.name === "search_zero_results" && typeof event.metadata?.q === "string") {
      zero.push(event.metadata.q);
    }
  }
  return {
    counts: Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    zeroResultQueries: Array.from(new Set(zero)).slice(-20).reverse(),
  };
}
