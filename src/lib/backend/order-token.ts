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
