import "server-only";
import { z } from "zod";
import { createServiceRoleSupabaseClient } from "./supabase";
import { requireUser } from "./auth";
import { evaluateReturn, RETURNS_RULES, returnsRulesAreConfirmed } from "@/lib/returns-policy";
import { makeReference } from "@/lib/forms/result";

export type ReturnableLine = {
  lineId: string;
  orderId: string;
  orderNumber: string;
  orderedAt: string;
  description: string;
  catalogProductId: string | null;
  quantity: number;
  returnable: number;
  openRma: string | null;
};

/**
 * The signed-in account's order lines that could be returned. Every query is
 * scoped by the session's account id -- the service role bypasses RLS, so the
 * filter IS the authorization boundary (see lib/backend/portal.ts).
 */
export async function loadReturnableLines(): Promise<{ lines: ReturnableLine[]; available: boolean }> {
  const profile = await requireUser("/portal/returns/new");
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase || !profile.accountId) return { lines: [], available: Boolean(supabase) };
  const { data: orders } = await supabase
    .from("sales_orders")
    .select("id, order_number, created_at")
    .eq("account_id", profile.accountId)
    .order("created_at", { ascending: false })
    .limit(20);
  const orderIds = (orders ?? []).map((order) => order.id);
  if (orderIds.length === 0) return { lines: [], available: true };
  const { data: lines } = await supabase.from("order_lines").select("id, order_id, description, catalog_product_id, quantity").in("order_id", orderIds);
  const lineIds = (lines ?? []).map((line) => line.id);
  const { data: rmas } = lineIds.length
    ? await supabase.from("rmas").select("rma_number, order_line_id, quantity, status").in("order_line_id", lineIds)
    : { data: [] as Array<{ rma_number: string; order_line_id: string; quantity: number | null; status: string }> };
  return {
    available: true,
    lines: (lines ?? []).map((line) => {
      const order = (orders ?? []).find((entry) => entry.id === line.order_id)!;
      const related = (rmas ?? []).filter((rma) => rma.order_line_id === line.id);
      const returned = related.filter((rma) => rma.status !== "closed").reduce((sum, rma) => sum + (rma.quantity ?? 0), 0);
      const open = related.find((rma) => rma.status === "open" || rma.status === "waiting");
      return {
        lineId: String(line.id),
        orderId: String(line.order_id),
        orderNumber: String(order.order_number),
        orderedAt: String(order.created_at),
        description: String(line.description),
        catalogProductId: (line.catalog_product_id as string | null) ?? null,
        quantity: Number(line.quantity),
        returnable: Math.max(0, Number(line.quantity) - returned),
        openRma: open ? String(open.rma_number) : null,
      };
    }),
  };
}

export const startReturnSchema = z.object({
  lineId: z.uuid(),
  quantity: z.number().int().min(1),
  reason: z.enum(["wrong_item", "damaged", "defective", "changed_mind", "ordered_wrong", "job_cancelled"]),
  facts: z.object({
    arrivedDamagedOrWrong: z.boolean().optional(),
    damageNotedOnReceipt: z.boolean().optional(),
    installed: z.boolean().optional(),
    specialOrder: z.boolean().optional(),
    openedRefrigerant: z.boolean().optional(),
    opened: z.boolean().optional(),
    daysSinceDelivery: z.number().int().min(0).max(3650).optional(),
  }),
});

export class ReturnRejectedError extends Error {}

/** Create an RMA from one of the account's own lines, re-validated server-side. */
export async function startReturn(input: unknown) {
  const profile = await requireUser("/portal/returns/new");
  const parsed = startReturnSchema.parse(input);
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) throw new ReturnRejectedError("Returns are unavailable right now. Call the counter.");
  if (!returnsRulesAreConfirmed()) throw new ReturnRejectedError("Online return initiation is awaiting operations confirmation. Call the counter.");
  if (!profile.accountId) throw new ReturnRejectedError("This sign-in is not linked to an account with orders.");

  const { lines } = await loadReturnableLines();
  const line = lines.find((entry) => entry.lineId === parsed.lineId);
  // Another account's line is indistinguishable from a missing one.
  if (!line) throw new ReturnRejectedError("That order line was not found on your account.");
  if (line.openRma) throw new ReturnRejectedError(`This line already has an open return (${line.openRma}).`);
  if (parsed.quantity > line.returnable) throw new ReturnRejectedError(`At most ${line.returnable} can be returned from this line.`);

  const outcome = evaluateReturn(parsed.facts);
  if (outcome.kind === "needs") throw new ReturnRejectedError("Answer every question so we can check the policy.");
  if (outcome.verdict === "not_returnable" || outcome.verdict === "warranty") {
    throw new ReturnRejectedError(`${outcome.headline}. ${outcome.explanation}`);
  }
  const rmaNumber = makeReference("RMA");
  const { error } = await supabase.from("rmas").insert({
    rma_number: rmaNumber,
    order_id: line.orderId,
    account_id: profile.accountId,
    order_line_id: line.lineId,
    catalog_product_id: line.catalogProductId,
    quantity: parsed.quantity,
    reason: parsed.reason,
    status: "open",
    policy_version: `${RETURNS_RULES.version} / document ${RETURNS_RULES.documentVersion}`,
    preliminary_outcome: outcome.verdict,
    facts: parsed.facts,
    requested_by: profile.userId,
  });
  if (error) {
    if (error.code === "23505") throw new ReturnRejectedError("This line already has an open return.");
    throw new Error(error.message);
  }
  return { rmaNumber, outcome: outcome.headline, validDays: RETURNS_RULES.rmaValidDays };
}
