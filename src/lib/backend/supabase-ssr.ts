import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auth-aware Supabase clients (cookie-backed sessions via @supabase/ssr).
 *
 * Use these for anything that must run AS THE LOGGED-IN USER so that Row Level
 * Security applies with their identity. Contrast with `./supabase.ts`
 * `createServerSupabaseClient`, which uses the service-role key and bypasses RLS
 * (only for trusted server jobs like webhooks).
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseAuthEnv(): boolean {
  return Boolean(URL && PUBLIC_KEY);
}

/**
 * Whether staff-only surfaces may render WITHOUT a verified staff session.
 *
 * Absent auth env used to imply "local demo, let it through", which meant a
 * missing or misspelled variable in a production deploy silently published the
 * operations dashboard. Opting out of the gate is now explicit and refuses to
 * work in production regardless of how the env is set.
 */
export function allowUnauthenticatedAdmin(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_UNAUTHENTICATED_ADMIN === "true"
  );
}

/** Browser client — for client components (login form, etc.). */
export function createClientSupabase(): SupabaseClient | null {
  if (!URL || !PUBLIC_KEY) return null;
  return createBrowserClient(URL, PUBLIC_KEY);
}

/**
 * Server client bound to the request cookies. Reads/writes the session so RLS
 * runs as the authenticated user. Call inside Server Components, Route Handlers,
 * and Server Actions.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  if (!URL || !PUBLIC_KEY) return null;
  const cookieStore = await cookies();
  return createServerClient(URL, PUBLIC_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // `set` throws in Server Components (read-only cookies). The
          // middleware refreshes the session, so this is safe to ignore here.
        }
      },
    },
  });
}
