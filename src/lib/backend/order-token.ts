import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const configured = process.env.CHECKOUT_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "summit-local-checkout-token";
  throw new Error("CHECKOUT_TOKEN_SECRET is required in production");
}

export function createOrderToken(orderId: string): string {
  const signature = createHmac("sha256", secret()).update(orderId).digest("base64url");
  return `${orderId}.${signature}`;
}

export function verifyOrderToken(token: string): string | null {
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const orderId = token.slice(0, split);
  const provided = token.slice(split + 1);
  const expected = createHmac("sha256", secret()).update(orderId).digest("base64url");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? orderId : null;
}

/**
 * A signed, expiring link for one purpose (a guest return, a privacy-request
 * confirmation). The purpose is part of the signature, so a token issued for
 * one can't be replayed as another, and the subject never leaves the token
 * unsigned.
 */
export function createScopedToken(purpose: string, subject: string, ttlMs: number, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ p: purpose, s: subject, e: now + ttlMs })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(`${purpose}.${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyScopedToken(purpose: string, token: string, now = Date.now()): string | null {
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const payload = token.slice(0, split);
  const a = Buffer.from(token.slice(split + 1));
  const b = Buffer.from(createHmac("sha256", secret()).update(`${purpose}.${payload}`).digest("base64url"));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { p?: string; s?: string; e?: number };
    if (decoded.p !== purpose || typeof decoded.s !== "string" || typeof decoded.e !== "number" || decoded.e < now) return null;
    return decoded.s;
  } catch {
    return null;
  }
}
