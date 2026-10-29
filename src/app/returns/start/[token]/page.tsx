import Link from "next/link";
import { Container } from "@/components/ui";
import { Notice } from "@/components/state";
import { StartReturnForm } from "@/components/returns/start-return-form";
import { loadGuestReturnLines } from "@/lib/backend/returns";

export const metadata = { title: "Start a return", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** A guest buyer's return, from the signed link emailed to the order's address. */
export default async function GuestReturnPage({ params, searchParams }: PageProps<"/returns/start/[token]">) {
  const { token } = await params;
  const { line: selected } = (await searchParams) as { line?: string };
  const order = await loadGuestReturnLines(token);

  if (!order) {
    return (
      <Container className="py-12 lg:py-16">
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-semibold text-ink-1">This link has expired</h1>
          <Notice tone="info" className="mt-6">
            Return links work for 3 days. <Link href="/returns/start" className="font-medium underline underline-offset-4">Request a new one</Link>, or call the counter.
          </Notice>
        </div>
      </Container>
    );
  }
  const line = order.lines.find((entry) => entry.lineId === selected);
  const base = `/returns/start/${encodeURIComponent(token)}`;

  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink-1">Return items from order {order.orderNumber}</h1>
        {line ? (
          <section className="mt-6 rounded-(--r-md) border border-line bg-surface-1 p-6">
            <Link href={base} className="text-sm text-ink-3 underline underline-offset-4">
              All items
            </Link>
            <h2 className="mt-2 text-lg font-semibold text-ink-1">{line.description}</h2>
            <div className="mt-4">
              {line.openRma ? (
                <Notice tone="info">This item already has an open return ({line.openRma}).</Notice>
              ) : line.returnable === 0 ? (
                <Notice tone="info">Everything on this line has already been returned.</Notice>
              ) : (
                <StartReturnForm line={line} endpoint="/api/returns/guest" token={token} />
              )}
            </div>
          </section>
        ) : (
          <ul className="mt-6 divide-y divide-line rounded-(--r-md) border border-line bg-surface-1">
            {order.lines.map((entry) => (
              <li key={entry.lineId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink-1">{entry.description}</p>
                  <p className="text-sm text-ink-3">
                    {entry.quantity} ordered{entry.openRma ? ` · return ${entry.openRma} open` : ""}
                  </p>
                </div>
                <Link href={`${base}?line=${entry.lineId}`} className="inline-flex min-h-11 items-center rounded-(--r-sm) border border-line px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
                  Return this
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
