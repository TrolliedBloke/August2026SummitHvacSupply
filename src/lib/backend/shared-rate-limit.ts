import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { rateLimit } from "./rate-limit";

/**
 * A rate limit every server instance shares (public.take_rate_limit,
 * migration 046), for endpoints where each call costs money. When the
 * database can't be reached it falls back to the in-process limiter rather
 * than failing open.
 */
export async function takeSharedRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = createServiceRoleSupabaseClient();
  if (db) {
    const { data, error } = await db.rpc("take_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (!error && typeof data === "boolean") return data;
  }
  return rateLimit(key, limit, windowSeconds).allowed;
}
