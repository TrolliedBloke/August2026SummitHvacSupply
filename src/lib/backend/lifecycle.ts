import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { sendRequiredEmail as sendEmail } from "./email";
import { deliverOnce } from "./lifecycle-delivery";
import { createHash } from "node:crypto";
import { getStorefrontSku, getStorefrontSkus, productHref, type CatalogCategory, type StorefrontSku } from "@/lib/storefront/catalog";
import { applyLiveInventory, applyLiveInventoryAll, getLiveInventory, type LiveInventory } from "@/lib/storefront/live-inventory";
import { REBATES, SITE } from "@/lib/site";
import { WARRANTY_DISCLOSURE } from "@/lib/brand-policy";
import { canMarket, getConsent, withdrawByToken } from "./consent";
import { homeownerLane } from "@/lib/finder/recommend";
import { homeownerAnswersSchema } from "@/lib/finder/questions";

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
export function emailShell(body: string, unsubscribeUrl?: string): string {
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
  // Counts live in catalog_products (QuickBooks sync), not in the build-time
  // catalog, whose quantities are all unknown. Without this overlay no SKU
  // could ever read as verified, so no alert could ever send.
  const live = await liveInventoryOrEmpty();

  const notify = async (email: string, skuId: string, unsubscribeUrl: string) => {
    const base = getStorefrontSku(skuId);
    const sku = base ? applyLiveInventory(base, live) : undefined;
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
      ),
      undefined,
      { kind: "back_in_stock", relatedType: "sku", relatedId: skuId }
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
  // A buyer who ordered is past planning.
  await stopPlanningSeries(email.trim().toLowerCase(), "ordered");
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
        ? "Still in stock in Newark (and what the rest of the project involves)"
        : "What the rest of your project involves",
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
    // No dollar figures and no warranty promise: neither had a source. The
    // install checklist is true for every California change-out.
    const heading = stockVerified
      ? "Still in stock, and what the rest of the project involves."
      : "What the rest of the project involves.";
    return `<h2 style="font-size: 20px; margin: 8px 0;">${heading}</h2>
      <p style="line-height: 1.6;">Besides the equipment, a California install usually involves a line set, a licensed contractor's labor, a mechanical permit and a HERS verification visit. Your installer quotes the labor and pulls the permit, and we can introduce one who works your area.</p>
      <p style="line-height: 1.6; color: dimgray; font-size: 13px;">${WARRANTY_DISCLOSURE}</p>${cartBlock}`;
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
    if (!canMarket(await getConsent(cart.email))) return false;
    await sendEmail(
      cart.email,
      STAGES[stage].subject(cartStockIsVerified(cart.items)),
      emailShell(stageBody(stage, cart.items, cart.subtotal), unsubscribeUrl),
      undefined,
      { kind: "abandoned_cart", relatedType: "cart" }
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

export type UnsubscribeKind = "stock" | "cart" | "category" | "marketing";

export async function unsubscribeByToken(kind: UnsubscribeKind, token: string): Promise<boolean> {
  if (kind === "marketing") {
    // Withdrawing consent ends every marketing flow for the address at once.
    const email = await withdrawByToken(token);
    if (email) await stopPlanningSeries(email, "unsubscribed");
    return Boolean(email);
  }
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase || !token) return false;
  const table = kind === "stock" ? "back_in_stock_subscriptions" : kind === "category" ? "category_stock_alerts" : "cart_snapshots";
  const { data } = await supabase
    .from(table)
    .update({ unsubscribed: true })
    .eq("unsubscribe_token", token)
    .select("id");
  return Boolean(data && data.length > 0);
}

/* ---------------------------------------------------------------- review request */

/**
 * Days between handover and the ask. Two weeks is deliberate: long enough that
 * a heat pump has actually been run through a few cycles and the reviewer has
 * something real to say, short enough that the purchase is still recent.
 */
const REVIEW_REQUEST_DELAY_DAYS = 14;

type DeliveredOrder = {
  id: string;
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string;
  productId: string | null;
  productTitle: string | null;
};

function reviewRequestBody(order: DeliveredOrder): string {
  const greeting = order.buyerName ? `Hi ${escapeHtml(order.buyerName.split(" ")[0])},` : "Hi,";
  const href = `${baseUrl()}/review?order=${encodeURIComponent(order.orderNumber)}${
    order.productId ? `&sku=${encodeURIComponent(order.productId)}` : ""
  }`;
  const subject = order.productTitle
    ? `the ${escapeHtml(order.productTitle)}`
    : "your order";

  return `<h2 style="font-size: 20px; margin: 8px 0;">How did ${subject} work out?</h2>
    <p style="line-height: 1.6;">${greeting}</p>
    <p style="line-height: 1.6;">You picked up order ${escapeHtml(order.orderNumber)} about two weeks ago. If it's installed and running, a couple of sentences about how it went would genuinely help the next person sizing the same system.</p>
    <p style="line-height: 1.6;">We publish reviews as written, good or bad, after a human reads them. We don't edit them and we don't offer anything in exchange.</p>
    <p style="margin-top: 20px;"><a href="${href}" style="background: green; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">Write a review</a></p>
    <p style="line-height: 1.6; margin-top: 20px;">If something went wrong instead, reply to this email or call ${SITE.phone} and we'll deal with it directly -- that's more useful to us than a review.</p>`;
}

/**
 * Ask for a review 14 days after handover (PLAN.md 2.3).
 *
 * Only orders that actually reached the customer qualify: 'delivered' or
 * 'picked_up', with fulfilled_at stamped by advance_fulfillment (migration
 * 022). Orders fulfilled before that migration have a null fulfilled_at and
 * are skipped on purpose -- back-filling would mail the entire order history
 * on the first run.
 *
 * review_request_sent_at is written whether or not the send succeeded, so a
 * failing address cannot put the dispatcher in a retry loop that hammers the
 * mail provider on every cron tick.
 *
 * `advanceDays` (testing only) pretends every order is that much older.
 */
export async function dispatchReviewRequests(advanceDays = 0): Promise<{ sent: number }> {
  const supabase = createServiceRoleSupabaseClient();
  // No in-memory fallback: unlike carts and stock alerts, this flow reads real
  // fulfilled orders. With no database there is nothing to ask about.
  if (!supabase) return { sent: 0 };

  const cutoff = new Date(
    Date.now() + advanceDays * 86_400_000 - REVIEW_REQUEST_DELAY_DAYS * 86_400_000
  ).toISOString();

  const { data: rows } = await supabase
    .from("sales_orders")
    .select("id, order_number, buyer_name, buyer_email, fulfilled_at")
    .in("fulfillment_status", ["delivered", "picked_up"])
    .is("review_request_sent_at", null)
    .not("buyer_email", "is", null)
    .not("fulfilled_at", "is", null)
    .lte("fulfilled_at", cutoff);

  if (!rows?.length) return { sent: 0 };

  let sent = 0;
  for (const row of rows) {
    // First line is the one we ask about. Multi-line orders are common but a
    // single, concrete question converts better than "review your 6 items".
    const { data: line } = await supabase
      .from("order_lines")
      .select("catalog_product_id, description")
      .eq("order_id", row.id)
      .not("catalog_product_id", "is", null)
      .limit(1)
      .maybeSingle();

    const productId = (line as { catalog_product_id: string | null } | null)?.catalog_product_id ?? null;
    const order: DeliveredOrder = {
      id: row.id,
      orderNumber: row.order_number,
      buyerName: row.buyer_name,
      buyerEmail: row.buyer_email,
      productId,
      productTitle: productId ? (getStorefrontSku(productId)?.title ?? null) : null,
    };

    try {
      await sendEmail(
        order.buyerEmail,
        order.productTitle ? `How's the ${order.productTitle} running?` : "How did your Summit order work out?",
        emailShell(reviewRequestBody(order)),
        undefined,
        { kind: "review_request", relatedType: "order" }
      );
      sent++;
    } catch (error) {
      console.error("[lifecycle] review request send failed", { orderId: order.id, error });
    }

    await supabase
      .from("sales_orders")
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq("id", order.id);
  }

  return { sent };
}

/* ---------------------------------------------------------------- shared */

async function liveInventoryOrEmpty(): Promise<LiveInventory> {
  try {
    return await getLiveInventory();
  } catch {
    return {};
  }
}

const DAY_MS = 86_400_000;

function button(href: string, label: string): string {
  return `<p style="margin-top: 20px;"><a href="${escapeHtml(href)}" style="background: green; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">${escapeHtml(label)}</a></p>`;
}

/* ------------------------------------------------- homeowner planning series */

/**
 * Day 0/1/3/7/14/30 for homeowners who ticked the marketing box in the finder
 * (docs/FINDER-AND-AUDIENCE-PLAN.md 4.2). Day 0 is the shortlist itself, sent
 * when the series starts, so a new row begins at stage 1.
 *
 * Copy is about installing, not price: what a permit and HERS visit involve,
 * ducted vs ductless for their answers, what to check about rebates, and an
 * installer introduction. No discounts, no dollar figures, no warranty claims.
 * Every send re-checks consent, and the series stops the moment the person
 * requests an installer, orders, or unsubscribes.
 */
export const PLANNING_SERIES_DAYS = [0, 1, 3, 7, 14, 30] as const;

type SeriesSegment = "homeowner_active" | "homeowner_researching";
type SeriesStopReason = "completed" | "unsubscribed" | "requested_installer" | "ordered" | "consent_withdrawn";
type SeriesRow = { email: string; sessionId: string | null; segment: SeriesSegment; stage: number; startedAt: number; stoppedAt: number | null };

const memSeries = new Map<string, SeriesRow>();

export async function startPlanningSeries(email: string, sessionId: string, segment: SeriesSegment): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    // ignoreDuplicates: one series per person. Opting in again does not restart it.
    const { error } = await supabase.from("planning_series").upsert(
      { email, finder_session_id: sessionId, segment, stage: 1, last_sent_at: new Date().toISOString() },
      { onConflict: "email", ignoreDuplicates: true }
    );
    if (!error) return;
    throw new Error("Could not save planning email subscription.");
  }
  if (!memSeries.has(email)) memSeries.set(email, { email, sessionId, segment, stage: 1, startedAt: Date.now(), stoppedAt: null });
}

