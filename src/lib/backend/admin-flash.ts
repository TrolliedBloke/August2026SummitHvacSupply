import "server-only";
import { cookies } from "next/headers";

/**
 * The result of an admin action, shown once on the page it returns to.
 *
 * Kept in a short-lived, httpOnly cookie rather than the URL: a message in a
 * query string can be forged by anyone who sends staff a link ("Refunded in
 * full" on an order nobody refunded). Set it from a server action; read it
 * while rendering.
 */
export type Flash = { tone: "success" | "danger"; text: string };

const NAME = "summit_admin_flash";

export async function setFlash(path: string, flash: Flash): Promise<void> {
  (await cookies()).set(NAME, JSON.stringify({ ...flash, text: flash.text.slice(0, 400) }), {
    path,
    maxAge: 15,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readFlash(): Promise<Flash | null> {
  const raw = (await cookies()).get(NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Flash;
    return (parsed.tone === "success" || parsed.tone === "danger") && typeof parsed.text === "string" ? parsed : null;
  } catch {
    return null;
  }
}
