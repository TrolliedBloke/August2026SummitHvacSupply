import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardList,
  DollarSign,
  FileText,
  PackageCheck,
  RefreshCw,
  SearchX,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import { Container, Chip, LinkButton } from "@/components/ui";
import { getOperationsOverview } from "@/lib/backend/services";
import { getEventSummary } from "@/lib/backend/events";

export const metadata = {
  title: "Operations Dashboard - Summit HVAC Supply",
};

export default async function AdminPage() {
  const ops = await getOperationsOverview();
  const events = await getEventSummary();

  return (
    <Container className="py-10 lg:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Chip tone={ops.mode === "supabase" ? "eco" : "copper"}>
              {ops.mode === "supabase" ? "Supabase connected" : "Seeded backend"}
            </Chip>
            <Chip tone="neutral">Staff view</Chip>
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
            Wholesale operations dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-ink-2">
            Track stock, dealer activity, quotes, orders, invoices, purchase orders, receiving, and open support cases from one operations console.
          </p>
        </div>
        <LinkButton href="/products" variant="secondary">
          Public catalog
          <ArrowRight size={16} />
        </LinkButton>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Boxes size={18} />} label="Available units" value={ops.kpis.availableUnits.toLocaleString()} />
        <Kpi icon={<PackageCheck size={18} />} label="Reserved units" value={ops.kpis.reservedUnits.toLocaleString()} />
        <Kpi icon={<ClipboardList size={18} />} label="Open quote work" value={`${ops.kpis.openQuoteRequests + ops.kpis.openQuotes}`} />
        <Kpi icon={<DollarSign size={18} />} label="Open AR balance" value={currency(ops.kpis.openInvoiceBalance)} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Inventory by SKU" icon={<Boxes size={18} />} action="SKU/bin stock">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink-3">
                <tr>
                  <th className="py-3 pr-4 font-medium">SKU</th>
                  <th className="py-3 pr-4 font-medium">Series</th>
                  <th className="py-3 pr-4 font-medium">Bin</th>
                  <th className="py-3 pr-4 font-medium">On hand</th>
                  <th className="py-3 pr-4 font-medium">Reserved</th>
                  <th className="py-3 pr-4 font-medium">Available</th>
                  <th className="py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ops.inventory.map((item) => (
                  <tr key={item.skuId}>
                    <td className="py-3 pr-4 font-mono text-xs font-semibold text-ink-1">{item.sku.sku}</td>
                    <td className="py-3 pr-4 text-ink-2">{item.seriesName}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-ink-3">{item.binCodes.join(", ")}</td>
                    <td className="py-3 pr-4 tnum font-mono">{item.onHand}</td>
                    <td className="py-3 pr-4 tnum font-mono">{item.reserved}</td>
                    <td className="py-3 pr-4 tnum font-mono font-semibold">{item.available}</td>
                    <td className="py-3">
                      <StockChip status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Work queue" icon={<AlertTriangle size={18} />} action={`${ops.kpis.openCases} open cases`}>
          <div className="space-y-3">
            {[...ops.tasks, ...ops.rmas, ...ops.warrantyClaims, ...ops.rebateCases].slice(0, 7).map((item) => (
              <div key={item.id} className="rounded-(--r-sm) border border-line bg-surface-2/60 p-3">
                <p className="text-sm font-semibold text-ink-1">{item.title}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {"dueAt" in item
                    ? `Due ${new Date(item.dueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}`
                    : item.detail}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Quote pipeline" icon={<ClipboardList size={18} />} action="Request → quote → order">
          <List rows={[
            ...ops.quoteRequests.map((request) => [`${request.name}`, request.need, request.status]),
            ...ops.quotes.map((quote) => [quote.quoteNumber, `${currency(quote.total)} · valid ${quote.validUntil}`, quote.status]),
          ]} />
        </Panel>

        <Panel title="Orders & invoices" icon={<FileText size={18} />} action="AR ledger">
          <List rows={[
            ...ops.orders.map((order) => [order.orderNumber, `${currency(order.total)} · ${order.status}`, "order"]),
            ...ops.invoices.map((invoice) => [invoice.invoiceNumber, `${currency(invoice.balance)} balance`, invoice.status]),
          ]} />
        </Panel>

        <Panel title="Purchasing & receiving" icon={<Truck size={18} />} action="Supplier replenishment">
          <List rows={ops.purchaseOrders.map((po) => [
            po.poNumber,
            `${currency(po.total)} · expected ${po.expectedAt}`,
            po.status,
          ])} />
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Accounts" icon={<Users size={18} />} action={`${ops.accounts.length} records`}>
          <List rows={ops.accounts.map((account) => [
            account.name,
            `${account.type} · ${account.priceTier}`,
            account.status,
          ])} />
        </Panel>
        <Panel title="RMA / warranty" icon={<ShieldAlert size={18} />} action="Support cases">
          <List rows={[...ops.rmas, ...ops.warrantyClaims].map((record) => [
            record.number,
            record.title,
            record.status,
          ])} />
        </Panel>
        <Panel title="Activity" icon={<RefreshCw size={18} />} action="Latest system log">
          <List rows={ops.activity.map((activity) => [
            activity.event,
            activity.entityType,
            new Date(activity.createdAt).toLocaleDateString("en-US"),
          ])} />
        </Panel>
      </section>

      {/* First-party conversion signals — never CVR alone. */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Conversion events" icon={<BarChart3 size={18} />} action="Last 30 days">
          {events.counts.length === 0 ? (
            <p className="text-sm text-ink-3">
              No events yet. The site logs conversion hooks (chat opens, notify-me
              signups, buy-again clicks, checkout completions) as buyers use it.
            </p>
          ) : (
            <List rows={events.counts.slice(0, 10).map((row) => [
              row.name.replaceAll("_", " ").replaceAll("-", " "),
              "site event",
              `×${row.count}`,
            ])} />
          )}
        </Panel>
        <Panel title="Zero-result searches" icon={<SearchX size={18} />} action="What buyers wanted and didn't find">
          {events.zeroResultQueries.length === 0 ? (
            <p className="text-sm text-ink-3">No missed searches logged yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {events.zeroResultQueries.map((query) => (
                <li key={query} className="py-2 font-mono text-sm text-ink-1 first:pt-0 last:pb-0">
                  &ldquo;{query}&rdquo;
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </Container>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">{icon}</span>
        <span className="text-sm text-ink-3">{label}</span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-1">{value}</p>
    </div>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink-1">
          <span className="text-brand">{icon}</span>
          {title}
        </h2>
        <span className="text-xs font-medium text-ink-3">{action}</span>
      </div>
      {children}
    </section>
  );
}

function List({ rows }: { rows: string[][] }) {
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

function StockChip({ status }: { status: "ready" | "low" | "backorder" }) {
  const label = status === "ready" ? "Ready" : status === "low" ? "Low" : "Backorder";
  const tone = status === "ready" ? "stock" : status === "low" ? "copper" : "lead";
  return <Chip tone={tone}>{label}</Chip>;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
