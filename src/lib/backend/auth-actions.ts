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

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/portal/login");
}