export async function stopPlanningSeries(email: string, reason: SeriesStopReason): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    await supabase
      .from("planning_series")
      .update({ stopped_at: new Date().toISOString(), stop_reason: reason })
      .eq("email", email)
      .is("stopped_at", null);
  }
  const row = memSeries.get(email);
  if (row && !row.stoppedAt) row.stoppedAt = Date.now();
}

type SeriesContext = { lane: "ducted" | "ductless" | "either" };

function guide(slug: string, text: string): string {
  return `<a href="${baseUrl()}/guides/${slug}" style="color: black;">${escapeHtml(text)}</a>`;
}

/** Stage n (1-5) of the series: subject and body. Exported for tests. */
export function planningEmail(stage: number, context: SeriesContext): { subject: string; body: string } {
  switch (stage) {
    case 1:
      return {
        subject: "What the permit and HERS visit involve",
        body: `<h2 style="font-size: 20px; margin: 8px 0;">The two visits most people don't plan for.</h2>
          <p style="line-height: 1.6;">In California, replacing a condenser, coil, air handler or furnace needs a mechanical permit. Before the permit closes, a third-party HERS rater checks the work: refrigerant charge and airflow, and duct leakage on a ducted system.</p>
          <p style="line-height: 1.6;">Your installer pulls the permit and books the rater. When you compare installer quotes, ask whether each one includes the permit and the HERS visit.</p>
          <p style="line-height: 1.6;">${guide("bay-area-hvac-permits", "Bay Area HVAC permits")} · ${guide("california-title-24-hvac-changeouts", "Title 24 change-outs")}</p>`,
      };
    case 2:
      return context.lane === "ductless"
        ? {
            subject: "Ductless: what your answers point to",
            body: `<h2 style="font-size: 20px; margin: 8px 0;">Your answers point to ductless.</h2>
              <p style="line-height: 1.6;">A mini split conditions a room without ductwork: an outdoor unit, one or more indoor heads, and a refrigerant line set between them. Several rooms can share one multi-zone outdoor unit.</p>
              <p style="line-height: 1.6;">Where each indoor head goes, and how far the line set runs, decide most of the install. Your installer walks that with you.</p>
              ${button(`${baseUrl()}/products?category=mini-splits`, "Browse mini splits")}`,
          }
        : {
            subject: context.lane === "ducted" ? "Ducted: what your answers point to" : "Ducted or ductless?",
            body: `<h2 style="font-size: 20px; margin: 8px 0;">${context.lane === "ducted" ? "Your answers point to a ducted system." : "Ducted or ductless comes down to your ducts."}</h2>
              <p style="line-height: 1.6;">A ducted heat pump reuses the ducts you have: an outdoor unit, an indoor air handler or coil, and the existing duct runs. The condition of those ducts matters, because the HERS rater tests them for leakage.</p>
              <p style="line-height: 1.6;">Ask your installer to look at the ducts before quoting. If they are in poor shape, ductless can be the simpler job.</p>
              ${button(`${baseUrl()}/products?category=central-heat-pumps`, "Browse ducted heat pumps")}`,
          };
    case 3:
      return {
        subject: "Rebates: what to check before you buy",
        body: `<h2 style="font-size: 20px; margin: 8px 0;">Check rebates before the equipment is ordered.</h2>
          <ul style="padding-left: 18px; line-height: 1.6;">${REBATES.map((rebate) => `<li><strong style="font-weight: 500;">${escapeHtml(rebate.name)}.</strong> ${escapeHtml(rebate.detail)}</li>`).join("")}</ul>
          <p style="line-height: 1.6;">Many programs require an enrolled contractor and pre-approval, so the order of steps matters. We don't promise any rebate amount; the program confirms eligibility.</p>
          ${button(`${baseUrl()}/tools/rebate-lookup`, "Start a rebate check by ZIP")}`,
      };
    case 4:
      return {
        subject: "Ready to talk to a licensed installer?",
        body: `<h2 style="font-size: 20px; margin: 8px 0;">We can introduce an installer who works your area.</h2>
          <p style="line-height: 1.6;">Summit supplies the equipment; a licensed contractor sizes the job, pulls the permit and installs it. Tell us about the home and we'll introduce one, with your permission.</p>
          ${button(`${baseUrl()}/homeowners#homeowner-request`, "Get matched with an installer")}
          <p style="line-height: 1.6; color: dimgray; font-size: 13px;">${escapeHtml(WARRANTY_DISCLOSURE)}</p>`,
      };
    default:
      return {
        subject: "Still planning?",
        body: `<h2 style="font-size: 20px; margin: 8px 0;">Still planning your system?</h2>
          <p style="line-height: 1.6;">If the project is on hold, that's fine. This is the last planning email we'll send. If anything changed, the finder takes two minutes, or call or text the counter at <strong>${escapeHtml(SITE.phone)}</strong>.</p>
          ${button(`${baseUrl()}/finder`, "Run the finder again")}`,
      };
  }
}

async function seriesContext(sessionId: string | null): Promise<SeriesContext> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase || !sessionId) return { lane: "either" };
  const { data } = await supabase.from("finder_sessions").select("path, answers").eq("id", sessionId).maybeSingle();
  if (!data || data.path !== "homeowner") return { lane: "either" };
  const parsed = homeownerAnswersSchema.safeParse(data.answers);
  return { lane: parsed.success ? homeownerLane(parsed.data) : "either" };
}

/** Advance every due series by one email. `advanceDays` is for testing only. */
export async function dispatchPlanningSeries(advanceDays = 0): Promise<{ sent: number }> {
  const supabase = createServiceRoleSupabaseClient();
  const now = Date.now() + advanceDays * DAY_MS;
  const due = (row: SeriesRow) =>
    !row.stoppedAt && row.stage < PLANNING_SERIES_DAYS.length && row.startedAt + PLANNING_SERIES_DAYS[row.stage] * DAY_MS <= now;

  let rows: SeriesRow[];
  if (supabase) {
    const { data, error } = await supabase
      .from("planning_series")
      .select("email, finder_session_id, segment, stage, started_at, stopped_at")
      .is("stopped_at", null)
      .lt("stage", PLANNING_SERIES_DAYS.length)
      .limit(500);
    if (error) {
      console.warn("planning_series read failed (run migration 032?):", error.message);
      return { sent: 0 };
    }
    rows = (data ?? []).map((row) => ({
      email: String(row.email),
      sessionId: (row.finder_session_id as string | null) ?? null,
      segment: row.segment as SeriesSegment,
      stage: Number(row.stage),
      startedAt: new Date(String(row.started_at)).getTime(),
      stoppedAt: null,
    }));
  } else {
    rows = [...memSeries.values()];
  }

  let sent = 0;
  for (const row of rows.filter(due)) {
    if (supabase) {
      const [orders, requests] = await Promise.all([
        supabase.from("sales_orders").select("id").eq("buyer_email", row.email).eq("paid", true).limit(1),
        supabase.from("homeowner_requests").select("id").eq("email", row.email).limit(1),
      ]);
      if (orders.error || requests.error) throw new Error("Could not check planning stop conditions.");
      if (orders.data.length || requests.data.length) {
        await stopPlanningSeries(row.email, orders.data.length ? "ordered" : "requested_installer");
        continue;
      }
    }
    const consent = await getConsent(row.email);
    if (!canMarket(consent)) {
      await stopPlanningSeries(row.email, "consent_withdrawn");
      continue;
    }
    const email = planningEmail(row.stage, await seriesContext(row.sessionId));
    const unsubscribeUrl = `${baseUrl()}/api/unsubscribe?kind=marketing&token=${consent!.unsubscribeToken}`;
    try {
      const key = `planning-${createHash("sha256").update(row.email).digest("hex")}-${row.startedAt}-${row.stage}`;
      if (!await deliverOnce(key, row.email, email.subject, emailShell(email.body, unsubscribeUrl))) continue;
      sent++;
    } catch (error) {
      console.error("[lifecycle] planning email failed", { stage: row.stage, error });
      continue;
    }
    // Advance only after a confirmed send. Failed claims need staff review.
    const next = row.stage + 1;
    const finished = next >= PLANNING_SERIES_DAYS.length;
    if (supabase) {
      await supabase
        .from("planning_series")
        .update({
          stage: next,
          last_sent_at: new Date().toISOString(),
          ...(finished ? { stopped_at: new Date().toISOString(), stop_reason: "completed" } : {}),
        })
        .eq("email", row.email).eq("stage", row.stage).is("stopped_at", null);
    } else {
      row.stage = next;
      if (finished) row.stoppedAt = Date.now();
    }
  }
  return { sent };
}

/* ------------------------------------------------ contractor category alerts */

/**
 * "Tell me when 3-ton ducted heat pumps are in stock" (plan 4.3). Like a
 * single-SKU back-in-stock alert this is a service the person asked for, so it
 * is transactional. It fires only on counted stock, names each SKU once, and
 * sends at most once a day per subscription.
 */
export async function subscribeCategoryAlert(rawEmail: string, category: CatalogCategory, btu: number | null): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const { error } = await supabase
      .from("category_stock_alerts")
      .insert({ email, category, btu })
      .select("id")
      .maybeSingle();
    // 23505: already subscribed to this lane, which is the outcome they wanted.
    if (!error) return;
    if (error.code === "23505") {
      let query = supabase.from("category_stock_alerts").update({ unsubscribed: false }).eq("email", email).eq("category", category);
      query = btu === null ? query.is("btu", null) : query.eq("btu", btu);
      const { error: updateError } = await query;
      if (!updateError) return;
    }
    throw new Error("Could not save stock alert.");
  }
  memCategoryAlerts.set(`${email}|${category}|${btu ?? 0}`, { email, category, btu, notified: new Set(), lastNotifiedAt: 0 });
}

const memCategoryAlerts = new Map<string, { email: string; category: CatalogCategory; btu: number | null; notified: Set<string>; lastNotifiedAt: number }>();

export function categoryAlertMatches(skus: StorefrontSku[], category: CatalogCategory, btu: number | null, alreadyNotified: ReadonlySet<string>): StorefrontSku[] {
  return skus.filter(
    (sku) =>
      sku.category === category &&
      (btu === null || sku.btu === btu) &&
      sku.availabilityVerified &&
      sku.available > 0 &&
      !alreadyNotified.has(sku.id)
  );
}

export async function dispatchCategoryAlerts(): Promise<{ sent: number }> {
  const skus = applyLiveInventoryAll(getStorefrontSkus(), await liveInventoryOrEmpty());
  const supabase = createServiceRoleSupabaseClient();
  const dayAgo = Date.now() - DAY_MS;
  let sent = 0;

  const send = async (email: string, matches: StorefrontSku[], unsubscribeUrl: string, key: string) => {
    const rows = matches
      .map((sku) => `<li style="margin: 4px 0;"><a href="${baseUrl()}${productHref(sku)}" style="color: black;">${escapeHtml(sku.title)}</a> · <span style="font-family: monospace;">${escapeHtml(sku.sku)}</span> · ${sku.available} counted</li>`)
      .join("");
    return deliverOnce(
      key,
      email,
      matches.length === 1 ? `In stock in Newark: ${matches[0].title}` : `${matches.length} items you asked about are in stock in Newark`,
      emailShell(
        `<h2 style="font-size: 20px; margin: 8px 0;">In stock at the Newark counter.</h2>
         <ul style="padding-left: 18px; line-height: 1.6;">${rows}</ul>
         <p style="line-height: 1.6;">Counts come from the warehouse and move through the day. Call or text ${escapeHtml(SITE.phone)} to hold stock for will-call.</p>`,
        unsubscribeUrl
      )
    );
  };

  if (supabase) {
    const { data, error } = await supabase
      .from("category_stock_alerts")
      .select("id, email, category, btu, notified_skus, last_notified_at, unsubscribe_token")
      .eq("unsubscribed", false)
      .limit(1000);
    if (error) {
      console.warn("category_stock_alerts read failed (run migration 032?):", error.message);
      return { sent: 0 };
    }
    for (const row of data ?? []) {
      if (row.last_notified_at && new Date(String(row.last_notified_at)).getTime() > dayAgo) continue;
      const already = new Set<string>((row.notified_skus as string[] | null) ?? []);
      const matches = categoryAlertMatches(skus, row.category as CatalogCategory, (row.btu as number | null) ?? null, already);
      if (matches.length === 0) continue;
      const key = `category-${row.id}-${createHash("sha256").update(matches.map((sku) => sku.id).sort().join(",")).digest("hex")}`;
      if (!await send(String(row.email), matches, `${baseUrl()}/api/unsubscribe?kind=category&token=${row.unsubscribe_token}`, key)) continue;
      await supabase
        .from("category_stock_alerts")
        .update({ last_notified_at: new Date().toISOString(), notified_skus: [...already, ...matches.map((sku) => sku.id)] })
        .eq("id", row.id);
      sent++;
    }
    return { sent };
  }

  for (const alert of memCategoryAlerts.values()) {
    if (alert.lastNotifiedAt > dayAgo) continue;
    const matches = categoryAlertMatches(skus, alert.category, alert.btu, alert.notified);
    if (matches.length === 0) continue;
    if (!await send(alert.email, matches, `${baseUrl()}/api/unsubscribe`, `category-${createHash("sha256").update(`${alert.email}|${alert.category}|${alert.btu}|${matches.map((sku) => sku.id).join(",")}`).digest("hex")}`)) continue;
    for (const sku of matches) alert.notified.add(sku.id);
    alert.lastNotifiedAt = Date.now();
    sent++;
  }
  return { sent };
}

/* ------------------------------------------------------------ post-purchase */

/** Days after handover for each post-purchase message. */
export const WARRANTY_REMINDER_DAY = 7;
export const MAINTENANCE_EMAIL_DAY = 45;
/** Orders older than this window are skipped, so a first run never mails history. */
const POST_PURCHASE_WINDOW_DAYS = 14;

type FulfilledOrder = { id: string; orderNumber: string; email: string; skus: StorefrontSku[] };

async function fulfilledOrdersDue(column: "warranty_reminder_sent_at" | "maintenance_email_sent_at", afterDays: number, advanceDays: number): Promise<FulfilledOrder[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return [];
  const now = Date.now() + advanceDays * DAY_MS;
  const newest = new Date(now - afterDays * DAY_MS).toISOString();
  const oldest = new Date(now - (afterDays + POST_PURCHASE_WINDOW_DAYS) * DAY_MS).toISOString();
  const { data: orders, error } = await supabase
    .from("sales_orders")
    .select("id, order_number, buyer_email")
    .in("fulfillment_status", ["delivered", "picked_up"])
    .is(column, null)
    .not("buyer_email", "is", null)
    .lte("fulfilled_at", newest)
    .gte("fulfilled_at", oldest)
    .limit(200);
  if (error || !orders?.length) return [];
  const result: FulfilledOrder[] = [];
  for (const order of orders) {
    const { data: lines } = await supabase.from("order_lines").select("catalog_product_id").eq("order_id", order.id).not("catalog_product_id", "is", null);
    const skus = (lines ?? [])
      .map((line) => getStorefrontSku(String((line as { catalog_product_id: string }).catalog_product_id)))
      .filter((sku): sku is StorefrontSku => Boolean(sku));
    result.push({ id: String(order.id), orderNumber: String(order.order_number), email: String(order.buyer_email).toLowerCase(), skus });
  }
  return result;
}

/** Equipment on the order whose warranty term depends on registration. */
export function registrationReminders(skus: StorefrontSku[]): Array<{ title: string; days: number | null; sourceUrl: string }> {
  return skus
    .filter((sku) => sku.warranty?.registrationRequired && sku.warranty.sourceUrl)
    .map((sku) => ({
      title: sku.title,
      days: sku.warranty?.registrationWindowDays ?? null,
      sourceUrl: sku.warranty!.sourceUrl!,
    }));
}

/**
 * Day 7: register the warranty. Transactional -- it concerns equipment the
 * customer bought -- and sent only when a line's warranty actually requires
 * registration. Every term quoted comes from the catalog's warranty record.
 */
export async function dispatchWarrantyReminders(advanceDays = 0): Promise<{ sent: number }> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return { sent: 0 };
  let sent = 0;
  for (const order of await fulfilledOrdersDue("warranty_reminder_sent_at", WARRANTY_REMINDER_DAY, advanceDays)) {
    const reminders = registrationReminders(order.skus);
    if (reminders.length > 0) {
      const items = reminders
        .map((item) => `<li style="margin: 4px 0;"><strong style="font-weight: 500;">${escapeHtml(item.title)}</strong>: ${item.days ? `the published registration window is ${item.days} days after installation` : "check the manufacturer's registration deadline"}. <a href="${escapeHtml(item.sourceUrl)}" style="color: black;">Warranty terms</a></li>`)
        .join("");
      try {
        if (!await deliverOnce(
          `warranty-${order.id}`,
          order.email,
          "Register your equipment warranty",
          emailShell(`<h2 style="font-size: 20px; margin: 8px 0;">Check your equipment registration.</h2>
            <p style="line-height: 1.6;">Order ${escapeHtml(order.orderNumber)} includes equipment with published registration requirements:</p>
            <ul style="padding-left: 18px; line-height: 1.6;">${items}</ul>
            <p style="line-height: 1.6;">${escapeHtml(WARRANTY_DISCLOSURE)}</p>
            <p style="line-height: 1.6;">Registration usually needs the model and serial number from the unit's nameplate and the install date. Your installer can help. Questions: ${escapeHtml(SITE.phone)}.</p>`)
        )) continue;
        sent++;
      } catch (error) {
        console.error("[lifecycle] warranty reminder failed", { orderId: order.id, error });
        continue;
      }
    }
    await supabase.from("sales_orders").update({ warranty_reminder_sent_at: new Date().toISOString() }).eq("id", order.id);
  }
  return { sent };
}

