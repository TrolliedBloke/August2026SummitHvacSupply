"use client";

import * as React from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

/* Card payment step. Mounts Stripe's PaymentElement against the PaymentIntent
   created at checkout, and confirms it. Only used for guest/retail card orders;
   trade accounts go to net terms and never see this. */

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!pk) return null;
  if (!stripePromise) stripePromise = loadStripe(pk);
  return stripePromise;
}

function PayForm({ confirmationToken }: { confirmationToken: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/confirmation?token=${encodeURIComponent(confirmationToken)}`,
      },
    });
    if (error) {
      setError(error.message ?? "Payment failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4">
      <PaymentElement />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="mt-5 flex h-12 w-full items-center justify-center rounded-(--r-sm) bg-brand text-sm font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-50"
      >
        {submitting ? "Processing…" : "Pay now"}
      </button>
    </form>
  );
}

export function StripePayment({
  clientSecret,
  confirmationToken,
}: {
  clientSecret: string;
  confirmationToken: string;
}) {
  const promise = getStripePromise();
  if (!promise) {
    return (
      <p className="mt-4 rounded-(--r-sm) border border-line bg-surface-2 p-4 text-sm text-ink-2">
        Card payment is not configured (set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY). Your
        order is placed; staff will follow up to collect payment.
      </p>
    );
  }
  return (
    <Elements stripe={promise} options={{ clientSecret, appearance: { theme: "flat" } }}>
      <PayForm confirmationToken={confirmationToken} />
    </Elements>
  );
}
