import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/backend/supabase-ssr";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Where emailed auth links land: signup confirmation and password recovery.
 *
 * Supports both link shapes Supabase can send -- a PKCE `code`, or a
 * `token_hash` + `type` -- exchanges it for a session cookie on this response,
 * and continues to a validated, site-relative `next`. Every failure lands on a
 * page that explains it and offers the recovery step; none of them carries the
 * token, the error text, or the email address in the URL.
 */
const ALLOWED_NEXT = ["/portal", "/portal/homeowner", "/portal/reset-password", "/products", "/checkout", "/quote"];

function failureTarget(next: string, reason: "expired" | "invalid" | "unavailable") {
  return next.startsWith("/portal/reset-password") ? `/portal/reset-password?state=${reason}` : `/account/check-email?status=${reason}`;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const requested = safeNextPath(url.searchParams.get("next"), "/portal");
  const next = ALLOWED_NEXT.some((path) => requested === path || requested.startsWith(`${path}/`) || requested.startsWith(`${path}?`)) ? requested : "/portal";
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  // The provider reports expired, reused and malformed links here.
  const providerError = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  if (providerError) {
    return redirectTo(failureTarget(next, providerError.includes("expired") ? "expired" : "invalid"));
  }

  const supabase = await createServerSupabase();
  if (!supabase) return redirectTo(failureTarget(next, "unavailable"));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      // A PKCE code opened in a different browser has no verifier to match.
      if (error) return redirectTo(failureTarget(next, error.code === "otp_expired" ? "expired" : "invalid"));
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return redirectTo(failureTarget(next, error.code === "otp_expired" ? "expired" : "invalid"));
    } else {
      return redirectTo(failureTarget(next, "invalid"));
    }
  } catch {
    return redirectTo(failureTarget(next, "unavailable"));
  }

  const response = redirectTo(next);
  // The pending-signup context has served its purpose.
  response.cookies.delete("summit_pending_signup");
  return response;
}
