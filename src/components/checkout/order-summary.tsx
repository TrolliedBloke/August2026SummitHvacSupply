import type { OrderConfirmation } from "@/lib/order-confirmation";

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const LINE_STATUS: Record<string, string> = {
  pending: "Being prepared",
  ready: "Ready",
  partial: "Partly ready",
  backordered: "Backordered",
  fulfilled: "Delivered / picked up",
  cancelled: "Cancelled",
};
const METHOD: Record<string, string> = { pickup: "Will-call pickup, Newark", local_delivery: "Local delivery", freight: "Freight" };

/** The order's lines, fulfillment and totals -- identical on the confirmation page and the receipt. */
export function OrderSummary({ confirmation }: { confirmation: OrderConfirmation }) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-3">Fulfillment</dt>
          <dd className="text-ink-1">
            {confirmation.method ? METHOD[confirmation.method] : "Confirmed by email"}
            {confirmation.windowLabel && <span className="block text-ink-2">{confirmation.windowLabel}</span>}
            {confirmation.address && <span className="block text-ink-2">{confirmation.address}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Contact</dt>
          <dd className="text-ink-1">
            {confirmation.contact.name ?? "—"}
            {confirmation.contact.email && <span className="block text-ink-2">{confirmation.contact.email}</span>}
          </dd>
        </div>
      </dl>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Items on this order</caption>
        <thead>
          <tr className="border-b border-line text-ink-3">
            <th scope="col" className="py-2 pr-3 font-normal">Item</th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">Qty</th>
            <th scope="col" className="py-2 text-right font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {confirmation.lines.map((line) => (
            <tr key={`${line.sku}-${line.title}`} className="border-b border-line align-top">
              <td className="py-2 pr-3">
                <span className="block font-medium text-ink-1">{line.title}</span>
                <span className="part-number block text-xs text-ink-3">{line.sku}</span>
                <span className="mt-0.5 block text-xs text-ink-2">{LINE_STATUS[line.status] ?? line.status}</span>
              </td>
              <td className="tnum py-2 pr-3 text-right">{line.qty}</td>
              <td className="tnum py-2 text-right">{usd(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-ink-2">
          <tr>
            <th scope="row" colSpan={2} className="pt-3 text-right font-normal">Subtotal</th>
            <td className="tnum pt-3 text-right">{usd(confirmation.totals.subtotal)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={2} className="text-right font-normal">{confirmation.method === "local_delivery" ? "Delivery" : "Fulfillment"}</th>
            <td className="tnum text-right">{confirmation.totals.fee ? usd(confirmation.totals.fee) : "Free"}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={2} className="text-right font-normal">Tax</th>
            <td className="tnum text-right">{confirmation.payment === "invoiced" ? "On invoice" : usd(confirmation.totals.tax)}</td>
          </tr>
          <tr className="text-base font-semibold text-ink-1">
            <th scope="row" colSpan={2} className="pt-2 text-right">Total</th>
            <td className="tnum pt-2 text-right">{usd(confirmation.totals.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
