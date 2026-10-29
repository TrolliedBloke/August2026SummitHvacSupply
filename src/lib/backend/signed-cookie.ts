import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Small signed, expiring values for HttpOnly cookies -- e.g. the address a
 * signup is waiting to confirm, which must survive a refresh without ever
 * appearing in a URL.
 */
function secret(): string {
  const configured = process.env.AUTH_COOKIE_SECRET ?? process.env.CHECKOUT_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "summit-local-auth-cookie";
  throw new Error("AUTH_COOKIE_SECRET is required in production");
}

export function signValue(value: string, ttlSeconds: number, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ v: value, exp: now + ttlSeconds * 1000 })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSignedValue(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const payload = token.slice(0, split);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(token.slice(split + 1));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v: string; exp: number };
    return parsed.exp > now ? parsed.v : null;
  } catch {
    return null;
  }
}

export function hashForLogs(value: string): string {
  return createHmac("sha256", secret()).update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}
