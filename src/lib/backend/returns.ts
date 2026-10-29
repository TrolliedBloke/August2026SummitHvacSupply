import "server-only";
import { z } from "zod";
import { createServiceRoleSupabaseClient } from "./supabase";
import { requireUser } from "./auth";
import { sendEmail } from "./email";
import { emailShell } from "./lifecycle";
import { raiseStaffAlert, resolveStaffAlert } from "./alerts";
import { createScopedToken, verifyScopedToken } from "./order-token";
import { PaymentActionError, refundOrder } from "./payments";
import { evaluateReturn, RETURNS_RULES, returnsRulesAreConfirmed, type ReturnFacts } from "@/lib/returns-policy";
import { makeReference } from "@/lib/forms/result";
import { SITE } from "@/lib/site";

/**
 * Returns (docs/LIABILITY-REMEDIATION-PLAN.md, phase 2).
 *
 * Every return reaches a person: an RMA row (which opens a staff task through
 * the migration 039 trigger), a staff alert email, and an acknowledgement to
 * the customer. Three ways in, one code path:
 *  - the portal, for signed-in accounts;
 *  - a signed link emailed to the order's address, for guest buyers;
 *  - staff, for a customer who calls.
 *
 * The policy result is preliminary, and until operations confirms the rules
 * (RETURNS_RULES.review) it is not shown to the customer as an outcome at all:
 * the RMA is opened for review and staff confirm the terms.
 */

export type ReturnableLine = {
  lineId: string;
  orderId: string;
  orderNumber: string;
  orderedAt: string;
  /** When the order was delivered or picked up, if recorded. */
  deliveredAt: string | null;
  /** Whole days since then, computed on the server when the page is built. */
  daysSinceDelivery: number | null;
  description: string;
  catalogProductId: string | null;
  quantity: number;
  returnable: number;
  openRma: string | null;
};

type Db = NonNullable<ReturnType<typeof createServiceRoleSupabaseClient>>;
type OrderRow = { id: string; order_number: string; created_at: string; fulfilled_at: string | null };

const GUEST_LINK_PURPOSE = "guest-return";
const GUEST_LINK_TTL_MS = 72 * 3_600_000;
const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? SITE.origin;

export class ReturnRejectedError extends Error {}

/** Whole days since delivery, from the recorded date. */
export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const elapsed = now.getTime() - new Date(iso).getTime();
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 86_400_000)) : null;
}

async function linesFor(supabase: Db, orders: OrderRow[]): Promise<ReturnableLine[]> {
  const orderIds = orders.map((order) => order.id);
  if (orderIds.length === 0) return [];
  const { data: lines } = await supabase.from("order_lines").select("id, order_id, description, catalog_product_id, quantity").in("order_id", orderIds);
  const lineIds = (lines ?? []).map((line) => line.id);
  const { data: rmas } = lineIds.length
    ? await supabase.from("rmas").select("rma_number, order_line_id, quantity, status").in("order_line_id", lineIds)
    : { data: [] as Array<{ rma_number: string; order_line_id: string; quantity: number | null; status: string }> };
  return (lines ?? []).map((line) => {
    const order = orders.find((entry) => entry.id === line.order_id)!;
    const related = (rmas ?? []).filter((rma) => rma.order_line_id === line.id);
    const returned = related.filter((rma) => rma.status !== "closed").reduce((sum, rma) => sum + (rma.quantity ?? 0), 0);
    const open = related.find((rma) => rma.status === "open" || rma.status === "waiting");
    return {
      lineId: String(line.id),
      orderId: String(line.order_id),
      orderNumber: String(order.order_number),
      orderedAt: String(order.created_at),
      deliveredAt: order.fulfilled_at ?? null,
      daysSinceDelivery: daysSince(order.fulfilled_at ?? null),
      description: String(line.description),
      catalogProductId: (line.catalog_product_id as string | null) ?? null,
      quantity: Number(line.quantity),
      returnable: Math.max(0, Number(line.quantity) - returned),
      openRma: open ? String(open.rma_number) : null,
    };
  });
}

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
    .select("id, order_number, created_at, fulfilled_at")
    .eq("account_id", profile.accountId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(20);
  return { available: true, lines: await linesFor(supabase, (orders ?? []) as OrderRow[]) };
}

