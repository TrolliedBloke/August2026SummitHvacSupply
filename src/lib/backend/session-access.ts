/**
 * Who is signed in, and what they may access -- kept as separate questions.
 *
 * Authentication answers "who is this person" (a Supabase user). Access
 * answers "what may they do": a profile row, a role, a linked business
 * account, an application under review, a suspension. A valid sign-in with no
 * linked profile used to look exactly like a failed sign-in and bounced the
 * person back to /portal/login. Every state now has a name, and every surface
 * -- the portal router, the header account menu, account pricing -- projects
 * the same resolved value.
 *
 * Every read here is keyed by the authenticated user id or that user's own
 * email. Nothing is taken from client input.
 */

import { createServerSupabase } from "./supabase-ssr";
import { createServiceRoleSupabaseClient } from "./supabase";
import type { PersonaRole } from "./types";
import {
  classifyAccess,
  normalizeApplicationStatus,
  type ApplicationStatus,
  type BusinessAccount,
  type PortalAccess,
  type ResolvedProfile,
} from "@/lib/access-state";

export * from "@/lib/access-state";

async function latestApplication(email: string): Promise<ApplicationStatus | null> {
  const admin = createServiceRoleSupabaseClient();
  if (!admin) return null;
  const { data } = await admin
    .from("dealer_applications")
    .select("status, created_at")
    .ilike("email", email.trim())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return normalizeApplicationStatus((data as { status?: string } | null)?.status);
}

/** The signed-in person's access state, resolved server-side. */
export async function resolvePortalAccess(): Promise<PortalAccess> {
  const supabase = await createServerSupabase();
  if (!supabase) return { kind: "signedOut" };
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") return { kind: "unavailable" };
  if (!user || !user.email) return { kind: "signedOut" };

  const { data: row } = await supabase
    .from("user_profiles")
    .select("role, name, email, account_id")
    .eq("id", user.id)
    .maybeSingle();

  const admin = createServiceRoleSupabaseClient();
  let accessStatus: string | null = null;
  let account: BusinessAccount | null = null;
  if (row && admin) {
    // access_status arrives with migration 026; before it, every profile is active.
    const { data: status } = await admin.from("user_profiles").select("access_status").eq("id", user.id).maybeSingle();
    accessStatus = (status as { access_status?: string } | null)?.access_status ?? null;
    if (row.account_id) {
      const { data: accountRow } = await admin
        .from("accounts")
        .select("id, name, status, price_tier")
        .eq("id", row.account_id)
        .maybeSingle();
      if (accountRow) {
        account = {
          id: String(accountRow.id),
          name: String(accountRow.name),
          status: String(accountRow.status ?? "active"),
          priceTier: String(accountRow.price_tier ?? "standard"),
        };
      }
    }
  }

  const profile: (ResolvedProfile & { accessStatus: string | null }) | null = row
    ? {
        userId: user.id,
        email: String(row.email),
        name: String(row.name),
        role: row.role as PersonaRole,
        accountId: (row.account_id as string | null) ?? null,
        accessStatus,
      }
    : null;
  const application = profile && profile.role !== "homeowner" && account ? null : await latestApplication(user.email);
  return classifyAccess({ user: { id: user.id, email: user.email }, profile, account, application });
}

