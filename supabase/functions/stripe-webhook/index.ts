// Supabase Edge Function (Deno). Deploy:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
//
// Then point a Stripe webhook at:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
//
// Non-negotiables enforced here:
//  1) Verify the Stripe signature on every request (reject unsigned/forged POSTs).
//  2) Idempotency: apply_payment dedupes on the Stripe event id, so retries
//     never double-count.
import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";

/**
 * Secrets are pasted into a dashboard by hand, and a copied line brings its
 * newline with it. A trailing "\n" on the signing secret makes every signature
 * check fail with "Invalid signature" -- indistinguishable from a forged
 * request, and it cost a long debugging session here. None of these values can
 * legitimately contain surrounding whitespace, so trim them all.
 *
 * Note the failure is silent on the Stripe key: `new Stripe(k)` does not
 * validate the key, so a whitespace-damaged key constructs happily and only
 * fails later at the first API call.
 */
function env(name: string): string {
  const raw = Deno.env.get(name);
  if (!raw?.trim()) throw new Error(`${name} is not set`);
  return raw.trim();
}

const stripe = new Stripe(env("STRIPE_SECRET_KEY"));
const webhookSecret = env("STRIPE_WEBHOOK_SECRET");

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

/**
 * Refund and dispute events carry a payment_intent reference, but the order and
 * invoice ids live in that PaymentIntent's metadata -- the same metadata the
 * checkout path sets when it creates the intent. Resolving through the
 * PaymentIntent rather than the Charge keeps one source of truth for both.
 */
async function resolveTargets(
  paymentIntent: string | Stripe.PaymentIntent | null
): Promise<{ orderId?: string; invoiceId?: string }> {
  if (!paymentIntent) return {};

  const pi =
    typeof paymentIntent === "string"
      ? await stripe.paymentIntents.retrieve(paymentIntent)
      : paymentIntent;
  const metadata: Record<string, string> = pi.metadata ?? {};

  return {
    orderId: metadata.order_id || undefined,
    invoiceId: metadata.invoice_id || undefined,
  };
}

Deno.serve(async (request) => {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await request.text();

  let event: Stripe.Event;
  try {
    // Async variant uses Web Crypto (required in Deno).
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const invoiceId = pi.metadata?.invoice_id;
    const orderId = pi.metadata?.order_id;

    // Storefront checkout pays at the ORDER level (no invoice yet). Mark the
    // order paid, idempotently on the Stripe event id.
    if (orderId && !invoiceId) {
      const { error } = await supabase.rpc("mark_order_paid", {
        p_order_id: orderId,
        p_amount: pi.amount_received / 100,
        p_stripe_event_id: event.id,
      });
      if (error) {
        console.error("mark_order_paid failed:", error.message);
        return new Response("Order update failed", { status: 500 });
      }
      const { data: order } = await supabase.from("sales_orders").select("buyer_email").eq("id", orderId).single();
      if (order?.buyer_email) {
        await supabase.from("cart_snapshots").update({ completed_at: new Date().toISOString() }).eq("email", order.buyer_email.toLowerCase());
      }
    }

    if (invoiceId) {
      const { error } = await supabase.rpc("apply_payment", {
        p_invoice_id: invoiceId,
        p_amount: pi.amount_received / 100,
        p_method: "stripe",
        p_reference: pi.id,
        p_stripe_event_id: event.id, // dedupe key
      });
      if (error) {
        console.error("apply_payment failed:", error.message);
        return new Response("Ledger update failed", { status: 500 });
      }
      // Best-effort receipt; do not fail the webhook if email is down.
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-receipt`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ invoiceId }),
        });
      } catch {
        /* ignore */
      }
    }
  }

  // A refund issued from the Stripe dashboard used to hit nothing at all, so
  // the ledger kept showing money the customer no longer had. Reverse it.
  //
  // Keyed on refund.created, not charge.refunded, deliberately. charge.refunded
  // reports a cumulative amount_refunded and (verified against the API) does not
  // embed the refunds list, so recovering a single refund's delta means listing
  // refunds -- which returns the newest one and therefore mis-attributes two
  // partial refunds issued in quick succession. refund.created delivers the one
  // refund that actually happened, with its own id and amount.
  if (event.type === "refund.created") {
    const refund = event.data.object as Stripe.Refund;

    // A refund can fail after creation; only succeeded money has left.
    if (refund.status !== "succeeded") {
      return new Response(JSON.stringify({ received: true, skipped: refund.status }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { orderId, invoiceId } = await resolveTargets(refund.payment_intent);

    if (invoiceId) {
      const { error } = await supabase.rpc("reverse_payment", {
        p_invoice_id: invoiceId,
        p_amount: refund.amount / 100,
        p_method: "stripe_refund",
        p_reference: refund.id,
        p_stripe_event_id: refund.id, // per-refund, not per-event: see migration 020
      });
      if (error) {
        console.error("reverse_payment failed:", error.message);
        return new Response("Ledger reversal failed", { status: 500 });
      }
    } else if (orderId) {
      const { error } = await supabase.rpc("reverse_order_payment", {
        p_order_id: orderId,
        p_amount: refund.amount / 100,
        p_stripe_event_id: refund.id,
      });
      if (error) {
        console.error("reverse_order_payment failed:", error.message);
        return new Response("Order reversal failed", { status: 500 });
      }
    }
  }

  // Disputes hold the money rather than returning it, and carry an evidence
  // deadline. Record them for staff instead of touching the ledger.
  if (event.type.startsWith("charge.dispute.")) {
    const dispute = event.data.object as Stripe.Dispute;
    const { orderId, invoiceId } = await resolveTargets(dispute.payment_intent);

    const { error } = await supabase.rpc("record_payment_dispute", {
      p_stripe_dispute_id: dispute.id,
      p_payment_intent_id:
        typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id ?? null,
      p_amount: dispute.amount / 100,
      p_reason: dispute.reason,
      p_status: dispute.status,
      p_evidence_due_by: dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
        : null,
      p_order_id: orderId ?? null,
      p_invoice_id: invoiceId ?? null,
      p_stripe_event_id: event.id,
    });
    if (error) {
      console.error("record_payment_dispute failed:", error.message);
      return new Response("Dispute record failed", { status: 500 });
    }
  }

  if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.order_id;
    if (orderId) {
      const { error } = await supabase.rpc("release_checkout_order", {
        p_order_id: orderId,
        p_state: "payment_failed",
      });
      if (error) {
        console.error("release_checkout_order failed:", error.message);
        return new Response("Order release failed", { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
