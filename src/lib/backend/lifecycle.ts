import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { sendEmail } from "./email";
import { getStorefrontSku, productHref } from "@/lib/storefront/catalog";
import { SITE } from "@/lib/site";

/**
 * Lifecycle email flows: back-in-stock alerts and the 3-email abandoned-cart
 * sequence. Same conventions as the rest of lib/backend: Supabase when
 * configured, an in-memory fallback otherwise (so the demo flow works with no
 * DB), and best-effort sends that never break a user-facing request.
 *
 * No discounts anywhere in the sequence by design — the levers are stock
 * urgency and expert help, not coupons that erode margin.
 */

type SnapshotItem = { skuId: string; sku: string; title: string; qty: number; unitPrice: number };

/* In-memory fallback stores (per server instance; fine for keyless dev). */
const memSubs = new Map<string, { email: string; skuId: string; skuCode: string; createdAt: number; notifiedAt: number | null }>();
const memCarts = new Map<string, { email: string; items: SnapshotItem[]; subtotal: number; createdAt: number; emailsSent: number; completedAt: number | null }>();

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/* Shared shell so lifecycle emails read like the site, not a blast tool. */
function emailShell(body: string, unsubscribeUrl?: string): string {
  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: black;">
    <p style="font-weight: 500; font-size: 15px; color: black;">Summit HVAC Supply</p>
    ${body}
    <hr style="border: none; border-top: 1px solid silver; margin: 28px 0 12px;" />
    <p style="font-size: 12px; color: dimgray; line-height: 1.5;">
      Summit HVAC Supply · ${SITE.address.full}<br/>
      Questions? Call or text ${SITE.phone}.
      ${unsubscribeUrl ? `<br/><a href="${unsubscribeUrl}" style="color: dimgray;">Unsubscribe from these emails</a>` : ""}
    </p>
  </div>`;
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? SITE.origin;
}

/* ---------------------------------------------------------------- back in stock */

export async function subscribeBackInStock(email: string, skuId: string): Promise<{ ok: true }> {
  const sku = getStorefrontSku(skuId);
  if (!sku) throw new Error("Unknown SKU");
  const supabase = createServiceRoleSupabaseClient();
  let stored = false;
  if (supabase) {
    const { error } = await supabase
      .from("back_in_stock_subscriptions")
      .upsert({ email, sku_id: sku.id, sku_code: sku.sku }, { onConflict: "email,sku_id" });
    if (error) console.warn("back_in_stock upsert failed (run migration 007?):", error.message);
    else stored = true;
  }
  if (!stored) {
    // No DB, or table missing pre-migration — memory keeps the demo working.
    memSubs.set(`${email}:${sku.id}`, {
      email, skuId: sku.id, skuCode: sku.sku, createdAt: Date.now(), notifiedAt: null,
    });
  }
  return { ok: true };
}

/** Send restock emails for every pending subscription whose SKU is purchasable again. */
export async function dispatchBackInStock(): Promise<{ sent: number }> {
  const supabase = createServiceRoleSupabaseClient();
  let sent = 0;

  const notify = async (email: string, skuId: string, unsubscribeUrl: string) => {
    const sku = getStorefrontSku(skuId);
    if (!sku || sku.available <= 0) return false;
    await sendEmail(
      email,
      `Back in stock: ${sku.title}`,
      emailShell(
        `<h2 style="font-size: 20px; margin: 8px 0;">${sku.title} is back in Newark.</h2>
         <p style="line-height: 1.6;">${sku.sku} · ${sku.btu.toLocaleString()} BTU · <strong>${sku.available} in stock</strong> — will-call pickup available today.</p>
         <p style="line-height: 1.6;">Retail ${money(sku.msrp)}. Stock moves; if this one matters for a job, grab it.</p>
         <p style="margin-top: 20px;"><a href="${baseUrl()}${productHref(sku)}" style="background: green; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">View ${sku.sku}</a></p>`,
        unsubscribeUrl
      )
    );
    return true;
  };

  const { data: subRows } = supabase
    ? await supabase
        .from("back_in_stock_subscriptions")
        .select("id, email, sku_id, unsubscribe_token")
        .is("notified_at", null)
        .eq("unsubscribed", false)
    : { data: null };

  if (supabase && subRows) {
    for (const row of subRows) {
      const url = `${baseUrl()}/api/unsubscribe?kind=stock&token=${row.unsubscribe_token}`;
      if (await notify(row.email, row.sku_id, url)) {
        await supabase
          .from("back_in_stock_subscriptions")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", row.id);
        sent++;
      }
    }
  } else {
    for (const sub of memSubs.values()) {
      if (sub.notifiedAt) continue;
      if (await notify(sub.email, sub.skuId, `${baseUrl()}/api/unsubscribe`)) {
        sub.notifiedAt = Date.now();
        sent++;
      }
    }
  }
  return { sent };
}

/* ---------------------------------------------------------------- abandoned cart */

export async function saveCartSnapshot(email: string, items: SnapshotItem[]): Promise<void> {
  if (!/.+@.+\..+/.test(email) || items.length === 0) return;
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const supabase = createServiceRoleSupabaseClient();
  let stored = false;
  if (supabase) {
    const { error } = await supabase.from("cart_snapshots").upsert(
      { email, items, subtotal, updated_at: new Date().toISOString(), completed_at: null },
      { onConflict: "email" }
    );
    if (error) console.warn("cart_snapshots upsert failed (run migration 007?):", error.message);
    else stored = true;
  }
  if (!stored) {
    const prev = memCarts.get(email);
    memCarts.set(email, {
      email, items, subtotal,
      createdAt: prev?.createdAt ?? Date.now(),
      emailsSent: prev?.emailsSent ?? 0,
      completedAt: null,
    });
  }
}

/** Called from placeOrder — a completed order ends the sequence. */
export async function clearCartSnapshot(email: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    await supabase
      .from("cart_snapshots")
      .update({ completed_at: new Date().toISOString() })
      .eq("email", email);
  }
  const cart = memCarts.get(email);
  if (cart) cart.completedAt = Date.now();
}

/* The 3-email sequence: stage thresholds in minutes since capture. */
const STAGES = [
  { afterMinutes: 60, subject: "Your Summit cart is saved — stock is holding" },
  { afterMinutes: 24 * 60, subject: "Still in stock in Newark (and what the whole project costs)" },
  { afterMinutes: 72 * 60, subject: "Want a human to sanity-check the sizing?" },
];

function stageBody(stage: number, items: SnapshotItem[], subtotal: number): string {
  const lines = items
    .map((i) => `<li style="margin: 4px 0;">${i.qty}× ${i.title} — ${money(i.unitPrice * i.qty)}</li>`)
    .join("");
  const cartBlock = `<ul style="padding-left: 18px; line-height: 1.6;">${lines}</ul>
    <p><strong>Subtotal: ${money(subtotal)}</strong></p>
    <p style="margin-top: 20px;"><a href="${baseUrl()}/checkout" style="background: green; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">Finish checkout</a></p>`;

  if (stage === 0) {
    return `<h2 style="font-size: 20px; margin: 8px 0;">Your cart is saved.</h2>
      <p style="line-height: 1.6;">Everything below is on the shelf in Newark right now — same-day will-call or Bay Area delivery.</p>${cartBlock}`;
  }
  if (stage === 1) {
    return `<h2 style="font-size: 20px; margin: 8px 0;">Still in stock — and here's the honest all-in math.</h2>
      <p style="line-height: 1.6;">Equipment + line set + licensed C-20 install + permit typically lands at <strong>$2,200–$3,600 all-in</strong> for a single-zone system — versus $6,800+ on a full-service quote. Your warranty stays intact with licensed installation.</p>${cartBlock}`;
  }
  return `<h2 style="font-size: 20px; margin: 8px 0;">Not sure it's the right size?</h2>
    <p style="line-height: 1.6;">That's the #1 reason people pause — and the easiest to settle. Text us a photo of the room or the old unit's model plate at <strong>${SITE.phone}</strong> and we'll sanity-check the sizing before you spend a dollar. No pressure either way.</p>${cartBlock}`;
}

