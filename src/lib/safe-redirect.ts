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
 * rejected outright rather than sanitised into shape.
 *
 * Lives outside auth-actions.ts because that file is "use server", where every
 * export must be an async Server Action.
 */
export function safeNextPath(value: string | undefined | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
