import "server-only";
import { cookies } from "next/headers";
import { readSignedValue } from "./signed-cookie";

/** Signed, HttpOnly cookie holding the address a signup is waiting to confirm. */
export const PENDING_SIGNUP_COOKIE = "summit_pending_signup";
export const PENDING_SIGNUP_TTL_SECONDS = 60 * 60 * 24;
export const RESEND_COOLDOWN_SECONDS = 60;

/** The pending address, or null when absent, tampered with, or expired. */
export async function pendingSignupEmail(): Promise<string | null> {
  const jar = await cookies();
  return readSignedValue(jar.get(PENDING_SIGNUP_COOKIE)?.value);
}
