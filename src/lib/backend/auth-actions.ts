"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase-ssr";
import { safeNextPath } from "@/lib/safe-redirect";
import { rateLimit } from "./rate-limit";
import { hashForLogs, signValue } from "./signed-cookie";
import { allowedNext, portalDestination, resolvePortalAccess } from "./session-access";
import { fieldErrorsFrom } from "@/lib/forms/result";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
  type AuthResult,
  type ResetField,
  type SignupField,
} from "@/lib/forms/auth";

/*
 * Auth server actions. Each returns a typed AuthResult and never passes a
 * provider (Supabase) message to the browser: provider errors are mapped to
 * fixed, account-safe copy, and anything unexpected is logged server-side with
 * hashed identifiers only.
 */

// "use server" modules may export only async functions; shared constants live
// in ./pending-signup.ts.
import { PENDING_SIGNUP_COOKIE, PENDING_SIGNUP_TTL_SECONDS, pendingSignupEmail, RESEND_COOLDOWN_SECONDS } from "./pending-signup";
/** Minimum time a reset request takes, so a known and an unknown address answer alike. */
const RESET_RESPONSE_FLOOR_MS = 700;

async function origin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

async function clientIp(): Promise<string> {
  const list = await headers();
  return (list.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
}

async function settle(started: number) {
  const elapsed = Date.now() - started;
  const wait = RESET_RESPONSE_FLOOR_MS - elapsed + Math.floor(Math.random() * 150);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

/**
 * Email/password sign-in. A wrong password and an unknown email get the same
 * response. After success the person's ACCESS state -- not just their role --
 * decides where they land, and `next` is honored only when that state may see
 * it. A valid sign-in never bounces back to this form.
 */
export async function signIn(_prev: AuthResult<"email" | "password">, formData: FormData): Promise<AuthResult<"email" | "password">> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""), "");

  const fieldErrors: Partial<Record<"email" | "password", string>> = {};
  if (!email) fieldErrors.email = "Enter your email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors, formError: null, values: { email } };

  const limit = rateLimit(`sign-in:${await clientIp()}`, 10, 600);
  if (!limit.allowed) {
    return { status: "error", fieldErrors: {}, formError: "Too many sign-in attempts. Wait a few minutes and try again.", values: { email }, retryAfterSeconds: limit.retryAfterSeconds };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { status: "error", fieldErrors: {}, formError: "Sign-in is unavailable right now. Call the counter and we will help.", values: { email } };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", fieldErrors: {}, formError: "Confirm your email first -- use the link we sent when you created the account.", values: { email } };
    }
    return { status: "error", fieldErrors: {}, formError: "That email and password do not match an account.", values: { email } };
  }

  const access = await resolvePortalAccess();
  redirect(allowedNext(access, next || null) ?? portalDestination(access));
}

/**
 * Retail signup. Validation runs on the shared schema; valid values come back
 * on failure (never the password). An address that already has an account
 * gets the same next step as a new one -- check your email -- so this form
 * cannot be used to learn who is a customer.
 */
export async function signUpRetail(_prev: AuthResult<SignupField>, formData: FormData): Promise<AuthResult<SignupField>> {
  const input = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { name: input.name.trim(), email: input.email.trim().toLowerCase() };
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom<SignupField>(parsed.error), formError: null, values };
  }

  const limit = rateLimit(`sign-up:${await clientIp()}`, 5, 600);
  if (!limit.allowed) {
    return { status: "error", fieldErrors: {}, formError: "Too many attempts from this connection. Wait a few minutes and try again.", values, retryAfterSeconds: limit.retryAfterSeconds };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { status: "error", fieldErrors: {}, formError: "Account creation is unavailable right now. Call the counter and we will set you up.", values };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name, account_type: "retail" },
      emailRedirectTo: `${await origin()}/auth/callback?next=/portal/homeowner`,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "Choose a stronger password -- avoid common words and reused passwords." }, formError: null, values };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { status: "error", fieldErrors: {}, formError: "We just sent an email to this address. Wait a minute before trying again.", values, retryAfterSeconds: RESEND_COOLDOWN_SECONDS };
    }
    if (error.code !== "user_already_exists" && error.code !== "email_exists") {
      console.error("[auth] signup failed", { code: error.code, email: hashForLogs(parsed.data.email) });
      return { status: "error", fieldErrors: {}, formError: "We could not create the account right now. Try again shortly.", values };
    }
    // An existing address falls through to the same check-email step.
  }

  if (data?.session) {
    const access = await resolvePortalAccess();
    redirect(portalDestination(access));
  }

  const jar = await cookies();
  jar.set(PENDING_SIGNUP_COOKIE, signValue(parsed.data.email, PENDING_SIGNUP_TTL_SECONDS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_SIGNUP_TTL_SECONDS,
  });
  redirect("/account/check-email");
}