/**
 * Walk due snapshots and advance each through the sequence.
 * `advanceMinutes` (testing only) pretends every snapshot is that much older.
 */
export async function dispatchAbandonedCarts(advanceMinutes = 0): Promise<{ sent: number }> {
  const supabase = createServiceRoleSupabaseClient();
  let sent = 0;
  const now = Date.now() + advanceMinutes * 60_000;

  const process = async (
    cart: { email: string; items: SnapshotItem[]; subtotal: number; createdAtMs: number; emailsSent: number },
    unsubscribeUrl: string
  ): Promise<boolean> => {
    const stage = cart.emailsSent;
    if (stage >= STAGES.length) return false;
    const ageMinutes = (now - cart.createdAtMs) / 60_000;
    if (ageMinutes < STAGES[stage].afterMinutes) return false;
    await sendEmail(
      cart.email,
      STAGES[stage].subject,
      emailShell(stageBody(stage, cart.items, cart.subtotal), unsubscribeUrl)
    );
    return true;
  };

  const { data: cartRows } = supabase
    ? await supabase
        .from("cart_snapshots")
        .select("id, email, items, subtotal, created_at, emails_sent, unsubscribe_token")
        .is("completed_at", null)
        .eq("unsubscribed", false)
    : { data: null };

  if (supabase && cartRows) {
    for (const row of cartRows) {
      const ok = await process(
        {
          email: row.email,
          items: row.items as SnapshotItem[],
          subtotal: Number(row.subtotal),
          createdAtMs: new Date(row.created_at).getTime(),
          emailsSent: row.emails_sent,
        },
        `${baseUrl()}/api/unsubscribe?kind=cart&token=${row.unsubscribe_token}`
      );
      if (ok) {
        await supabase
          .from("cart_snapshots")
          .update({ emails_sent: row.emails_sent + 1, last_email_at: new Date().toISOString() })
          .eq("id", row.id);
        sent++;
      }
    }
  } else {
    for (const cart of memCarts.values()) {
      if (cart.completedAt) continue;
      const ok = await process(
        { email: cart.email, items: cart.items, subtotal: cart.subtotal, createdAtMs: cart.createdAt, emailsSent: cart.emailsSent },
        `${baseUrl()}/api/unsubscribe`
      );
      if (ok) {
        cart.emailsSent++;
        sent++;
      }
    }
  }
  return { sent };
}

/* ---------------------------------------------------------------- unsubscribe */

export async function unsubscribeByToken(kind: "stock" | "cart", token: string): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase || !token) return false;
  const table = kind === "stock" ? "back_in_stock_subscriptions" : "cart_snapshots";
  const { data } = await supabase
    .from(table)
    .update({ unsubscribed: true })
    .eq("unsubscribe_token", token)
    .select("id");
  return Boolean(data && data.length > 0);
}
