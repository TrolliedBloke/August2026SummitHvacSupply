import { Store, Truck, PackageCheck, CreditCard, PauseCircle, Clock } from "lucide-react";
import { Container, Chip } from "@/components/ui";
import { Notice } from "@/components/state";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { createServerSupabase } from "@/lib/backend/supabase-ssr";
import { readFlash } from "@/lib/backend/admin-flash";
import { FULFILLMENT_STATUS_LABEL, type FulfillmentMethod } from "@/lib/backend/fulfillment";
import { fulfilmentBlock, fulfilmentQueue } from "@/lib/commerce/fulfilment-gate";
import { advanceAction, cancelAction, captureAction, refundHeldAction, releaseHoldAction } from "./actions";

export const metadata = { title: "Fulfillment Queue" };

type ReviewNote = { code: string; message: string; hold: boolean };

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  fulfillment_method: FulfillmentMethod | null;
  fulfillment_status: string;
  fulfillment_window: string | null;
  delivery_zip: string | null;
  delivery_address: string | null;
  buyer_name: string | null;
  buyer_company: string | null;
  total: number;
  paid: boolean;
  payment_mode: string | null;
  checkout_state: string | null;
  hold_reason: string | null;
  hold_detail: string | null;
  authorized_at: string | null;
  authorization_expires_at: string | null;
  install_acknowledgement: { review?: ReviewNote[]; pickupName?: string | null } | null;
  picked_up_by: string | null;
  order_lines: Array<{ description: string | null; quantity: number }>;
};

const METHOD_META: Record<FulfillmentMethod, { label: string; icon: React.ReactNode }> = {
  pickup: { label: "Will-call pickup", icon: <Store size={16} aria-hidden="true" /> },
  local_delivery: { label: "Local delivery", icon: <Truck size={16} aria-hidden="true" /> },
  freight: { label: "Freight", icon: <PackageCheck size={16} aria-hidden="true" /> },
};

const HOLD_LABEL: Record<string, string> = {
  paid_after_cancellation: "Paid after the order was cancelled",
  credit_limit: "Over the account's credit limit",
  compliance_review: "Compliance review",
  // Raised when ShipStation reports a shipment the order wasn't ready for (migration 042).
  shipped_without_payment: "Shipped before it was paid",
  shipped_after_cancellation: "Shipped after it was cancelled",
  shipped_while_on_hold: "Shipped while on hold",
};

/** What releasing the hold means the staff member has checked. */
const RELEASE_CONFIRMATION: Record<string, string> = {
  shipped_without_payment: "Payment is collected, or arranged on the account",
  shipped_after_cancellation: "The buyer has been contacted and payment is settled",
  shipped_while_on_hold: "The original hold reason is resolved",
};

/** Forward moves per method; the database refuses any the order isn't ready for. */
const NEXT: Record<FulfillmentMethod, { status: string; label: string }[]> = {
  pickup: [{ status: "ready_for_pickup", label: "Mark ready" }],
  local_delivery: [
    { status: "out_for_delivery", label: "Out for delivery" },
    { status: "delivered", label: "Mark delivered" },
  ],
  freight: [
    { status: "out_for_delivery", label: "Handed to carrier" },
    { status: "delivered", label: "Mark delivered" },
  ],
};

const currency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "n/a";

const inputCls = "min-h-10 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";
const buttonCls = "inline-flex min-h-10 items-center rounded-(--r-sm) border border-line bg-surface-1 px-3 text-sm font-medium text-ink-1 hover:bg-surface-2";
const primaryCls = "inline-flex min-h-10 items-center rounded-(--r-sm) bg-brand px-3 text-sm font-semibold text-brand-ink hover:bg-brand/90";

