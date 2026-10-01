import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase-ssr";
import type { PersonaRole } from "./types";

export type SessionProfile = {
  userId: string;
  email: string;
  name: string;
  role: PersonaRole;
  accountId: string | null;
};

/**
 * Returns the current user's profile (id, role, account) or null if signed out.
 * Reads `user_profiles` as the authenticated user -- RLS allows reading self.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, name, email, account_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as PersonaRole,
    accountId: profile.account_id,
  };
}

/** Hard gate for staff-only pages. Redirects unauthenticated/non-staff users. */
export async function requireStaff(nextPath = "/admin"): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect(`/portal/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (profile.role !== "staff") {
    redirect("/portal");
  }
  return profile;
}

/**
 * Gate for any signed-in user (portal). Guests go to login; a signed-in person
 * without a usable profile goes to /portal/status, which explains why --
 * sending them to login again was a loop.
 */
export async function requireUser(nextPath = "/portal"): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) {
    const { resolvePortalAccess } = await import("./session-access");
    const access = await resolvePortalAccess();
    if (access.kind === "signedOut") redirect(`/portal/login?next=${encodeURIComponent(nextPath)}`);
    redirect("/portal/status");
  }
  return profile;
}
