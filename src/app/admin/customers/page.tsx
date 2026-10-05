import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { Chip, Container } from "@/components/ui";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { CustomersUnavailableError, loadCustomers } from "@/lib/backend/customers";
import { filterPeople, formatDate, formatMoney, PERSONA_LABEL, peopleKpis, STAGE_LABEL, type Persona } from "@/lib/crm/people";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const PERSONAS: Array<Persona | "all"> = ["all", "contractor", "contractor_applicant", "homeowner", "contractor_lead", "shopper"];

/**
 * Everyone who has given Summit an email, one row each, people who are owed a
 * follow-up first. Filters live in the query string so a view can be shared
 * with a colleague; the email itself never goes in a URL (rows link by id).
 */
export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const persona = PERSONAS.includes(params.persona as Persona) ? (params.persona as Persona | "all") : "all";
  const followUp = params.follow === "1";

  let result;
  try {
    result = await loadCustomers();
  } catch (error) {
    if (!(error instanceof CustomersUnavailableError)) throw error;
    return (
      <Container className="py-10 lg:py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-1">Customers</h1>
        <p role="alert" className="mt-6 flex gap-2 rounded-(--r-sm) border border-state-danger-line bg-state-danger p-4 text-sm text-state-danger-ink">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error.message}
        </p>
      </Container>
    );
  }

  const kpis = peopleKpis(result.people);
  const rows = filterPeople(result.people, { q, persona, followUp });
  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const merged = { q: q || null, persona: persona === "all" ? null : persona, follow: followUp ? "1" : null, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const qs = next.toString();
    return qs ? `/admin/customers?${qs}` : "/admin/customers";
  };

  return (
    <Container className="py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Chip tone={result.source === "supabase" ? "brand" : "neutral"}>{result.source === "supabase" ? "Live from Supabase" : "Demo data (fictional)"}</Chip>
            <Link href="/admin" className="text-sm text-ink-3 underline-offset-4 hover:underline">Operations</Link>
            <LiveRefresh />
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-1">Customers</h1>
          <p className="mt-1 max-w-2xl text-ink-2">Everyone who has given us an email: who they are, what they ordered, what we sent them, and who is waiting on us.</p>
        </div>
      </div>

      {result.truncated.length > 0 && (
        <p className="mt-4 text-sm text-state-warning-ink">Showing the newest 5,000 rows of {result.truncated.join(", ")}; older people from those tables are not listed.</p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi label="People" value={kpis.people} />
        <Kpi label="Customers" value={kpis.customers} />
        <Kpi label="Contractors" value={kpis.contractors} />
        <Kpi label="Need follow-up" value={kpis.needFollowUp} href={href({ follow: "1" })} />
        <Kpi label="Urgent" value={kpis.urgent} tone={kpis.urgent > 0 ? "warn" : undefined} href={href({ follow: "1" })} />
        <Kpi label="Overdue tasks" value={kpis.overdueTasks} tone={kpis.overdueTasks > 0 ? "warn" : undefined} href={href({ follow: "1" })} />
        <Kpi label="Email subscribers" value={kpis.subscribed} />
      </dl>

      <form className="mt-6 flex flex-wrap items-center gap-3" action="/admin/customers">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-(--r-sm) border border-line bg-surface-1 px-3 sm:max-w-sm">
          <Search size={16} className="shrink-0 text-ink-3" aria-hidden="true" />
          <span className="sr-only">Search customers</span>
          <input name="q" defaultValue={q} placeholder="Name, email, company or phone" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        {persona !== "all" && <input type="hidden" name="persona" value={persona} />}
        {followUp && <input type="hidden" name="follow" value="1" />}
        <button type="submit" className="h-11 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">Search</button>
      </form>

      <nav aria-label="Filter customers" className="mt-4 flex flex-wrap gap-2 text-sm">
        {PERSONAS.map((value) => (
          <Link
            key={value}
            href={href({ persona: value === "all" ? null : value })}
            aria-current={persona === value ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 ${persona === value ? "border-brand bg-brand-tint font-medium text-ink-1" : "border-line text-ink-2 hover:border-ink-3"}`}
          >
            {value === "all" ? "Everyone" : PERSONA_LABEL[value]}
          </Link>
        ))}
        <Link
          href={href({ follow: followUp ? null : "1" })}
          aria-pressed={followUp}
          className={`inline-flex min-h-11 items-center rounded-full border px-4 ${followUp ? "border-brand bg-brand-tint font-medium text-ink-1" : "border-line text-ink-2 hover:border-ink-3"}`}
        >
          Needs follow-up
        </Link>
      </nav>

      <div className="mt-6 overflow-x-auto rounded-(--r-md) border border-line bg-surface-1">
        <table className="w-full min-w-[880px] text-left text-sm" data-customer-table>
          <thead className="border-b border-line text-xs text-ink-3">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Persona</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Emails sent</th>
              <th className="px-4 py-3 font-medium">Follow-up</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">No one matches. Clear the search or filters.</td>
              </tr>
            ) : (
              rows.map((person) => {
                const top = person.followUps[0];
                return (
                  <tr key={person.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${person.id}`} className="font-medium text-ink-1 underline-offset-4 hover:underline">
                        {person.name ?? person.email}
                      </Link>
                      <span className="block text-xs text-ink-3">{person.email}</span>
                      {person.account && <span className="block text-xs text-ink-3">{person.account.name}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-ink-1">{PERSONA_LABEL[person.persona]}</span>
                      <span className="block text-xs text-ink-3">{STAGE_LABEL[person.stage]}{person.marketing === "subscribed" ? " · subscribed" : person.marketing === "withdrawn" ? " · unsubscribed" : ""}</span>
                    </td>
                    <td className="px-4 py-3 tnum">
                      {person.orders.length > 0 ? (
                        <>
                          <span className="block text-ink-1">{person.orders.length}</span>
                          <span className="block text-xs text-ink-3">{formatMoney(person.lifetimeValue)} paid</span>
                        </>
                      ) : (
                        <span className="text-ink-3">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tnum">
                      <span className="block text-ink-1">{person.emails.length}</span>
                      {person.emails[0] && <span className="block text-xs text-ink-3">Last: {person.emails[0].subject.slice(0, 40)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {top ? (
                        <span className={`block ${top.priority === "high" ? "font-medium text-state-warning-ink" : "text-ink-1"}`}>
                          {top.priority === "high" && <AlertTriangle size={13} className="mr-1 inline align-[-2px]" aria-hidden="true" />}
                          {top.reason}
                          {person.followUps.length > 1 && <span className="block text-xs font-normal text-ink-3">+{person.followUps.length - 1} more</span>}
                        </span>
                      ) : (
                        <span className="text-ink-3">Nothing open</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{person.lastSeen ? formatDate(person.lastSeen) : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-3">{rows.length} of {kpis.people} people · loaded {formatDate(result.loadedAt, true)}</p>
    </Container>
  );
}

function Kpi({ label, value, href, tone }: { label: string; value: number; href?: string; tone?: "warn" }) {
  const body = (
    <>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`tnum mt-1 text-2xl font-medium ${tone === "warn" ? "text-state-warning-ink" : "text-ink-1"}`}>{value}</dd>
    </>
  );
  const shell = "block rounded-(--r-md) border border-line bg-surface-1 p-4";
  return href ? <Link href={href} className={`${shell} hover:border-ink-3`}>{body}</Link> : <div className={shell}>{body}</div>;
}
