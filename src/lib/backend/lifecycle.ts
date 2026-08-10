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
 * No discounts anywhere in the sequence by design -- the levers are stock
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
    // No DB, or table missing pre-migration -- memory keeps the demo working.
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
    // "Back in stock" states a quantity as fact, so it requires a verified
    // count -- not merely a non-zero number carried over from an unverified
    // source. Without verification the subscription stays pending.
    if (!sku || !sku.availabilityVerified || sku.available <= 0) return false;
    await sendEmail(
      email,
      `Back in stock: ${sku.title}`,
      emailShell(
        `<h2 style="font-size: 20px; margin: 8px 0;">${sku.title} is back in Newark.</h2>
         <p style="line-height: 1.6;">${sku.sku} · ${sku.btu.toLocaleString()} BTU · <strong>${sku.available} in stock</strong>, will-call pickup available today.</p>
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

/**
 * Rebuild every line from the server catalog.
 *
 * The caller supplies only a SKU id and a quantity that we are willing to
 * believe; the title, part number and unit price are looked up here. Previously
 * the client's own `title` and `unitPrice` were stored verbatim and then
 * rendered into an email, which let anyone post arbitrary text and prices to an
 * arbitrary address over Summit's sending domain. Unknown SKUs are dropped
 * rather than stored, so a snapshot can only ever describe real products.
 */
function resolveSnapshotItems(items: Array<{ skuId: string; qty: number }>): SnapshotItem[] {
  const resolved: SnapshotItem[] = [];
  for (const item of items) {
    const sku = getStorefrontSku(item.skuId);
    if (!sku) continue;
    resolved.push({
      skuId: sku.id,
      sku: sku.sku,
      title: sku.title,
      qty: item.qty,
      // Quote-only products have no public price; they contribute 0 to the
      // subtotal rather than a fabricated one.
      unitPrice: sku.retailPrice ?? 0,
    });
  }
  return resolved;
}

export async function saveCartSnapshot(
  email: string,
  rawItems: Array<{ skuId: string; qty: number }>
): Promise<void> {
  if (!/.+@.+\..+/.test(email)) return;
  const items = resolveSnapshotItems(rawItems);
  if (items.length === 0) return;
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

/** Called from placeOrder -- a completed order ends the sequence. */
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

/** Cart titles and SKUs originate from a public endpoint, so they are attacker
 *  controlled and must never reach an email body as raw HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Stock urgency may only be claimed when every line in the cart has a verified
 * on-hand quantity. The catalog currently carries no verified quantities, so
 * this returns false for every real cart and the neutral copy is used.
 *
 * The previous sequence hard-coded "stock is holding" and "Still in stock in
 * Newark" into subject lines and bodies. With inventory unknown for all 100
 * products, every one of those sends was an unverifiable stock claim to a
 * customer.
 */
function cartStockIsVerified(items: SnapshotItem[]): boolean {
  if (items.length === 0) return false;
  return items.every((item) => {
    const sku = getStorefrontSku(item.skuId);
    return Boolean(sku?.availabilityVerified) && (sku?.available ?? 0) >= item.qty;
  });
}

/* The 3-email sequence: stage thresholds in minutes since capture. Subjects
 * depend on whether stock is actually verified, so no code path can promise
 * availability the warehouse has not confirmed. */
const STAGES = [
  {
    afterMinutes: 60,
    subject: (verified: boolean) =>
      verified ? "Your Summit cart is saved, stock is holding" : "Your Summit cart is saved",
  },
  {
    afterMinutes: 24 * 60,
    subject: (verified: boolean) =>
      verified
        ? "Still in stock in Newark (and what the whole project costs)"
        : "What your project costs all-in",
  },
  { afterMinutes: 72 * 60, subject: () => "Want a human to sanity-check the sizing?" },
];

function stageBody(stage: number, items: SnapshotItem[], subtotal: number): string {
  const stockVerified = cartStockIsVerified(items);
  const lines = items
    .map((i) => `<li style="margin: 4px 0;">${i.qty}× ${escapeHtml(i.title)}, ${money(i.unitPrice * i.qty)}</li>`)
    .join("");
  const cartBlock = `<ul style="padding-left: 18px; line-height: 1.6;">${lines}</ul>
    <p><strong>Subtotal: ${money(subtotal)}</strong></p>
    <p style="margin-top: 20px;"><a href="${baseUrl()}/checkout" style="background: green; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">Finish checkout</a></p>`;

  if (stage === 0) {
    const availability = stockVerified
      ? "Everything below is on the shelf in Newark right now, same-day will-call or Bay Area delivery."
      : "We confirm availability and lead time with the warehouse before any order is accepted, so nothing ships or bills until it is confirmed.";
    return `<h2 style="font-size: 20px; margin: 8px 0;">Your cart is saved.</h2>
      <p style="line-height: 1.6;">${availability}</p>${cartBlock}`;
  }
  if (stage === 1) {
    const heading = stockVerified
      ? "Still in stock, and here's the honest all-in math."
      : "Here's the honest all-in math.";
    return `<h2 style="font-size: 20px; margin: 8px 0;">${heading}</h2>
      <p style="line-height: 1.6;">Equipment + line set + licensed C-20 install + permit typically lands at <strong>$2,200–$3,600 all-in</strong> for a single-zone system, versus $6,800+ on a full-service quote. Your warranty stays intact with licensed installation.</p>${cartBlock}`;
  }
  return `<h2 style="font-size: 20px; margin: 8px 0;">Not sure it's the right size?</h2>
    <p style="line-height: 1.6;">That's the #1 reason people pause, and the easiest to settle. Text us a photo of the room or the old unit's model plate at <strong>${SITE.phone}</strong> and we'll sanity-check the sizing before you spend a dollar. No pressure either way.</p>${cartBlock}`;
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
      STAGES[stage].subject(cartStockIsVerified(cart.items)),
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