/**
 * Day 45: upkeep and the accessories that go with it. Marketing, so it goes
 * only to buyers whose consent is current.
 */
export async function dispatchMaintenanceEmails(advanceDays = 0): Promise<{ sent: number }> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return { sent: 0 };
  let sent = 0;
  for (const order of await fulfilledOrdersDue("maintenance_email_sent_at", MAINTENANCE_EMAIL_DAY, advanceDays)) {
    const consent = await getConsent(order.email);
    if (canMarket(consent) && order.skus.some((sku) => sku.category !== "installation-supplies" && sku.category !== "line-sets")) {
      try {
        if (!await deliverOnce(
          `maintenance-${order.id}`,
          order.email,
          "Keeping your new system running well",
          emailShell(
            `<h2 style="font-size: 20px; margin: 8px 0;">A few minutes of upkeep goes a long way.</h2>
             <ul style="padding-left: 18px; line-height: 1.6;">
               <li>Clean or replace filters on the schedule in the owner's manual. Mini split indoor heads have washable filters.</li>
               <li>Keep the outdoor unit clear of leaves, plants and stored items.</li>
               <li>Make sure condensate drains run freely, especially before cooling season.</li>
               <li>Book the maintenance visit your installer or the manufacturer recommends.</li>
             </ul>
             ${button(`${baseUrl()}/products?category=installation-supplies`, "Pads, covers and installation supplies")}`,
            `${baseUrl()}/api/unsubscribe?kind=marketing&token=${consent!.unsubscribeToken}`
          )
        )) continue;
        sent++;
      } catch (error) {
        console.error("[lifecycle] maintenance email failed", { orderId: order.id, error });
        continue;
      }
    }
    await supabase.from("sales_orders").update({ maintenance_email_sent_at: new Date().toISOString() }).eq("id", order.id);
  }
  return { sent };
}
