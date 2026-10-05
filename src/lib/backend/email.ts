import "server-only";
import { SITE } from "@/lib/site";
import { Resend } from "resend";
import { createServiceRoleSupabaseClient } from "./supabase";

/**
 * Transactional email via Resend. SERVER ONLY (the API key never reaches the
 * browser). Every function is best-effort: failures are logged, not thrown, so
 * a flaky email provider never breaks an order or payment.
 */

const FROM = process.env.EMAIL_FROM ?? "Summit HVAC Supply <orders@summithvacsupply.com>";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

/** "someone@example.com" -> "s***@example.com". Enough to debug a flow, not
    enough to leak a customer list into stdout. */
function redactEmail(address: string): string {
  const [user, domain] = address.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

/** What a send was, for the customer view's email history (migration 036). */
export type EmailMeta = { kind?: string; relatedType?: string; relatedId?: string };

/**
 * One row per send in email_messages. Never throws and never blocks the send:
 * a logging failure must not cost a customer their receipt. Without the
 * service role (local dev) there is nowhere to log, so nothing is written.
 */
async function logEmail(
  to: string,
  subject: string,
  status: "sent" | "failed" | "skipped",
  meta: EmailMeta,
  result: { providerId?: string | null; error?: string | null } = {}
): Promise<void> {
  const db = createServiceRoleSupabaseClient();
  if (!db || !to) return;
  try {
    const { error } = await db.from("email_messages").insert({
      to_email: to,
      subject: subject.slice(0, 300),
      kind: meta.kind ?? "transactional",
      status,
      provider_id: result.providerId ?? null,
      error: result.error?.slice(0, 300) ?? null,
      related_type: meta.relatedType ?? null,
      related_id: meta.relatedId ?? null,
    });
    if (error) console.warn("[email log] insert failed:", error.code);
  } catch (err) {
    console.warn("[email log] insert failed:", err);
  }
}

async function send(to: string, subject: string, html: string, meta: EmailMeta = {}): Promise<void> {
  const resend = getResend();
  if (!to) return;
  if (!resend) {
    // No API key (yet): warn instead of dropping silently, so dev flows stay
    // visible. This is a misconfiguration, not information, so it is warn --
    // and the recipient is redacted, because an unset key in production would
    // otherwise write every customer address into the log stream.
    console.warn(`[email skipped, no RESEND_API_KEY] to=${redactEmail(to)} subject="${subject}"`);
    await logEmail(to, subject, "skipped", meta, { error: "RESEND_API_KEY not configured" });
    return;
  }
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error("Resend send failed:", error.name);
      await logEmail(to, subject, "failed", meta, { error: error.name });
      return;
    }
    await logEmail(to, subject, "sent", meta, { providerId: data?.id });
  } catch (err) {
    console.error("Resend send failed:", err);
    await logEmail(to, subject, "failed", meta, { error: err instanceof Error ? err.message : "unknown" });
  }
}

/** Generic transactional send for lifecycle flows (best-effort, never throws). */
export async function sendEmail(to: string, subject: string, html: string, meta: EmailMeta = {}): Promise<void> {
  await send(to, subject, html, meta);
}

/** User-requested and scheduled mail must not report success when delivery was skipped. */
export async function sendRequiredEmail(to: string, subject: string, html: string, idempotencyKey?: string, meta: EmailMeta = {}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    await logEmail(to, subject, "skipped", meta, { error: "RESEND_API_KEY not configured" });
    throw new Error("Email delivery is not configured.");
  }
  let result: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    result = await resend.emails.send({ from: FROM, to, subject, html }, idempotencyKey ? { idempotencyKey } : undefined);
  } catch (err) {
    // A network failure throws instead of returning an error; it must still
    // leave a "failed" row, or the customer view shows nothing was attempted.
    await logEmail(to, subject, "failed", meta, { error: err instanceof Error ? err.message : "unknown" });
    throw new Error("Email provider could not be reached.");
  }
  const { data, error } = result;
  if (error) {
    await logEmail(to, subject, "failed", meta, { error: error.name });
    throw new Error(`Email provider rejected delivery: ${error.name}`);
  }
  await logEmail(to, subject, "sent", meta, { providerId: data?.id });
}

