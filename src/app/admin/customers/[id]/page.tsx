import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Mail, Phone } from "lucide-react";
import { Chip, Container } from "@/components/ui";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { CustomersUnavailableError, loadCustomers } from "@/lib/backend/customers";
import { formatDate, formatMoney, PERSONA_LABEL, STAGE_LABEL, type Person } from "@/lib/crm/people";

export const metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

const EMAIL_KIND: Record<string, string> = {
  order_confirmation: "Order confirmation",
  receipt: "Payment receipt",
  invoice: "Invoice",
  statement: "Statement",
  review_request: "Review request",
  warranty: "Warranty reminder",
  maintenance: "Maintenance tips",
  abandoned_cart: "Cart reminder",
  back_in_stock: "Restock alert",
  category: "Category stock alert",
  finder_shortlist: "Finder shortlist",
  planning: "Planning series",
  transactional: "Transactional",
};

/** One person: who they are, what is owed to them, and everything that has happened. */
export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  let person: Person | undefined;
  let source: "supabase" | "demo" = "supabase";
  try {
    const result = await loadCustomers();
    source = result.source;
    person = result.people.find((row) => row.id === id);
  } catch (error) {
    if (error instanceof CustomersUnavailableError) {
      return (
        <Container className="py-10">
          <p role="alert" className="text-state-danger-ink">{error.message}</p>
        </Container>
      );
    }
    throw error;
  }
  if (!person) notFound();

  return (
    <Container className="py-8 lg:py-12">
      <Link href="/admin/customers" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-2 hover:text-ink-1">
        <ArrowLeft size={15} aria-hidden="true" /> All customers
      </Link>

      <header className="mt-2 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="brand">{PERSONA_LABEL[person.persona]}</Chip>
            <Chip>{STAGE_LABEL[person.stage]}</Chip>
            {person.hasLogin && <Chip>Has a login</Chip>}
            <Chip>{person.marketing === "subscribed" ? "Subscribed to email" : person.marketing === "withdrawn" ? "Unsubscribed" : "Transactional email only"}</Chip>
            {source === "demo" && <Chip>Demo data</Chip>}
            <LiveRefresh />
          </div>
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-ink-1">{person.name ?? person.email}</h1>
          <p className="mt-1 text-sm text-ink-3">Persona: {person.personaReason}</p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1.5 text-brand underline-offset-4 hover:underline"><Mail size={14} aria-hidden="true" />{person.email}</a>
            {person.phone && <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} className="tnum inline-flex items-center gap-1.5 text-brand underline-offset-4 hover:underline"><Phone size={14} aria-hidden="true" />{person.phone}</a>}
          </p>
          {person.account && (
            <p className="mt-2 text-sm text-ink-2">
              Account <span className="font-medium text-ink-1">{person.account.name}</span> · {person.account.type}
              {person.account.priceTier ? ` · ${person.account.priceTier.replaceAll("_", " ")}` : ""}
              {person.account.type === "dealer" || person.account.type === "installer" ? (person.account.licenseVerified ? " · license verified" : " · license not verified") : ""}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-6 text-sm">
          <Stat label="Paid orders" value={formatMoney(person.lifetimeValue)} />
          <Stat label="Emails sent" value={String(person.emails.length)} />
          <Stat label="First seen" value={person.firstSeen ? formatDate(person.firstSeen) : "—"} />
        </dl>
      </header>

      {person.followUps.length > 0 && (
        <section aria-labelledby="follow-up" className="mt-6 rounded-(--r-md) border border-state-warning-line bg-state-warning p-4" data-follow-ups>
          <h2 id="follow-up" className="flex items-center gap-2 font-medium text-state-warning-ink">
            <AlertTriangle size={16} aria-hidden="true" /> Follow up
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-1">
            {person.followUps.map((item) => (
              <li key={item.reason}>
                {item.reason} <span className="text-ink-3">· since {formatDate(item.since)}{item.priority === "high" ? " · waiting over a day" : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-8">
          <Section title="Orders" count={person.orders.length} empty="No orders yet.">
            {person.orders.map((order) => (
              <article key={order.id} className="rounded-(--r-sm) border border-line p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="part-number font-medium text-ink-1">{order.number}</h3>
                  <span className="tnum text-sm text-ink-1">{formatMoney(order.total)}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-3">
                  {formatDate(order.createdAt)} · {order.status.replaceAll("_", " ")}
                  {order.fulfillment ? ` · ${order.fulfillment.replaceAll("_", " ")}` : ""} · {order.paid ? "paid" : "not paid"}
                </p>
                {order.lines.length > 0 && (
                  <ul className="mt-2 divide-y divide-line text-sm">
                    {order.lines.map((line, index) => (
                      <li key={`${line.description}-${index}`} className="flex justify-between gap-3 py-1.5">
                        <span className="min-w-0 text-ink-2">{line.quantity} × {line.description}</span>
                        <span className="tnum shrink-0 text-ink-3">{formatMoney(line.unitPrice * line.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </Section>

          <Section title="Requests" count={person.requests.length} empty="No quote, contact, homeowner or dealer requests.">
            <ul className="divide-y divide-line rounded-(--r-sm) border border-line">
              {person.requests.map((request) => (
                <li key={`${request.kind}-${request.id}`} className="p-3 text-sm">
                  <span className="font-medium text-ink-1">{REQUEST_TITLE[request.kind]}{request.reference ? ` ${request.reference}` : ""}</span>
                  <span className={`ml-2 text-xs ${request.open ? "font-medium text-state-warning-ink" : "text-ink-3"}`}>{request.status.replaceAll("_", " ")}</span>
                  <span className="block text-ink-2">{request.summary}</span>
                  <span className="block text-xs text-ink-3">{formatDate(request.createdAt)}</span>
                  {request.kind === "dealer" && <Link href="/admin/dealers" className="text-xs font-medium text-brand underline-offset-4 hover:underline">Review in dealer applications</Link>}
                  {request.kind === "homeowner" && <Link href="/admin/referrals" className="text-xs font-medium text-brand underline-offset-4 hover:underline">Match an installer</Link>}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Emails sent" count={person.emails.length} empty="We have not emailed this person.">
            <ul className="divide-y divide-line rounded-(--r-sm) border border-line" data-email-history>
              {person.emails.map((email, index) => (
                <li key={`${email.sentAt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block text-ink-1">{email.subject}</span>
                    <span className="block text-xs text-ink-3">
                      {EMAIL_KIND[email.kind] ?? email.kind}
                      {email.source === "reconstructed" ? " · from order and alert records" : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs ${email.status === "sent" ? "text-ink-3" : "font-medium text-state-danger-ink"}`}>
                    {email.status === "sent" ? formatDate(email.sentAt, true) : `${email.status} · ${formatDate(email.sentAt, true)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="min-w-0 space-y-8">
          {person.interests.length > 0 && (
            <Section title="Interested in" count={person.interests.length} empty="">
              <ul className="flex flex-wrap gap-2 text-sm">
                {person.interests.map((interest) => (
                  <li key={interest} className="rounded-full border border-line px-3 py-1 text-ink-2">{interest}</li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Timeline" count={person.timeline.length} empty="Nothing recorded.">
            <ol className="relative space-y-3 border-l border-line pl-4 text-sm" data-timeline>
              {person.timeline.slice(0, 60).map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <span className="block text-ink-1">{event.text}</span>
                  <span className="block text-xs text-ink-3">{formatDate(event.at, true)}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </Container>
  );
}

const REQUEST_TITLE = { quote: "Quote request", contact: "Message", homeowner: "Homeowner request", dealer: "Dealer application" } as const;

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-lg font-medium text-ink-1">
        {title} <span className="tnum text-sm font-normal text-ink-3">{count}</span>
      </h2>
      <div className="mt-3">{count > 0 ? children : <p className="text-sm text-ink-3">{empty}</p>}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="tnum mt-1 font-medium text-ink-1">{value}</dd>
    </div>
  );
}
