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
