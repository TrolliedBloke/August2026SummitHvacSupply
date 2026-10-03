import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AD_COOKIE_MAX_AGE_SECONDS, AD_CONSENT_COOKIE, AD_OPT_OUT_COOKIE } from "@/lib/privacy-cookies";

/**
 * Refreshes the Supabase auth session on every request and re-issues the
 * session cookie, so Server Components always see a valid session. Also does a
 * cheap edge-level gate on /admin and the staff portal areas (defense in depth;
 * the real enforcement is RLS in Postgres).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  function privacyResponse(result: NextResponse) {
    if (request.headers.get("sec-gpc") === "1") {
      const options = { path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: AD_COOKIE_MAX_AGE_SECONDS };
      result.cookies.set(AD_OPT_OUT_COOKIE, "1", options);
      result.cookies.set(AD_CONSENT_COOKIE, "denied", options);
    }
    return result;
  }

  const path = request.nextUrl.pathname;
  const gated = path.startsWith("/admin");
  // Public GPC requests only write privacy cookies, without an auth round trip.
  if (!gated && !path.startsWith("/portal") && !path.startsWith("/checkout")) return privacyResponse(response);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail closed: without auth env we cannot verify anyone, so a gated path must
  // be refused rather than waved through. The demo bypass is explicit and never
  // applies in production.
  const demoBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_UNAUTHENTICATED_ADMIN === "true";

  if (!url || !publicKey) {
    if (gated && !demoBypass) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    return privacyResponse(response);
  }

  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (gated) {
    if (!user) {
      const loginUrl = new URL("/portal/login", request.url);
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }

    // Being signed in is not enough -- a homeowner who registers is a valid
    // user. Only staff may see the operations dashboard.
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "staff") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  return privacyResponse(response);
}

export const config = {
  // Only auth-relevant paths. This used to match every request, which meant a
  // network round-trip to Supabase (auth.getUser) in the critical path of the
  // homepage and every product page -- latency paid in TTFB, and therefore LCP,
  // on exactly the pages where speed converts. Public catalog pages read no
  // session, so they gain nothing from the refresh.
  matcher: ["/admin/:path*", "/portal/:path*", "/checkout/:path*", { source: "/((?!api|_next|favicon.ico).*)", has: [{ type: "header", key: "sec-gpc", value: "1" }] }],
};