/**
 * Resend the confirmation email. Throttled per connection and per address
 * (hashed), with a visible cooldown; the response is identical whether or not
 * the address can receive one.
 */
export async function resendConfirmation(): Promise<AuthResult> {
  const email = await pendingSignupEmail();
  if (!email) {
    return { status: "error", fieldErrors: {}, formError: "This confirmation has expired. Create the account again to get a new link." };
  }
  const byIp = rateLimit(`confirm-resend-ip:${await clientIp()}`, 6, 3600);
  const byEmail = rateLimit(`confirm-resend-email:${hashForLogs(email)}`, 1, RESEND_COOLDOWN_SECONDS);
  if (!byIp.allowed || !byEmail.allowed) {
    return {
      status: "error",
      fieldErrors: {},
      formError: "Please wait before asking for another email.",
      retryAfterSeconds: Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds),
    };
  }
  const supabase = await createServerSupabase();
  if (supabase) {
    await supabase.auth
      .resend({ type: "signup", email, options: { emailRedirectTo: `${await origin()}/auth/callback?next=/portal/homeowner` } })
      .catch(() => undefined);
  }
  return { status: "success", message: `If the address can receive it, a new link is on its way. You can ask again in ${RESEND_COOLDOWN_SECONDS} seconds.` };
}

/** Forget the pending address and start signup again (wrong email). */
export async function restartSignup(): Promise<void> {
  const jar = await cookies();
  jar.delete(PENDING_SIGNUP_COOKIE);
  redirect("/account/create");
}

/**
 * Sign out, then land on the sign-in page. Protected pages are dynamic and
 * read the session on every request, so Back cannot show them again.
 */
export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/portal/login?signed_out=1");
}

/**
 * Start a password reset.
 *
 * Supabase Auth mints, expires and single-uses the token; there is no custom
 * token here. The public response is identical for known, unknown and
 * provider-failure cases, takes at least RESET_RESPONSE_FLOOR_MS (plus jitter)
 * so timing does not reveal which happened, and is throttled per connection
 * and per hashed address. Logs carry the hash, never the address or a token.
 */
export async function requestPasswordReset(_prev: AuthResult<"email">, formData: FormData): Promise<AuthResult<"email">> {
  const started = Date.now();
  const parsed = forgotPasswordSchema.safeParse({ email: String(formData.get("email") ?? "") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom<"email">(parsed.error), formError: null, values: { email: String(formData.get("email") ?? "") } };
  }
  const email = parsed.data.email;
  const byIp = rateLimit(`reset-ip:${await clientIp()}`, 5, 900);
  const byEmail = rateLimit(`reset-email:${hashForLogs(email)}`, 3, 900);
  if (!byIp.allowed || !byEmail.allowed) {
    await settle(started);
    return {
      status: "error",
      fieldErrors: {},
      formError: "Too many reset requests. Wait a few minutes, then check your inbox for the newest link.",
      values: { email },
      retryAfterSeconds: Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds),
    };
  }

  const supabase = await createServerSupabase();
  if (supabase) {
    const redirectTo = `${await origin()}/auth/callback?next=/portal/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo }).catch(() => ({ error: { code: "network" } }));
    if (error) console.warn("[auth] reset request not sent", { code: (error as { code?: string }).code, email: hashForLogs(email) });
  }
  await settle(started);
  return { status: "success", message: email };
}

/**
 * Complete a reset inside the recovery session established by /auth/callback.
 *
 * Session policy (deliberate): a successful reset signs out EVERY session,
 * including this one, and asks for a fresh sign-in with the new password. Any
 * device still holding the old credentials loses access immediately.
 */
export async function completePasswordReset(_prev: AuthResult<ResetField>, formData: FormData): Promise<AuthResult<ResetField>> {
  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom<ResetField>(parsed.error), formError: null };

  const supabase = await createServerSupabase();
  if (!supabase) return { status: "error", fieldErrors: {}, formError: "Password reset is unavailable right now. Call the counter." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", fieldErrors: {}, formError: "This reset link has expired. Request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { status: "error", fieldErrors: { password: "Choose a password you have not used for this account." }, formError: null };
    if (error.code === "weak_password") return { status: "error", fieldErrors: { password: "Choose a stronger password -- avoid common words and reused passwords." }, formError: null };
    console.error("[auth] password update failed", { code: error.code, user: hashForLogs(user.id) });
    return { status: "error", fieldErrors: {}, formError: "We could not update the password. Request a new link and try again." };
  }
  await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
  return { status: "success" };
}
