import Link from "next/link";
import { Container } from "@/components/ui";
import { Notice } from "@/components/state";
import { StartReturnForm } from "@/components/returns/start-return-form";
import { loadReturnableLines } from "@/lib/backend/returns";

export const metadata = { title: "Start a return", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Start a return from your own order lines. The order, SKU and returnable
 * quantity come from the order; the policy questions are the same rules the
 * public checker uses, re-run on the server when the RMA is created.
 */
export default async function StartReturnPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const { line: selected } = await searchParams;
  const { lines, available } = await loadReturnableLines();
  const line = lines.find((entry) => entry.lineId === selected);

  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink-1">Start a return</h1>
        <p className="mt-2 text-sm text-ink-2">
          Choose the item from your orders. See the <Link href="/returns" className="underline underline-offset-4">returns policy</Link> for the full terms.
        </p>
        {!available && (
          <Notice tone="warning" className="mt-6" title="Orders are unavailable right now">
            Call the counter to start a return.
          </Notice>
        )}
        {available && lines.length === 0 && (
          <Notice tone="info" className="mt-6" title="No orders on this account">
            Ordered without an account, or by phone? <Link href="/contact?topic=returns" className="font-medium underline underline-offset-4">Contact the counter</Link> with your order number.
          </Notice>
        )}
        {line ? (
          <section className="mt-6 rounded-(--r-md) border border-line bg-surface-1 p-6">
            <p className="text-sm text-ink-3">Order {line.orderNumber}</p>
            <h2 className="mt-1 text-lg font-semibold text-ink-1">{line.description}</h2>
            <div className="mt-4">
              {line.openRma ? (
                <Notice tone="info">This line already has an open return ({line.openRma}).</Notice>
              ) : line.returnable === 0 ? (
                <Notice tone="info">Everything on this line has already been returned.</Notice>
              ) : (
                <StartReturnForm line={line} />
              )}
            </div>
          </section>
        ) : (
          lines.length > 0 && (
            <ul className="mt-6 divide-y divide-line rounded-(--r-md) border border-line bg-surface-1">
              {lines.map((entry) => (
                <li key={entry.lineId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-1">{entry.description}</p>
                    <p className="text-sm text-ink-3">
                      Order {entry.orderNumber} · {entry.quantity} ordered{entry.openRma ? ` · return ${entry.openRma} open` : ""}
                    </p>
                  </div>
                  <Link href={`/portal/returns/new?line=${entry.lineId}`} className="inline-flex min-h-11 items-center rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
                    Return this
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Container>
  );
}
