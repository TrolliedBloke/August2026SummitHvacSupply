import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { OrderSummary } from "@/components/checkout/order-summary";
import { PrintButton } from "@/components/checkout/print-button";
import { getOrderConfirmation } from "@/lib/backend/checkout";
import { verifyOrderToken } from "@/lib/backend/order-token";
import { SITE } from "@/lib/site";

export const metadata = { title: "Receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAYMENT_LABEL = { pending: "Payment pending", authorized: "Card authorized, not yet charged", paid: "Paid by card", failed: "Not paid", invoiced: "Invoiced on net terms", quoted: "Freight quote pending" } as const;

/**
 * The canonical receipt, from the same confirmation DTO as the confirmation
 * page, behind the same unguessable signed token. Prints cleanly.
 */
export default async function ReceiptPage({ searchParams }: PageProps<"/checkout/receipt">) {
  const { token } = await searchParams;
  const orderId = typeof token === "string" ? verifyOrderToken(token) : null;
  if (!orderId) notFound();
  const confirmation = await getOrderConfirmation(orderId);
  if (!confirmation) notFound();

  return (
    <Container className="py-10 print:py-0">
      <div className="mx-auto max-w-2xl rounded-(--r-md) border border-line bg-surface-1 p-8 print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink-3">{SITE.name}</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink-1">Receipt</h1>
            <p className="part-number mt-1 text-sm text-ink-2">Order {confirmation.orderNumber}</p>
            {confirmation.placedAt && <p className="text-sm text-ink-2">{new Date(confirmation.placedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT</p>}
          </div>
          <PrintButton />
        </div>
        <p className="mt-4 text-sm font-medium text-ink-1">{PAYMENT_LABEL[confirmation.payment]}</p>
        <div className="mt-6">
          <OrderSummary confirmation={confirmation} />
        </div>
        <p className="mt-8 text-xs leading-5 text-ink-3">
          {SITE.address.full} · {SITE.phone} · {SITE.email}
        </p>
      </div>
    </Container>
  );
}
