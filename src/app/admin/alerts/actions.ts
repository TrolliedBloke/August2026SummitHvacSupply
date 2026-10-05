"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/backend/auth";
import { setFlash } from "@/lib/backend/admin-flash";
import { createServiceRoleSupabaseClient } from "@/lib/backend/supabase";

const PATH = "/admin/alerts";

/** Mark an alert handled. The fix itself happens on the page the alert points to. */
export async function resolveAlertAction(form: FormData): Promise<void> {
  const staff = await requireStaff(PATH);
  const id = z.uuid().safeParse(form.get("alertId"));
  const db = createServiceRoleSupabaseClient();
  if (!id.success || !db) {
    await setFlash(PATH, { tone: "danger", text: "That alert couldn't be updated." });
  } else {
    await db.from("staff_alerts").update({ resolved_at: new Date().toISOString(), resolved_by: staff.name || staff.email }).eq("id", id.data).is("resolved_at", null);
    await setFlash(PATH, { tone: "success", text: "Marked handled." });
  }
  revalidatePath(PATH);
  revalidatePath("/admin", "layout");
}