/** First contact email on an account, or null. */
async function accountEmail(accountId: string | null): Promise<string | null> {
  if (!accountId) return null;
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("contacts")
    .select("email")
    .eq("account_id", accountId)
    .limit(1)
    .single();
  return data?.email ?? null;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return;
  const { data: inv } = await supabase
    .from("invoices")
    .select("invoice_number, total, balance, due_date, account_id")
    .eq("id", invoiceId)
    .single();
  if (!inv) return;

  const to = await accountEmail(inv.account_id);
  if (!to) return;

  await send(
    to,
    `Invoice ${inv.invoice_number} from Summit HVAC Supply`,
    `<h2>Invoice ${inv.invoice_number}</h2>
     <p>Total: <strong>${money(Number(inv.total))}</strong></p>
     <p>Balance due: <strong>${money(Number(inv.balance))}</strong> by ${inv.due_date}</p>
     <p>Reply to this email or call us with any questions.</p>`,
    { kind: "invoice", relatedType: "invoice", relatedId: invoiceId }
  );
}

export async function sendReceiptEmail(invoiceId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return;
  const { data: inv } = await supabase
    .from("invoices")
    .select("invoice_number, total, paid, balance, account_id")
    .eq("id", invoiceId)
    .single();
  if (!inv) return;

  const to = await accountEmail(inv.account_id);
  if (!to) return;

  await send(
    to,
    `Payment received - Invoice ${inv.invoice_number}`,
    `<h2>Thank you, payment received</h2>
     <p>Invoice ${inv.invoice_number}</p>
     <p>Paid to date: <strong>${money(Number(inv.paid))}</strong></p>
     <p>Remaining balance: <strong>${money(Number(inv.balance))}</strong></p>`,
    { kind: "receipt", relatedType: "invoice", relatedId: invoiceId }
  );
}

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return;
  const { data: order } = await supabase
    .from("sales_orders")
    .select("order_number, total, account_id")
    .eq("id", orderId)
    .single();
  if (!order) return;

  const to = await accountEmail(order.account_id);
  if (!to) return;

  await send(
    to,
    `Order ${order.order_number} confirmed`,
    `<h2>Order ${order.order_number} confirmed</h2>
     <p>Order total: <strong>${money(Number(order.total))}</strong></p>
     <p>We will follow up with shipment and tracking details.</p>`,
    { kind: "order_confirmation", relatedType: "order", relatedId: orderId }
  );
}

/**
 * "Your order shipped", sent once per ShipStation ship notice for delivered
 * orders (will-call handovers need no tracking email). The tracking link is
 * shown only for carriers we can link to; otherwise the number alone.
 */
export async function sendShippedEmail(input: {
  to: string;
  name: string | null;
  orderId: string;
  orderNumber: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}): Promise<void> {
  const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
  const tracking = input.trackingNumber
    ? input.trackingUrl
      ? `<p>Tracking: <a href="${escape(input.trackingUrl)}">${escape(input.trackingNumber)}</a>${input.carrier ? ` (${escape(input.carrier)})` : ""}</p>`
      : `<p>Tracking number: <strong>${escape(input.trackingNumber)}</strong>${input.carrier ? ` (${escape(input.carrier)})` : ""}</p>`
    : "<p>It is on its way. Reply to this email if you need the delivery details.</p>";
  await send(
    input.to,
    `Order ${input.orderNumber} has shipped`,
    `<h2>${input.name ? `${escape(input.name.split(" ")[0])}, your` : "Your"} order ${escape(input.orderNumber)} has shipped</h2>
     ${tracking}
     <p><strong>Inspect before you sign.</strong> Check every carton when it arrives and write any damage on the delivery receipt before signing, or the carrier can refuse the damage claim. Photograph the damage and reply to this email the same day.</p>
     <p>Warranty question later on? File it at <a href="${SITE.origin}/warranty">${SITE.origin.replace(/^https?:\/\//, "")}/warranty</a>.</p>
     <p>Questions about delivery? Reply to this email or call the Newark counter.</p>`,
    { kind: "shipped", relatedType: "order", relatedId: input.orderId }
  );
}
