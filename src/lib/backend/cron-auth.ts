import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Scheduled-job routes (pg_cron via private.invoke_site_route) send
 * `Authorization: Bearer $CRON_SECRET`. Fail closed: outside development, no
 * secret means no caller is trusted. Compared in constant time; hashing first
 * gives both sides the same length.
 */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}
