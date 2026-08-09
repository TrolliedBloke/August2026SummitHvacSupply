"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, PackageCheck, Store, Truck } from "lucide-react";
import { Container } from "@/components/ui";
import { StripePayment } from "@/components/stripe-payment";
import { useQuote } from "@/components/quote-context";
import type { CheckoutStatus } from "@/lib/backend/checkout-state";

function currency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function ConfirmationPage() {
  return <React.Suspense fallback={<LoadingState />}><ConfirmationInner /></React.Suspense>;
}

function ConfirmationInner() {
  const token = useSearchParams().get("token") ?? "";
  const { clear } = useQuote();
  const [order, setOrder] = React.useState<CheckoutStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const clearedRef = React.useRef(false);

  const load = React.useCallback(async () => {
    if (!token) {
      setError("This confirmation link is incomplete.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/checkout/status?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Order status unavailable");
      setOrder(data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order status unavailable");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  React.useEffect(() => {
    if (order?.checkoutState !== "payment_pending") return;
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [load, order?.checkoutState]);
  React.useEffect(() => {
    if (!clearedRef.current && (order?.checkoutState === "paid" || order?.checkoutState === "confirmed")) {
      clearedRef.current = true;
      clear();
      sessionStorage.removeItem("summit-last-order");
    }
  }, [clear, order?.checkoutState]);

  if (loading) return <LoadingState />;
  if (error || !order) return <UnavailableState message={error ?? "Order status unavailable"} onRetry={() => { setLoading(true); void load(); }} />;

  const complete = order.checkoutState === "paid" || order.checkoutState === "confirmed";
  const failed = order.checkoutState === "payment_failed" || order.checkoutState === "expired";

  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          {complete ? <CheckCircle2 size={28} className="text-eco" /> : failed ? <AlertCircle size={28} className="text-danger" /> : <Clock3 size={28} className="text-brand" />}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-1">
            {order.checkoutState === "paid" ? "Payment received" : order.checkoutState === "confirmed" ? "Order confirmed" : failed ? "Payment not completed" : "Payment pending"}
          </h1>
        </div>
        <p className="mt-2 text-ink-2">
          Order <span className="font-mono font-semibold text-ink-1">{order.orderNumber}</span>. {complete ? "Your order is confirmed." : failed ? "Your cart is still available so you can try again." : "Inventory is reserved while payment is completed."}
        </p>

        {order.checkoutState === "payment_pending" && order.payment === "card" && order.clientSecret && (
          <div className="mt-8 rounded-(--r-md) border border-line bg-surface-1 p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-lg font-semibold text-ink-1">Pay {currency(order.total)}</h2>
            <StripePayment clientSecret={order.clientSecret} confirmationToken={token} />
          </div>
        )}

        {order.checkoutState === "confirmed" && order.payment === "net_terms" && <NextStep icon={<Store size={18} />} title="Invoiced to your account" body={`${currency(order.total)} on net terms. Your confirmed order is ready for staging.`} />}
        {order.checkoutState === "confirmed" && order.payment === "freight_quote" && <NextStep icon={<PackageCheck size={18} />} title="Freight quote on the way" body={`We'll email a freight quote for your ${currency(order.subtotal)} order before any charge.`} />}
        {order.checkoutState === "paid" && <NextStep icon={<Truck size={18} />} title="We're staging your order" body="You'll get an email with your confirmed pickup or delivery window." />}

        <div className="mt-8 flex flex-wrap gap-3">
          {failed && <Link href="/checkout" className="inline-flex h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">Return to checkout</Link>}
          <Link href="/products" className="inline-flex h-11 items-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1">Keep shopping</Link>
          {complete && <Link href="/portal" className="inline-flex h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">View in portal</Link>}
        </div>
      </div>
    </Container>
  );
}

function LoadingState() {
  return <Container className="py-16"><div className="mx-auto flex max-w-xl items-center gap-3" aria-live="polite"><LoaderCircle className="animate-spin text-brand" /><p className="text-ink-2">Confirming your order securely…</p></div></Container>;
}

function UnavailableState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Container className="py-16"><div className="mx-auto max-w-xl rounded-(--r-md) border border-line bg-surface-1 p-7"><h1 className="font-display text-2xl font-semibold text-ink-1">Order status unavailable</h1><p className="mt-2 text-sm text-ink-2">{message}</p><button type="button" onClick={onRetry} className="mt-5 h-11 rounded-(--r-sm) bg-brand px-4 text-sm font-semibold text-brand-ink">Try again</button></div></Container>;
}

function NextStep({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="mt-8 flex gap-4 rounded-(--r-md) border border-line bg-surface-1 p-6"><span className="grid size-10 shrink-0 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">{icon}</span><div><h2 className="font-display text-base font-semibold text-ink-1">{title}</h2><p className="mt-1 text-sm text-ink-2">{body}</p></div></div>;
}