export default async function FulfillmentQueuePage() {
  const supabase = await createServerSupabase();
  const flash = await readFlash();
  let orders: OrderRow[] = [];

  if (supabase) {
    const { data } = await supabase
      .from("sales_orders")
      .select(
        "id, order_number, created_at, status, fulfillment_method, fulfillment_status, fulfillment_window, delivery_zip, delivery_address, buyer_name, buyer_company, total, paid, payment_mode, checkout_state, hold_reason, hold_detail, authorized_at, authorization_expires_at, install_acknowledgement, picked_up_by, order_lines(description, quantity)"
      )
      .not("fulfillment_method", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);
    orders = (data as OrderRow[] | null) ?? [];
  }

  const byQueue = (queue: ReturnType<typeof fulfilmentQueue>) => orders.filter((order) => fulfilmentQueue(order) === queue);
  const capture = byQueue("capture");
  const holds = byQueue("hold");
  const awaiting = byQueue("awaiting_payment").filter((order) => order.checkout_state !== "expired" && order.checkout_state !== "payment_failed");
  const ready = byQueue("ready");
  const methods: FulfillmentMethod[] = ["pickup", "local_delivery", "freight"];

  return (
    <Container className="py-10 lg:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Fulfillment queue</h1>
          <p className="mt-2 max-w-2xl text-ink-2">
            Card orders are only authorized at checkout. Confirm the stock is on the shelf, then charge. Nothing on hold or unpaid can be staged or handed over.
          </p>
        </div>
        <LiveRefresh />
      </div>

      {flash && (
        <Notice tone={flash.tone} role={flash.tone === "danger" ? "alert" : "status"} className="mt-6">
          {flash.text}
        </Notice>
      )}

      {!supabase && (
        <div className="mt-8 rounded-(--r-md) border border-dashed border-line bg-surface-2/40 p-10 text-center text-ink-2">
          Connect Supabase to see live checkout orders here.
        </div>
      )}

      {supabase && orders.length === 0 && (
        <div className="mt-8 rounded-(--r-md) border border-dashed border-line bg-surface-2/40 p-10 text-center text-ink-2">
          No fulfillment orders yet. They appear here the moment a customer checks out.
        </div>
      )}

      {capture.length > 0 && (
        <Section icon={<CreditCard size={16} aria-hidden="true" />} title="Confirm stock & charge" count={capture.length} hint="Check the shelf (stock lives in QuickBooks, so the counter may have sold it). The card hold lapses after about 7 days; it is released automatically a day before.">
          {capture.map((order) => (
            <OrderCard key={order.id} order={order}>
              <p className="text-xs text-ink-3">
                Authorized {when(order.authorized_at)} · hold lapses {when(order.authorization_expires_at)}
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <form action={captureAction} className="flex flex-col gap-2 rounded-(--r-sm) border border-line p-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <label className="flex items-start gap-2 text-sm text-ink-1">
                    <input type="checkbox" name="stockConfirmed" required className="mt-0.5 size-4.5 accent-[var(--green)]" />
                    Every item is on the shelf and set aside for this order
                  </label>
                  <button type="submit" className={`${primaryCls} self-start`}>
                    Charge {currency(Number(order.total))}
                  </button>
                </form>
                <CancelForm order={order} label="Can't fulfil: release the card hold" />
              </div>
            </OrderCard>
          ))}
        </Section>
      )}

      {holds.length > 0 && (
        <Section icon={<PauseCircle size={16} aria-hidden="true" />} title="On hold" count={holds.length} hint="Each one needs a named decision. Releasing records your name and reason.">
          {holds.map((order) => (
            <OrderCard key={order.id} order={order}>
              <Notice tone="warning" title={HOLD_LABEL[order.hold_reason ?? ""] ?? order.hold_reason}>
                {order.hold_detail}
              </Notice>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <form action={releaseHoldAction} className="flex flex-col gap-2 rounded-(--r-sm) border border-line p-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <label className="text-sm font-medium text-ink-1" htmlFor={`note-${order.id}`}>
                    Why it can proceed
                  </label>
                  <input id={`note-${order.id}`} name="note" required minLength={5} maxLength={300} className={inputCls} placeholder={order.hold_reason === "credit_limit" ? "Approved by owner; paid down balance" : "Confirmed with buyer"} />
                  <label className="flex items-start gap-2 text-sm text-ink-1">
                    <input type="checkbox" name="stockConfirmed" required className="mt-0.5 size-4.5 accent-[var(--green)]" />
                    {RELEASE_CONFIRMATION[order.hold_reason ?? ""] ?? "The stock is on the shelf for this order"}
                  </label>
                  <button type="submit" className={`${buttonCls} self-start`}>
                    Release hold
                  </button>
                </form>
                {order.paid ? (
                  <form action={refundHeldAction} className="flex flex-col gap-2 rounded-(--r-sm) border border-line p-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <label className="text-sm font-medium text-ink-1" htmlFor={`refund-${order.id}`}>
                      Won&apos;t fulfil: refund {currency(Number(order.total))} in full
                    </label>
                    <input id={`refund-${order.id}`} name="reason" required minLength={5} maxLength={500} className={inputCls} placeholder="Reason, sent to the buyer" />
                    <button type="submit" className={`${buttonCls} self-start`}>
                      Refund in full
                    </button>
                  </form>
                ) : order.hold_reason?.startsWith("shipped_") ? (
                  <p className="rounded-(--r-sm) border border-line p-3 text-sm text-ink-2">
                    It has already shipped, so it can&apos;t be cancelled here. Collect payment or arrange its return with the buyer, then release the hold.
                  </p>
                ) : (
                  <CancelForm order={order} label="Won't fulfil: cancel the order" />
                )}
              </div>
            </OrderCard>
          ))}
        </Section>
      )}

      {ready.length > 0 &&
        methods.map((method) => {
          const group = ready.filter((order) => order.fulfillment_method === method);
          if (group.length === 0) return null;
          return (
            <Section key={method} icon={METHOD_META[method].icon} title={`Ready: ${METHOD_META[method].label}`} count={group.length}>
              {group.map((order) => (
                <OrderCard key={order.id} order={order}>
                  <div className="flex flex-wrap items-end gap-2">
                    {NEXT[method]
                      .filter((step) => step.status !== order.fulfillment_status)
                      .map((step) => (
                        <form key={step.status} action={advanceAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="status" value={step.status} />
                          <button type="submit" className={buttonCls}>
                            {step.label}
                          </button>
                        </form>
                      ))}
                    {method === "pickup" && (
                      <form action={advanceAction} className="flex flex-wrap items-end gap-2 rounded-(--r-sm) border border-line p-2">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="status" value="picked_up" />
                        <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
                          Collected by
                          <input name="collectedBy" required maxLength={200} defaultValue={order.install_acknowledgement?.pickupName ?? order.buyer_name ?? ""} className={`${inputCls} w-52`} />
                        </label>
                        <label className="flex min-h-10 items-center gap-2 text-sm text-ink-1">
                          <input type="checkbox" name="idChecked" required className="size-4.5 accent-[var(--green)]" />
                          Photo ID or company PO checked
                        </label>
                        <button type="submit" className={primaryCls}>
                          Hand over
                        </button>
                      </form>
                    )}
                  </div>
                </OrderCard>
              ))}
            </Section>
          );
        })}

      {awaiting.length > 0 && (
        <Section icon={<Clock size={16} aria-hidden="true" />} title="Waiting for payment" count={awaiting.length} hint="Nothing to do yet. These can't be staged until they are paid or invoiced.">
          {awaiting.map((order) => (
            <OrderCard key={order.id} order={order}>
              <p className="text-xs text-ink-3">{fulfilmentBlock(order)}</p>
            </OrderCard>
          ))}
        </Section>
      )}
    </Container>
  );
}

function Section({ icon, title, count, hint, children }: { icon: React.ReactNode; title: string; count: number; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">{icon}</span>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink-1">{title}</h2>
        <Chip tone="neutral">{count}</Chip>
      </div>
      {hint && <p className="mt-1 max-w-3xl text-sm text-ink-3">{hint}</p>}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function OrderCard({ order, children }: { order: OrderRow; children: React.ReactNode }) {
  const review = (order.install_acknowledgement?.review ?? []).filter((note) => !note.hold);
  return (
    <article className="rounded-(--r-md) border border-line bg-surface-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-ink-1">{order.order_number}</p>
          <p className="text-sm text-ink-2">
            {order.buyer_name ?? "Account order"}
            {order.buyer_company ? ` · ${order.buyer_company}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="tnum text-sm font-semibold text-ink-1">{currency(Number(order.total))}</span>
          <Chip tone={order.paid ? "eco" : "copper"}>{order.paid ? "Paid" : order.payment_mode === "net_terms" ? "Net terms" : order.checkout_state === "authorized" ? "Authorized" : "Unpaid"}</Chip>
          <Chip tone="neutral">{FULFILLMENT_STATUS_LABEL[order.fulfillment_status] ?? order.fulfillment_status}</Chip>
        </div>
      </div>
      <ul className="mt-2 text-sm text-ink-2">
        {order.order_lines.map((line, index) => (
          <li key={index}>
            {line.quantity} × {line.description}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink-3">
        {order.fulfillment_window ?? "No window"}
        {order.delivery_address ? ` · ${order.delivery_address}` : order.delivery_zip ? ` · ZIP ${order.delivery_zip}` : ""}
        {order.install_acknowledgement?.pickupName ? ` · Collector named at checkout: ${order.install_acknowledgement.pickupName}` : ""}
      </p>
      {review.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-state-warning-ink">
          {review.map((note, index) => (
            <li key={index}>{note.message}</li>
          ))}
        </ul>
      )}
      <div className="mt-3">{children}</div>
    </article>
  );
}

function CancelForm({ order, label }: { order: OrderRow; label: string }) {
  return (
    <form action={cancelAction} className="flex flex-col gap-2 rounded-(--r-sm) border border-line p-3">
      <input type="hidden" name="orderId" value={order.id} />
      <label className="text-sm font-medium text-ink-1" htmlFor={`cancel-${order.id}`}>
        {label}
      </label>
      <input id={`cancel-${order.id}`} name="reason" required minLength={5} maxLength={500} className={inputCls} placeholder="Reason, sent to the buyer" />
      <button type="submit" className={`${buttonCls} self-start`}>
        Cancel order
      </button>
    </form>
  );
}
