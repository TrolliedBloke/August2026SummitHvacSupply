import Link from "next/link";
import { ArrowRight, Boxes, ClipboardList, DollarSign, FileText, ShieldAlert } from "lucide-react";
import { BuyAgainButton } from "@/components/buy-again";
import { SavedListsPanel } from "@/components/saved-lists";
import { Chip, LinkButton } from "@/components/ui";
import type { PortalOverview } from "@/lib/backend/services";

export function PortalDashboard({ overview }: { overview: PortalOverview }) {
  const invoiceBalance = overview.invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const caseCount = overview.rmas.length + overview.warrantyClaims.length + overview.rebateCases.length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="eco">{overview.role}</Chip>
            <Chip tone="neutral">{overview.priceTier} pricing</Chip>
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
            {overview.account.name}
          </h1>
          <p className="mt-2 max-w-2xl text-ink-2">
            Signed in as {overview.userName}. This portal view is scoped to the role and account shown above.
          </p>
        </div>
        <LinkButton href="/quote" variant="secondary">
          Build quote request
          <ArrowRight size={16} />
        </LinkButton>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<ClipboardList size={18} />} label="Quotes" value={overview.quotes.length.toString()} />
        <Metric icon={<Boxes size={18} />} label="Orders" value={overview.orders.length.toString()} />
        <Metric icon={<DollarSign size={18} />} label="Balance" value={currency(invoiceBalance)} />
        <Metric icon={<ShieldAlert size={18} />} label="Open cases" value={caseCount.toString()} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Recommended stock" action="Live SKU availability">
          <div className="grid gap-3">
            {overview.recommendedSkus.map((sku) => (
              <div key={sku.id} className="flex items-center justify-between gap-4 rounded-(--r-sm) border border-line bg-surface-2/60 p-3">
                <div>
                  <p className="text-sm font-semibold text-ink-1">{sku.title}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-3">
                    {sku.sku} · {sku.btu.toLocaleString()} BTU · {sku.seriesName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum font-mono text-sm font-semibold text-ink-1">{currency(sku.dealerPrice)}</p>
                  <p className="text-xs text-ink-3">{sku.available} available</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Tasks & support" action="Next actions">
          <div className="space-y-3">
            {[...overview.tasks, ...overview.rmas, ...overview.warrantyClaims, ...overview.rebateCases].slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-(--r-sm) border border-line bg-surface-2/60 p-3">
                <p className="text-sm font-semibold text-ink-1">{item.title}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {"dueAt" in item ? `Due ${new Date(item.dueAt).toLocaleDateString("en-US")}` : item.detail}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Quotes" action="Pricing pipeline">
          <MiniList rows={overview.quotes.map((quote) => [quote.quoteNumber, currency(quote.total), quote.status])} empty="No quotes yet." />
        </Panel>
        <Panel title="Orders" action="Fulfillment">
          {overview.orders.length === 0 ? (
            <p className="text-sm text-ink-3">No orders yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {overview.orders.map((order) => (
                <div key={order.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-ink-1">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {currency(order.total)} · {order.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <BuyAgainButton orderId={order.id} />
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Invoices" action="AR ledger">
          <MiniList rows={overview.invoices.map((invoice) => [invoice.invoiceNumber, `${currency(invoice.balance)} balance`, invoice.status])} empty="No invoices yet." />
        </Panel>
      </section>

      <section className="mt-6">
        <SavedListsPanel />
      </section>

      <div className="mt-8 rounded-(--r-md) border border-line bg-surface-2/50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">
              <FileText size={18} />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-ink-1">Need documents or a reorder?</h2>
              <p className="mt-1 text-sm text-ink-2">Use the product catalog or quote request flow; staff sees the request in the operations queue.</p>
            </div>
          </div>
          <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand">
            Browse catalog <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]">
      <span className="grid size-10 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">{icon}</span>
      <p className="mt-4 text-sm text-ink-3">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink-1">{value}</p>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <section className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink-1">{title}</h2>
        <span className="text-xs font-medium text-ink-3">{action}</span>
      </div>
      {children}
    </section>
  );
}

function MiniList({ rows, empty }: { rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <div className="divide-y divide-line">
      {rows.map(([title, detail, status]) => (
        <div key={`${title}-${detail}`} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <p className="text-sm font-semibold text-ink-1">{title}</p>
            <p className="mt-0.5 text-xs text-ink-3">{detail}</p>
          </div>
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink-3">
            {status.replaceAll("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