export const startReturnSchema = z.object({
  lineId: z.uuid(),
  quantity: z.number().int().min(1).max(1000),
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
  notes: z.string().trim().max(2000).optional(),
});

type Requester = {
  userId: string | null;
  accountId: string | null;
  name: string | null;
  email: string | null;
  channel: "portal" | "guest_link" | "staff";
};

export type StartedReturn = { rmaNumber: string; outcome: string; validDays: number; reviewOnly: boolean };

const REASON_LABEL: Record<string, string> = {
  wrong_item: "Wrong item received",
  damaged: "Damaged in transit",
  defective: "Dead on arrival / defective",
  changed_mind: "No longer needed",
  ordered_wrong: "Ordered the wrong item",
  job_cancelled: "Job cancelled",
};

async function createRma(supabase: Db, line: ReturnableLine, input: z.infer<typeof startReturnSchema>, requester: Requester): Promise<StartedReturn> {
  if (line.openRma) throw new ReturnRejectedError(`This line already has an open return (${line.openRma}).`);
  if (input.quantity > line.returnable) throw new ReturnRejectedError(`At most ${line.returnable} can be returned from this line.`);

  // The recorded delivery date beats the customer's estimate (2.4).
  const recorded = daysSince(line.deliveredAt);
  const facts: ReturnFacts = recorded === null ? input.facts : { ...input.facts, daysSinceDelivery: recorded };
  const outcome = evaluateReturn(facts);
  if (outcome.kind === "needs") throw new ReturnRejectedError("Answer every question so we can check the policy.");
  if (outcome.verdict === "warranty") {
    throw new ReturnRejectedError(`Installed equipment is a warranty question, not a return. File a warranty claim at ${siteUrl()}/warranty and we'll coordinate it with the manufacturer.`);
  }
  const confirmed = returnsRulesAreConfirmed();
  if (confirmed && outcome.verdict === "not_returnable") throw new ReturnRejectedError(`${outcome.headline}. ${outcome.explanation}`);

  const rmaNumber = makeReference("RMA");
  const { error } = await supabase.from("rmas").insert({
    rma_number: rmaNumber,
    order_id: line.orderId,
    account_id: requester.accountId,
    order_line_id: line.lineId,
    catalog_product_id: line.catalogProductId,
    quantity: input.quantity,
    reason: input.reason,
    status: "open",
    policy_version: `${RETURNS_RULES.version} / document ${RETURNS_RULES.documentVersion}${confirmed ? "" : " (rules pending operations review)"}`,
    preliminary_outcome: outcome.verdict,
    facts,
    requested_by: requester.userId,
    requester_name: requester.name,
    requester_email: requester.email?.toLowerCase() ?? null,
    channel: requester.channel,
    staff_notes: input.notes ? `Customer: ${input.notes}` : null,
  });
  if (error) {
    if (error.code === "23505") throw new ReturnRejectedError("This line already has an open return.");
    throw new Error(error.message);
  }

  await raiseStaffAlert({
    kind: "return_requested",
    dedupeKey: `rma:${rmaNumber}`,
    subject: `Return ${rmaNumber} for order ${line.orderNumber}`,
    body: [
      `${requester.name ?? "Customer"} (${requester.email ?? "no email"}) via ${requester.channel.replace("_", " ")}.`,
      `${input.quantity} × ${line.description}`,
      `Reason: ${REASON_LABEL[input.reason] ?? input.reason}`,
      `Preliminary: ${outcome.headline} (${outcome.verdict})${confirmed ? "" : ". Rules not yet confirmed by operations: decide the terms."}`,
      line.deliveredAt ? `Delivered ${new Date(line.deliveredAt).toLocaleDateString("en-US")} (${recorded} days ago).` : `No delivery date on record; customer says ${facts.daysSinceDelivery ?? "?"} days.`,
      input.notes ? `Customer notes: ${input.notes}` : "",
      "Decide it in Admin → Returns.",
    ]
      .filter(Boolean)
      .join("\n"),
    relatedType: "rma",
  });

  if (requester.email) {
    await sendEmail(
      requester.email,
      `Return ${rmaNumber} received`,
      emailShell(`<h2 style="font-size:20px;margin:8px 0">We've received your return request.</h2>
        <p style="line-height:1.6">Return <strong>${rmaNumber}</strong> for order ${escape(line.orderNumber)}: ${input.quantity} × ${escape(line.description)}.</p>
        <p style="line-height:1.6">The counter reviews every return and replies within one business day with the terms for your order and how to send it back. <strong>Please don't ship anything until we email approval</strong>; an approved RMA is valid for ${RETURNS_RULES.rmaValidDays} days.</p>
        ${outcome.verdict === "damage_claim" || outcome.verdict === "late_damage_claim" ? `<p style="line-height:1.6">For damage, reply with photos of the damage, the packaging and the serial label, and keep everything until we've inspected it.</p>` : ""}
        <p style="line-height:1.6">Questions? Reply to this email or call ${SITE.phone}.</p>`),
      { kind: "return_received", relatedType: "rma", relatedId: rmaNumber }
    );
  }
  return { rmaNumber, outcome: outcome.headline, validDays: RETURNS_RULES.rmaValidDays, reviewOnly: !confirmed };
}

/** Portal: create an RMA from one of the account's own lines, re-validated server-side. */
export async function startReturn(input: unknown): Promise<StartedReturn> {
  const profile = await requireUser("/portal/returns/new");
  const parsed = startReturnSchema.parse(input);
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) throw new ReturnRejectedError("Returns are unavailable right now. Call the counter.");
  if (!profile.accountId) throw new ReturnRejectedError("This sign-in is not linked to an account with orders.");

  const { lines } = await loadReturnableLines();
  const line = lines.find((entry) => entry.lineId === parsed.lineId);
  // Another account's line is indistinguishable from a missing one.
  if (!line) throw new ReturnRejectedError("That order line was not found on your account.");
  return createRma(supabase, line, parsed, { userId: profile.userId, accountId: profile.accountId, name: profile.name, email: profile.email, channel: "portal" });
}

/* Guest buyers: a signed link to the order's email ------------------------------------------- */

/**
 * Sends a return link to the order's email when the order number and email
 * match. The caller always gets the same answer, so this can't be used to
 * learn which orders or addresses exist.
 */
export async function requestGuestReturnLink(orderNumber: string, email: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) throw new ReturnRejectedError("Returns are unavailable right now. Call the counter.");
  const { data: order } = await supabase
    .from("sales_orders")
    .select("id, order_number, buyer_email, buyer_name")
    .eq("order_number", orderNumber.trim().toUpperCase())
    .maybeSingle();
  if (!order?.buyer_email || order.buyer_email.trim().toLowerCase() !== email.trim().toLowerCase()) return;
  const link = `${siteUrl()}/returns/start/${createScopedToken(GUEST_LINK_PURPOSE, order.id, GUEST_LINK_TTL_MS)}`;
  await sendEmail(
    order.buyer_email,
    `Start a return for order ${order.order_number}`,
    emailShell(`<h2 style="font-size:20px;margin:8px 0">Start your return</h2>
      <p style="line-height:1.6">Use this link to choose the items from order ${escape(order.order_number)} you want to return. It works for 3 days.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#1f6f43;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Start a return</a></p>
      <p style="line-height:1.6;color:#6f6e69;font-size:13px">If you didn't ask for this, ignore it; nothing changes on your order.</p>`),
    { kind: "return_link", relatedType: "order", relatedId: order.id }
  );
}

async function guestOrder(token: string): Promise<{ supabase: Db; order: OrderRow & { buyer_email: string | null; buyer_name: string | null } } | null> {
  const orderId = verifyScopedToken(GUEST_LINK_PURPOSE, token);
  if (!orderId) return null;
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from("sales_orders").select("id, order_number, created_at, fulfilled_at, buyer_email, buyer_name, status").eq("id", orderId).maybeSingle();
  if (!data || data.status === "cancelled") return null;
  return { supabase, order: data as OrderRow & { buyer_email: string | null; buyer_name: string | null } };
}

export async function loadGuestReturnLines(token: string): Promise<{ orderNumber: string; lines: ReturnableLine[] } | null> {
  const found = await guestOrder(token);
  if (!found) return null;
  return { orderNumber: found.order.order_number, lines: await linesFor(found.supabase, [found.order]) };
}

export async function startGuestReturn(token: string, input: unknown): Promise<StartedReturn> {
  const parsed = startReturnSchema.parse(input);
  const found = await guestOrder(token);
  if (!found) throw new ReturnRejectedError("This return link has expired. Request a new one from the returns page.");
  const line = (await linesFor(found.supabase, [found.order])).find((entry) => entry.lineId === parsed.lineId);
  if (!line) throw new ReturnRejectedError("That item isn't on this order.");
  return createRma(found.supabase, line, parsed, { userId: null, accountId: null, name: found.order.buyer_name, email: found.order.buyer_email, channel: "guest_link" });
}

/* Staff ----------------------------------------------------------------------------------------- */

type Staff = { userId: string; name: string };

/** A customer who calls: staff open the RMA on their behalf. */
export async function openReturnForCaller(staff: Staff, orderNumber: string, input: unknown): Promise<StartedReturn> {
  const parsed = startReturnSchema.parse(input);
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) throw new ReturnRejectedError("The database is not configured.");
  const { data: order } = await supabase.from("sales_orders").select("id, order_number, created_at, fulfilled_at, buyer_email, buyer_name, account_id").eq("order_number", orderNumber.trim().toUpperCase()).maybeSingle();
  if (!order) throw new ReturnRejectedError(`No order ${orderNumber}.`);
  const line = (await linesFor(supabase, [order as OrderRow])).find((entry) => entry.lineId === parsed.lineId);
  if (!line) throw new ReturnRejectedError("That line isn't on this order.");
  const result = await createRma(supabase, line, { ...parsed, notes: [`Opened by ${staff.name} for a caller.`, parsed.notes].filter(Boolean).join(" ") }, {
    userId: staff.userId,
    accountId: (order.account_id as string | null) ?? null,
    name: order.buyer_name,
    email: order.buyer_email,
    channel: "staff",
  });
  return result;
}

export type RmaRow = {
  id: string;
  rma_number: string;
  status: "open" | "waiting" | "approved" | "closed";
  reason: string;
  quantity: number | null;
  preliminary_outcome: string | null;
  facts: ReturnFacts | null;
  created_at: string;
  channel: string | null;
  requester_name: string | null;
  requester_email: string | null;
  decision: string | null;
  refund_amount: number | null;
  refund_id: string | null;
  received_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  closed_at: string | null;
  staff_notes: string | null;
  order_id: string | null;
  order_line_id: string | null;
};

const RMA_COLUMNS =
  "id, rma_number, status, reason, quantity, preliminary_outcome, facts, created_at, channel, requester_name, requester_email, decision, refund_amount, refund_id, received_at, decided_by, decided_at, closed_at, staff_notes, order_id, order_line_id";

function db(): Db {
  const client = createServiceRoleSupabaseClient();
  if (!client) throw new ReturnRejectedError("The database is not configured.");
  return client;
}

async function loadRma(rmaId: string): Promise<RmaRow & { order: { order_number: string; paid: boolean; payment_mode: string | null; total: number } | null; line: { description: string; unit_price: number; quantity: number } | null }> {
  const { data } = await db().from("rmas").select(RMA_COLUMNS).eq("id", rmaId).maybeSingle();
  if (!data) throw new ReturnRejectedError("Return not found.");
  const rma = data as RmaRow;
  const [{ data: order }, { data: line }] = await Promise.all([
    rma.order_id ? db().from("sales_orders").select("order_number, paid, payment_mode, total").eq("id", rma.order_id).maybeSingle() : Promise.resolve({ data: null }),
    rma.order_line_id ? db().from("order_lines").select("description, unit_price, quantity").eq("id", rma.order_line_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { ...rma, order: order as never, line: line as never };
}

async function audit(event: string, rmaId: string, by: string) {
  await db().from("activity_log").insert({ actor_profile_id: by || null, event, entity_type: "rmas", entity_id: rmaId });
}

function appendNote(existing: string | null, staff: Staff, note: string): string {
  const stamp = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return [existing, `${stamp} ${staff.name}: ${note}`].filter(Boolean).join("\n").slice(-4000);
}

async function tellCustomer(rma: RmaRow, subject: string, body: string) {
  if (!rma.requester_email) return;
  await sendEmail(rma.requester_email, subject, emailShell(body), { kind: "return_update", relatedType: "rma", relatedId: rma.rma_number });
}

/** Suggested refund: the line price for the returned quantity, less the restocking fee when the outcome carries one. */
export function suggestedRefund(unitPrice: number, quantity: number, outcome: string | null): number {
  const gross = Math.round(unitPrice * quantity * 100) / 100;
  if (outcome === "refund_less_restocking") return Math.round(gross * (1 - RETURNS_RULES.restockingFeePercent / 100) * 100) / 100;
  return gross;
}

export type ReturnDecision =
  | { action: "approve"; note: string }
  | { action: "request_info"; message: string }
  | { action: "received"; note: string }
  | { action: "refund"; amount: number; note: string }
  | { action: "decline"; reason: string }
  | { action: "close"; reason: string };

export async function decideReturn(rmaId: string, staff: Staff, decision: ReturnDecision): Promise<string> {
  const rma = await loadRma(rmaId);
  if (rma.status === "closed" && decision.action !== "close") throw new ReturnRejectedError(`${rma.rma_number} is closed.`);
  const now = new Date().toISOString();
  const ref = escape(rma.rma_number);

  switch (decision.action) {
    case "approve": {
      await db().from("rmas").update({ status: "approved", decision: "approved", decided_by: staff.name, decided_at: now, staff_notes: appendNote(rma.staff_notes, staff, `Approved. ${decision.note}`) }).eq("id", rma.id);
      await tellCustomer(
        rma,
        `Return ${rma.rma_number} approved`,
        `<h2 style="font-size:20px;margin:8px 0">Your return ${ref} is approved.</h2>
         <p style="line-height:1.6">${escape(decision.note)}</p>
         <p style="line-height:1.6">Bring it to the Newark counter, or ship it back, within ${RETURNS_RULES.rmaValidDays} days, complete and in its packaging, with <strong>${ref}</strong> written on the outside. We refund once it's received and inspected.</p>`
      );
      break;
    }
    case "request_info": {
      await db().from("rmas").update({ status: "waiting", staff_notes: appendNote(rma.staff_notes, staff, `Asked the customer: ${decision.message}`) }).eq("id", rma.id);
      await tellCustomer(
        rma,
        `About your return ${rma.rma_number}`,
        `<h2 style="font-size:20px;margin:8px 0">We need a little more for return ${ref}.</h2>
         <p style="line-height:1.6">${escape(decision.message).replace(/\n/g, "<br>")}</p>
         <p style="line-height:1.6">Reply to this email with the details or photos.</p>`
      );
      break;
    }
    case "received": {
      await db().from("rmas").update({ received_at: now, staff_notes: appendNote(rma.staff_notes, staff, `Received and inspected. ${decision.note}`) }).eq("id", rma.id);
      break;
    }
    case "refund": {
      if (!(decision.amount > 0)) throw new ReturnRejectedError("Enter the refund amount.");
      let refundId: string;
      if (rma.order?.paid && rma.order.payment_mode === "card") {
        try {
          refundId = (await refundOrder(rma.order_id!, decision.amount, staff, { reason: decision.note, rmaNumber: rma.rma_number })).refundId;
        } catch (error) {
          throw error instanceof PaymentActionError ? new ReturnRejectedError(error.message) : error;
        }
      } else {
        // Net terms and counter payments: the credit is issued in QuickBooks;
        // this records the decision so the books and the RMA agree.
        refundId = `manual:${now}`;
        await tellCustomer(
          rma,
          `Credit for return ${rma.rma_number}`,
          `<h2 style="font-size:20px;margin:8px 0">We've credited $${decision.amount.toFixed(2)} for return ${ref}.</h2><p style="line-height:1.6">It appears on your account statement.</p>`
        );
      }
      await db()
        .from("rmas")
        .update({ refund_amount: decision.amount, refund_id: refundId, decision: rma.decision ?? "approved", decided_by: staff.name, decided_at: now, staff_notes: appendNote(rma.staff_notes, staff, `Refunded $${decision.amount.toFixed(2)}${refundId.startsWith("manual:") ? " (issue the credit memo in QuickBooks)" : ` (${refundId})`}. ${decision.note}`) })
        .eq("id", rma.id);
      break;
    }
    case "decline": {
      await db().from("rmas").update({ status: "closed", decision: "declined", decided_by: staff.name, decided_at: now, closed_at: now, staff_notes: appendNote(rma.staff_notes, staff, `Declined. ${decision.reason}`) }).eq("id", rma.id);
      await tellCustomer(
        rma,
        `About your return ${rma.rma_number}`,
        `<h2 style="font-size:20px;margin:8px 0">We can't accept return ${ref}.</h2>
         <p style="line-height:1.6">${escape(decision.reason)}</p>
         <p style="line-height:1.6">If something's wrong with the equipment after installation, file a warranty claim at <a href="${siteUrl()}/warranty">${siteUrl().replace(/^https?:\/\//, "")}/warranty</a>. Questions? Call ${SITE.phone}.</p>`
      );
      break;
    }
    case "close": {
      await db().from("rmas").update({ status: "closed", closed_at: now, staff_notes: appendNote(rma.staff_notes, staff, `Closed. ${decision.reason}`) }).eq("id", rma.id);
      break;
    }
  }
  await audit(`rma_${decision.action}`, rma.id, staff.userId);
  if (decision.action === "approve" || decision.action === "decline" || decision.action === "close") await resolveStaffAlert(`rma:${rma.rma_number}`, staff.name);
  return rma.rma_number;
}

export async function listReturns(): Promise<Array<RmaRow & { order_number: string | null; line_description: string | null; unit_price: number | null }>> {
  const { data } = await db().from("rmas").select(`${RMA_COLUMNS}, sales_orders(order_number), order_lines(description, unit_price)`).order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as unknown as Array<RmaRow & { sales_orders: { order_number: string } | null; order_lines: { description: string; unit_price: number } | null }>).map(({ sales_orders, order_lines, ...rma }) => ({
    ...rma,
    order_number: sales_orders?.order_number ?? null,
    line_description: order_lines?.description ?? null,
    unit_price: order_lines ? Number(order_lines.unit_price) : null,
  }));
}

/** Lines of an order, for staff opening a return on a caller's behalf. */
export async function orderLinesForStaff(orderNumber: string): Promise<{ orderNumber: string; lines: ReturnableLine[] } | null> {
  const supabase = db();
  const { data: order } = await supabase.from("sales_orders").select("id, order_number, created_at, fulfilled_at").eq("order_number", orderNumber.trim().toUpperCase()).maybeSingle();
  if (!order) return null;
  return { orderNumber: order.order_number, lines: await linesFor(supabase, [order as OrderRow]) };
}
