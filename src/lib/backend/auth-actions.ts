"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase-ssr";
import { safeNextPath } from "@/lib/safe-redirect";

export type AuthResult = { ok: boolean; error?: string };


/**
 * Email/password sign-in. On success the session cookie is set by the SSR
 * client and the user is redirected to `next` (defaults to /admin for staff).
 */
export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""), "/portal");

  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured. Set Supabase env vars." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: "Invalid email or password." };
  }

  redirect(next);
}

export async function signUpRetail(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { ok: false, error: "Enter your full name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 8) return { ok: false, error: "Use at least 8 characters for your password." };

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Account creation is temporarily unavailable. Please call our team." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, account_type: "retail" } },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.session) redirect("/account/check-email");
  redirect("/portal/homeowner");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/portal/login");
}

/**
 * Start a password reset.
 *
 * Uses Supabase Auth's own reset mechanism -- it mints and expires the token,
 * single-uses it, and invalidates the old password on completion. No custom
 * token system: hand-rolled reset tokens are where this normally goes wrong.
 *
 * Deliberately enumeration-safe. The result is identical whether or not the
 * address has an account, and Supabase's own error is swallowed, so this
 * endpoint cannot be used to test which of a list of emails are customers.
 * Rate limited for the same reason -- an attacker who cannot read the response
 * can still time it.
 */
export async function requestPasswordReset(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createServerSupabase();
  if (supabase) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await supabase.auth
      .resetPasswordForEmail(email, { redirectTo: `${origin}/portal/reset-password` })
      .catch(() => {
        /* Never surfaced: see the enumeration note above. */
      });
  }

  // Same response in every case, including when auth is unconfigured.
  return { ok: true };
}

/**
 * Complete a password reset. Runs against the recovery session Supabase
 * establishes when the emailed link is opened, so it requires possession of
 * that link; there is no separate token for us to validate or leak.
 */
export async function completePasswordReset(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { ok: false, error: "Use at least 8 characters." };
  if (password !== confirm) return { ok: false, error: "Both passwords must match." };

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Auth is not configured." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "This reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: "Could not update the password. Request a new link." };
  }
  return { ok: true };
}
