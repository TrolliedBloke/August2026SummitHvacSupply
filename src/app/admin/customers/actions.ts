"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/backend/auth";
import { createServiceRoleSupabaseClient } from "@/lib/backend/supabase";

/**
 * Close or reopen a request from the customer view. Quote and contact
 * requests only: homeowner and dealer requests have their own reviewed
 * workflows (/admin/referrals, /admin/dealers) with audit events.
 *
 * The request's auto-task (migration 038) completes or reopens itself through
 * the database trigger, so this action only moves the request.
 */

const STATUS_UPDATE = {
  quote: { table: "quote_requests", column: "lifecycle", values: { quoted: "quoted", closed: "closed", reopen: "in_review" } },
  contact: { table: "contact_requests", column: "status", values: { resolved: "resolved", reopen: "open" } },
} as const;

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quote"), id: z.uuid(), to: z.enum(["quoted", "closed", "reopen"]), personId: z.string().regex(/^[0-9a-f]{20}$/) }),
  z.object({ kind: z.literal("contact"), id: z.uuid(), to: z.enum(["resolved", "reopen"]), personId: z.string().regex(/^[0-9a-f]{20}$/) }),
]);

export async function updateRequestStatus(form: FormData): Promise<void> {
  const staff = await requireStaff("/admin/customers");
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin/customers?notice=invalid");
  const { kind, id, to, personId } = parsed.data;
  const back = `/admin/customers/${personId}`;

  const db = createServiceRoleSupabaseClient();
  if (!db) redirect(`${back}?notice=unavailable`);
  const target = STATUS_UPDATE[kind];
  const value = (target.values as Record<string, string>)[to];
  const { error } = await db.from(target.table).update({ [target.column]: value }).eq("id", id);
  if (error) redirect(`${back}?notice=unavailable`);

  // Best effort: the audit line is useful, never required.
  await db.from("activity_log").insert({ actor_profile_id: staff.userId, event: `request_${to}`, entity_type: target.table, entity_id: id });

  revalidatePath(back);
  revalidatePath("/admin/customers");
  redirect(`${back}?notice=saved`);
}
