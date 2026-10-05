/**
 * Constrain a post-login redirect target to this site.
 *
 * `next` arrives from a query string, so without this an attacker can send
 * `/portal/login?next=https://evil.example/summit` and land a freshly
 * authenticated user on a lookalike sign-in page -- the classic open-redirect
 * assist to credential phishing, which borrows Summit's domain for the part of
 * the URL a victim actually reads.
 *
 * Protocol-relative (`//evil.example`) and backslash (`/\evil.example`) forms
 * are the usual bypasses, so anything that is not a single-slash-rooted path is
 * rejected outright rather than sanitised into shape. Browsers also strip tab,
 * CR and LF from URLs, so `/\t/evil.example` becomes `//evil.example`: any
 * control character or backslash anywhere rejects the value, and the result
 * must still resolve to this site's origin.
 *
 * Lives outside auth-actions.ts because that file is "use server", where every
 * export must be an async Server Action.
 */
export function safeNextPath(value: string | undefined | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  const base = "https://same-site.invalid";
  try {
    const url = new URL(value, base);
    // Dot segments normalise away: "/.//evil.example" has the pathname "//evil.example".
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
