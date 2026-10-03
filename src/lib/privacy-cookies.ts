/**
 * Cookie names shared by the browser and the server for ad-sharing choices.
 * Kept free of server imports so client components can read them.
 *
 * Neither cookie is HttpOnly: the ad-tag loader runs in the browser and must
 * see an opt-out before it loads anything. Neither holds personal data.
 */
export const AD_OPT_OUT_COOKIE = "summit_ad_opt_out";
export const AD_CONSENT_COOKIE = "summit_ad_consent";
export const AD_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

export function readCookie(name: string, cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(rest.join("=")); } catch { return rest.join("="); }
    }
  }
  return null;
}

/**
 * The browser's own signals, read client-side: the opt-out cookie, or Global
 * Privacy Control. Either one means no ad tag loads on this browser.
 */
export function browserOptedOut(cookieString: string, globalPrivacyControl: unknown): boolean {
  return readCookie(AD_OPT_OUT_COOKIE, cookieString) === "1" || globalPrivacyControl === true;
}
