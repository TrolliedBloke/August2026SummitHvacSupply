"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The browser Supabase client, carrying the signed-in session from cookies.
 * Separate from src/lib/backend/supabase-ssr.ts, which imports next/headers
 * and so cannot be bundled for the browser. Null without public env (local
 * demo), so callers fall back gracefully.
 */
export function createBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
