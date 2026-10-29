import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { sendRequiredEmail } from "./email";

const claimed = new Set<string>();

/** Claim before sending so concurrent dispatches cannot send the same stage twice.
 * Failed or interrupted claims remain visible to staff for deliberate retry. */
export async function deliverOnce(key: string, to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) throw new Error("Email delivery is not configured.");
  const db = createServiceRoleSupabaseClient();
  if (db) {
    const { error } = await db.from("lifecycle_deliveries").insert({ delivery_key: key });
    if (error?.code === "23505") return false;
    if (error) throw new Error("Could not claim email delivery. Apply migration 035.");
  } else {
    if (claimed.has(key)) return false;
    claimed.add(key);
  }
  try {
    // The key's prefix names the stage: planning-, category-, warranty-, maintenance-.
    await sendRequiredEmail(to, subject, html, key, { kind: key.split("-")[0], relatedType: "lifecycle", relatedId: key });
    if (db) {
      const { error } = await db.from("lifecycle_deliveries").update({ sent_at: new Date().toISOString() }).eq("delivery_key", key);
      if (error) throw new Error("Provider accepted email but delivery confirmation could not be saved.");
    }
    return true;
  } catch (error) {
    if (db) await db.from("lifecycle_deliveries").update({ failed_at: new Date().toISOString() }).eq("delivery_key", key);
    throw error;
  }
}
