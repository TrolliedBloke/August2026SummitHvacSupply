/**
 * One record per person, keyed by email, across everything Summit captures.
 *
 * A customer leaves their email in up to a dozen places -- an order, a quote
 * request, a homeowner request, a dealer application, a restock alert, a cart,
 * the finder, a marketing opt-in, a login. Each table only knows its own slice.
 * `buildPeople` folds them into one Person: who they are (persona), how far
 * along they are (stage), what they ordered, what they asked for, what we have
 * emailed them, and whether someone owes them a follow-up.
 *
 * Pure. The loader (src/lib/backend/customers.ts) supplies the rows.
 */

import { createHash } from "node:crypto";

/* Rows, as selected by the loader ------------------------------------------- */

type When = string | null;

export type CrmRows = {
  profiles: Array<{ id: string; email: string | null; name: string | null; role: string; account_id: string | null; access_status: string | null; created_at: When }>;
  accounts: Array<{ id: string; type: string; name: string; status: string; price_tier: string | null; license_verified_at: When }>;
  contacts: Array<{ account_id: string | null; name: string; email: string; phone: string | null; role: string | null; created_at: When }>;
  quoteRequests: Array<{ id: string; reference: string | null; name: string; email: string; phone: string | null; need: string | null; lifecycle: string | null; status: string | null; project_type: string | null; zip: string | null; account_id: string | null; created_at: string }>;
  contactRequests: Array<{ id: string; reference: string | null; name: string; email: string; topic: string | null; message: string | null; status: string; channel?: string | null; created_at: string }>;
  homeownerRequests: Array<{ id: string; reference: string | null; name: string; email: string; phone: string | null; status: string; zip: string | null; city: string | null; timeline: string | null; created_at: string }>;
  dealerApplications: Array<{ id: string; reference: string | null; company: string; contact_name: string; email: string; phone: string | null; status: string; account_id: string | null; created_at: string }>;
  orders: Array<{
    id: string;
    order_number: string;
    account_id: string | null;
    buyer_name: string | null;
    buyer_email: string | null;
    status: string;
    fulfillment_status: string | null;
    total: number | string;
    paid: boolean | null;
    created_at: string;
    confirmation_email_status: string | null;
    confirmation_email_last_attempt_at: When;
    review_request_sent_at: When;
    warranty_reminder_sent_at: When;
    maintenance_email_sent_at: When;
  }>;
  orderLines: Array<{ order_id: string; description: string | null; quantity: number; unit_price: number | string; catalog_product_id: string | null }>;
  carts: Array<{ id: string; email: string | null; subtotal: number | string | null; created_at: string; emails_sent: number | null; last_email_at: When; completed_at: When; unsubscribed: boolean | null }>;
  stockAlerts: Array<{ email: string; sku_code: string | null; created_at: string; notified_at: When; unsubscribed: boolean | null }>;
  categoryAlerts: Array<{ email: string; category: string; created_at: string; last_notified_at: When; unsubscribed: boolean | null }>;
  finderSessions: Array<{ id: string; email: string | null; path: string | null; segment: string | null; created_at: string; completed_at: When; shortlist_sent_at: When; homeowner_request_id: string | null }>;
  consents: Array<{ email: string; channel: string; source: string | null; consented_at: When; withdrawn_at: When }>;
  emails: Array<{ to_email: string; kind: string; subject: string; status: string; sent_at: string; related_type: string | null; related_id: string | null; delivery_status?: string | null }>;
  /** Auto-tasks (migration 038), linked to the request that opened them. */
  tasks: Array<{ id: string; title: string; status: string; due_at: When; source_type: string | null; source_id: string | null; completed_at: When }>;
  shipments: Array<{ order_id: string; carrier: string | null; tracking_number: string | null; shipped_at: When }>;
  /** Returns and warranty claims (migration 039). Optional until every source supplies them. */
  rmas?: Array<{ id: string; rma_number: string; requester_email: string | null; requester_name: string | null; status: string; reason: string; quantity: number | null; account_id: string | null; channel: string | null; created_at: string }>;
  warrantyClaims?: Array<{ id: string; claim_number: string; claimant_email: string | null; claimant_name: string | null; claimant_phone: string | null; status: string; model_number: string | null; product_description: string | null; account_id: string | null; created_at: string }>;
};

/* The person ------------------------------------------------------------------ */

export type Persona = "contractor" | "contractor_applicant" | "homeowner" | "contractor_lead" | "shopper" | "staff";
export type Stage = "customer" | "lead" | "subscriber";

export const PERSONA_LABEL: Record<Persona, string> = {
  contractor: "Contractor",
  contractor_applicant: "Contractor applicant",
  homeowner: "Homeowner",
  contractor_lead: "Contractor lead",
  shopper: "Shopper",
  staff: "Staff",
};
export const STAGE_LABEL: Record<Stage, string> = { customer: "Customer", lead: "Lead", subscriber: "Subscriber" };

export type PersonOrder = {
  id: string;
  number: string;
  status: string;
  fulfillment: string | null;
  total: number;
  paid: boolean;
  createdAt: string;
  lines: Array<{ description: string; quantity: number; unitPrice: number; productId: string | null }>;
  shipments: Array<{ carrier: string | null; trackingNumber: string | null; shippedAt: string | null }>;
};
export type PersonTask = { id: string; title: string; status: string; dueAt: string | null; overdue: boolean };
export type PersonRequest = {
  kind: "quote" | "contact" | "homeowner" | "dealer" | "return" | "warranty";
  id: string;
  reference: string | null;
  summary: string;
  status: string;
  open: boolean;
  /** "email" for support mail received through Resend; "web" for the site's forms. */
  channel: "web" | "email";
  createdAt: string;
  task: PersonTask | null;
};
export type PersonEmail = { kind: string; subject: string; status: string; sentAt: string; source: "log" | "reconstructed"; delivery: string | null };
export type TimelineEvent = { at: string; type: "order" | "request" | "email" | "cart" | "alert" | "finder" | "consent" | "account"; text: string };
export type FollowUp = { reason: string; since: string; priority: "high" | "normal"; due: string | null };

export type Person = {
  /** Stable, URL-safe id derived from the email; the email itself never goes in a URL. */
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  persona: Persona;
  personaReason: string;
  stage: Stage;
  account: { id: string; name: string; type: string; priceTier: string | null; licenseVerified: boolean } | null;
  hasLogin: boolean;
  marketing: "subscribed" | "withdrawn" | "none";
  orders: PersonOrder[];
  lifetimeValue: number;
  requests: PersonRequest[];
  emails: PersonEmail[];
  interests: string[];
  followUps: FollowUp[];
  timeline: TimelineEvent[];
  firstSeen: string | null;
  lastSeen: string | null;
};

export function normalizeEmail(email: string | null | undefined): string | null {
  const value = (email ?? "").trim().toLowerCase();
  return value.includes("@") ? value : null;
}

export function personId(email: string): string {
  return createHash("sha256").update(normalizeEmail(email) ?? email).digest("hex").slice(0, 20);
}

const OPEN: Record<PersonRequest["kind"], readonly string[]> = {
  quote: ["received", "needs_information", "in_review", "new"],
  contact: ["new", "open"],
  homeowner: ["received", "needs_information"],
  dealer: ["submitted", "needs_information", "under_review"],
  return: ["open", "waiting", "approved"],
  warranty: ["open", "waiting", "approved"],
};

/** A follow-up older than this is high priority. Internal working target, not a customer promise. */
export const FOLLOW_UP_HIGH_AFTER_HOURS = 24;
const CART_ABANDONED_AFTER_HOURS = 2;

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const hoursSince = (at: string, now: Date) => (now.getTime() - new Date(at).getTime()) / 3_600_000;

type Draft = {
  email: string;
  names: string[];
  phones: string[];
  accountIds: Set<string>;
  roles: string[];
  hasLogin: boolean;
  orders: PersonOrder[];
  requests: PersonRequest[];
  emails: PersonEmail[];
  interests: Set<string>;
  timeline: TimelineEvent[];
  carts: CrmRows["carts"];
  finder: CrmRows["finderSessions"];
  consents: CrmRows["consents"];
};

export function buildPeople(rows: CrmRows, now: Date = new Date()): Person[] {
  const drafts = new Map<string, Draft>();
  const draft = (raw: string | null | undefined): Draft | null => {
    const email = normalizeEmail(raw);
    if (!email) return null;
    let entry = drafts.get(email);
    if (!entry) {
      entry = { email, names: [], phones: [], accountIds: new Set(), roles: [], hasLogin: false, orders: [], requests: [], emails: [], interests: new Set(), timeline: [], carts: [], finder: [], consents: [] };
      drafts.set(email, entry);
    }
    return entry;
  };
  const accounts = new Map(rows.accounts.map((account) => [account.id, account]));
  const linesByOrder = new Map<string, CrmRows["orderLines"]>();
  for (const line of rows.orderLines) linesByOrder.set(line.order_id, [...(linesByOrder.get(line.order_id) ?? []), line]);

  const sourceKind: Record<string, PersonRequest["kind"]> = { quote_requests: "quote", contact_requests: "contact", homeowner_requests: "homeowner", dealer_applications: "dealer", rmas: "return", warranty_claims: "warranty" };
  const taskBySource = new Map<string, PersonTask>();
  for (const task of rows.tasks) {
    const kind = task.source_type ? sourceKind[task.source_type] : undefined;
    if (!kind || !task.source_id) continue;
    taskBySource.set(`${kind}:${task.source_id}`, { id: task.id, title: task.title, status: task.status, dueAt: task.due_at, overdue: task.status === "open" && task.due_at !== null && new Date(task.due_at).getTime() < now.getTime() });
  }
  const shipmentsByOrder = new Map<string, PersonOrder["shipments"]>();
  for (const shipment of rows.shipments) {
    shipmentsByOrder.set(shipment.order_id, [...(shipmentsByOrder.get(shipment.order_id) ?? []), { carrier: shipment.carrier, trackingNumber: shipment.tracking_number, shippedAt: shipment.shipped_at }]);
  }

  for (const profile of rows.profiles) {
    const d = draft(profile.email);
    if (!d) continue;
    d.hasLogin = true;
    d.roles.push(profile.role);
    if (profile.name) d.names.push(profile.name);
    if (profile.account_id) d.accountIds.add(profile.account_id);
    if (profile.created_at) d.timeline.push({ at: profile.created_at, type: "account", text: `Created a ${profile.role} login` });
  }

  for (const contact of rows.contacts) {
    const d = draft(contact.email);
    if (!d) continue;
    d.names.push(contact.name);
    if (contact.phone) d.phones.push(contact.phone);
    if (contact.account_id) d.accountIds.add(contact.account_id);
  }

  /* Orders: by buyer email, or through the account's contacts. */
  const contactEmailsByAccount = new Map<string, string[]>();
  for (const contact of rows.contacts) {
    if (!contact.account_id) continue;
    const email = normalizeEmail(contact.email);
    if (email) contactEmailsByAccount.set(contact.account_id, [...(contactEmailsByAccount.get(contact.account_id) ?? []), email]);
  }
  for (const order of rows.orders) {
    const emails = new Set<string>();
    const buyer = normalizeEmail(order.buyer_email);
    if (buyer) emails.add(buyer);
    if (!buyer && order.account_id) for (const email of contactEmailsByAccount.get(order.account_id) ?? []) emails.add(email);
    for (const email of emails) {
      const d = draft(email)!;
      if (order.buyer_name) d.names.push(order.buyer_name);
      if (order.account_id) d.accountIds.add(order.account_id);
      const lines = (linesByOrder.get(order.id) ?? []).map((line) => ({ description: line.description ?? "Item", quantity: line.quantity, unitPrice: num(line.unit_price), productId: line.catalog_product_id }));
      d.orders.push({ id: order.id, number: order.order_number, status: order.status, fulfillment: order.fulfillment_status, total: num(order.total), paid: Boolean(order.paid), createdAt: order.created_at, lines, shipments: shipmentsByOrder.get(order.id) ?? [] });
      d.timeline.push({ at: order.created_at, type: "order", text: `Order ${order.order_number}, ${formatMoney(num(order.total))}${order.paid ? ", paid" : ""}` });
      for (const line of lines) d.interests.add(line.description);
      /* Emails recorded only as flags on the order. */
      const flagged: Array<[When, string, string]> = [
        [order.confirmation_email_status === "sent" ? order.confirmation_email_last_attempt_at ?? order.created_at : null, "order_confirmation", `Order ${order.order_number} confirmed`],
        [order.review_request_sent_at, "review_request", `Review request for order ${order.order_number}`],
        [order.warranty_reminder_sent_at, "warranty", "Register your equipment warranty"],
        [order.maintenance_email_sent_at, "maintenance", "Keeping your new system running well"],
      ];
      for (const [at, kind, subject] of flagged) if (at) d.emails.push({ kind, subject, status: "sent", sentAt: at, source: "reconstructed", delivery: null });
    }
  }

  const request = (raw: string, kind: PersonRequest["kind"], row: { id: string; reference: string | null; created_at: string }, status: string, summary: string, extra: { name?: string; phone?: string | null; accountId?: string | null; channel?: string | null }) => {
    const d = draft(raw);
    if (!d) return;
    if (extra.name) d.names.push(extra.name);
    if (extra.phone) d.phones.push(extra.phone);
    if (extra.accountId) d.accountIds.add(extra.accountId);
    const open = OPEN[kind].includes(status);
    const channel = extra.channel === "email" ? "email" : "web";
    d.requests.push({ kind, id: row.id, reference: row.reference, summary, status, open, channel, createdAt: row.created_at, task: taskBySource.get(`${kind}:${row.id}`) ?? null });
    d.timeline.push({ at: row.created_at, type: "request", text: `${requestLabel(kind, channel)}${row.reference ? ` ${row.reference}` : ""}: ${summary}` });
  };
  for (const row of rows.quoteRequests) request(row.email, "quote", row, row.lifecycle ?? row.status ?? "received", [row.need, row.project_type, row.zip && `ZIP ${row.zip}`].filter(Boolean).join(" · ") || "Quote request", { name: row.name, phone: row.phone, accountId: row.account_id });
  for (const row of rows.contactRequests) request(row.email, "contact", row, row.status, [row.topic, row.message?.slice(0, 80)].filter(Boolean).join(": ") || "Message", { name: row.name, channel: row.channel });
  for (const row of rows.homeownerRequests) request(row.email, "homeowner", row, row.status, [row.city ?? (row.zip && `ZIP ${row.zip}`), row.timeline].filter(Boolean).join(" · ") || "Installer help", { name: row.name, phone: row.phone });
  for (const row of rows.dealerApplications) request(row.email, "dealer", row, row.status, row.company, { name: row.contact_name, phone: row.phone, accountId: row.account_id });
  for (const row of rows.rmas ?? []) {
    if (row.requester_email) request(row.requester_email, "return", { id: row.id, reference: row.rma_number, created_at: row.created_at }, row.status, `${row.quantity ?? 1} × item · ${row.reason.replaceAll("_", " ")}`, { name: row.requester_name ?? undefined, accountId: row.account_id });
  }
  for (const row of rows.warrantyClaims ?? []) {
    if (row.claimant_email) request(row.claimant_email, "warranty", { id: row.id, reference: row.claim_number, created_at: row.created_at }, row.status, [row.product_description, row.model_number && `model ${row.model_number}`].filter(Boolean).join(" · ") || "Warranty claim", { name: row.claimant_name ?? undefined, phone: row.claimant_phone, accountId: row.account_id });
  }

  for (const cart of rows.carts) {
    const d = draft(cart.email);
    if (!d) continue;
    d.carts.push(cart);
    d.timeline.push({ at: cart.created_at, type: "cart", text: `Saved a cart, ${formatMoney(num(cart.subtotal))}${cart.completed_at ? ", later completed" : ""}` });
    if ((cart.emails_sent ?? 0) > 0 && cart.last_email_at) {
      d.emails.push({ kind: "abandoned_cart", subject: `Cart reminder${(cart.emails_sent ?? 0) > 1 ? ` (${cart.emails_sent} sent)` : ""}`, status: "sent", sentAt: cart.last_email_at, source: "reconstructed", delivery: null });
    }
  }
  for (const alert of rows.stockAlerts) {
    const d = draft(alert.email);
    if (!d) continue;
    if (alert.sku_code) d.interests.add(alert.sku_code);
    d.timeline.push({ at: alert.created_at, type: "alert", text: `Asked for a restock alert on ${alert.sku_code ?? "a product"}` });
    if (alert.notified_at) d.emails.push({ kind: "back_in_stock", subject: `Back in stock: ${alert.sku_code ?? "product"}`, status: "sent", sentAt: alert.notified_at, source: "reconstructed", delivery: null });
  }
  for (const alert of rows.categoryAlerts) {
    const d = draft(alert.email);
    if (!d) continue;
    d.interests.add(alert.category);
    d.timeline.push({ at: alert.created_at, type: "alert", text: `Asked for stock alerts in ${alert.category}` });
    if (alert.last_notified_at) d.emails.push({ kind: "category", subject: `In stock in Newark: ${alert.category}`, status: "sent", sentAt: alert.last_notified_at, source: "reconstructed", delivery: null });
  }
  for (const session of rows.finderSessions) {
    const d = draft(session.email);
    if (!d) continue;
    d.finder.push(session);
    d.timeline.push({ at: session.created_at, type: "finder", text: `Used the system finder as a ${session.path ?? "visitor"}${session.completed_at ? " and finished it" : ""}` });
    if (session.shortlist_sent_at) d.emails.push({ kind: "finder_shortlist", subject: "Your system finder shortlist", status: "sent", sentAt: session.shortlist_sent_at, source: "reconstructed", delivery: null });
  }
  for (const consent of rows.consents) {
    const d = draft(consent.email);
    if (!d) continue;
    d.consents.push(consent);
    if (consent.consented_at) d.timeline.push({ at: consent.consented_at, type: "consent", text: `Opted in to ${consent.channel} email${consent.source ? ` (${consent.source})` : ""}` });
    if (consent.withdrawn_at) d.timeline.push({ at: consent.withdrawn_at, type: "consent", text: `Unsubscribed from ${consent.channel} email` });
  }
  for (const email of rows.emails) {
    const d = draft(email.to_email);
    if (!d) continue;
    d.emails.push({ kind: email.kind, subject: email.subject, status: email.status, sentAt: email.sent_at, source: "log", delivery: email.delivery_status ?? null });
  }

  return Array.from(drafts.values()).map((d) => finish(d, accounts, now));
}

const REQUEST_LABEL: Record<PersonRequest["kind"], string> = { quote: "Quote request", contact: "Message", homeowner: "Homeowner request", dealer: "Dealer application", return: "Return", warranty: "Warranty claim" };

export function requestLabel(kind: PersonRequest["kind"], channel: PersonRequest["channel"] = "web"): string {
  return kind === "contact" && channel === "email" ? "Support email" : REQUEST_LABEL[kind];
}

function finish(d: Draft, accounts: Map<string, CrmRows["accounts"][number]>, now: Date): Person {
  /* Logged sends win; a reconstructed entry within an hour of a logged one of the same kind is the same email. */
  const logged = d.emails.filter((email) => email.source === "log");
  const emails = [
    ...logged,
    ...d.emails.filter(
      (email) => email.source === "reconstructed" && !logged.some((log) => log.kind === email.kind && Math.abs(new Date(log.sentAt).getTime() - new Date(email.sentAt).getTime()) < 3_600_000)
    ),
  ].sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  const accountRow = Array.from(d.accountIds).map((id) => accounts.get(id)).find((row) => row && row.type !== "internal" && row.type !== "supplier") ?? null;
  const [persona, personaReason] = classify(d, accountRow);
  const paidOrders = d.orders.filter((order) => order.status !== "cancelled" && order.paid);
  const consent = d.consents.filter((row) => row.channel === "email" || row.channel === "marketing").sort((a, b) => (b.consented_at ?? "").localeCompare(a.consented_at ?? ""))[0] ?? d.consents[0];
  const marketing: Person["marketing"] = !consent ? "none" : consent.withdrawn_at ? "withdrawn" : "subscribed";

  const timeline = [...d.timeline, ...emails.map((email): TimelineEvent => ({ at: email.sentAt, type: "email", text: `${email.status === "sent" ? "Emailed" : `Email ${email.status}`}: ${email.subject}` }))].sort((a, b) => b.at.localeCompare(a.at));
  const dates = timeline.map((event) => event.at);

  return {
    id: personId(d.email),
    email: d.email,
    name: mostCommon(d.names),
    phone: d.phones[0] ?? null,
    persona,
    personaReason,
    stage: paidOrders.length > 0 ? "customer" : d.requests.length > 0 || d.carts.length > 0 || d.finder.length > 0 ? "lead" : "subscriber",
    account: accountRow ? { id: accountRow.id, name: accountRow.name, type: accountRow.type, priceTier: accountRow.price_tier, licenseVerified: Boolean(accountRow.license_verified_at) } : null,
    hasLogin: d.hasLogin,
    marketing,
    orders: d.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    lifetimeValue: paidOrders.reduce((total, order) => total + order.total, 0),
    requests: d.requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    emails,
    interests: Array.from(d.interests).slice(0, 12),
    followUps: followUps(d, now),
    timeline,
    firstSeen: dates.length ? dates[dates.length - 1] : null,
    lastSeen: dates[0] ?? null,
  };
}

/** Strongest signal wins, and the reason is shown so staff can check it. */
function classify(d: Draft, account: CrmRows["accounts"][number] | null): [Persona, string] {
  if (d.roles.includes("staff")) return ["staff", "Staff login"];
  if (account && (account.type === "dealer" || account.type === "installer")) return ["contractor", `${account.type === "dealer" ? "Dealer" : "Installer"} account ${account.name}`];
  if (d.roles.includes("dealer") || d.roles.includes("installer")) return ["contractor", "Trade login"];
  const application = d.requests.find((request) => request.kind === "dealer");
  if (application) return ["contractor_applicant", `Dealer application (${application.status.replaceAll("_", " ")})`];
  if (d.requests.some((request) => request.kind === "homeowner")) return ["homeowner", "Homeowner installer request"];
  if (account?.type === "homeowner" || d.roles.includes("homeowner")) return ["homeowner", "Retail account"];
  const finder = d.finder.find((session) => session.path);
  if (finder?.path === "homeowner") return ["homeowner", "Used the finder for their home"];
  if (finder?.path === "contractor") return ["contractor_lead", "Used the finder as a contractor"];
  return ["shopper", "No contractor or homeowner signal yet"];
}

function followUps(d: Draft, now: Date): FollowUp[] {
  const out: FollowUp[] = [];
  const priority = (at: string): FollowUp["priority"] => (hoursSince(at, now) >= FOLLOW_UP_HIGH_AFTER_HOURS ? "high" : "normal");
  for (const request of d.requests.filter((row) => row.open)) {
    // An overdue task is urgent whatever its age; otherwise the 24 h rule applies.
    out.push({
      reason: `${requestLabel(request.kind, request.channel)}${request.reference ? ` ${request.reference}` : ""} is ${request.status.replaceAll("_", " ")}`,
      since: request.createdAt,
      priority: request.task?.overdue ? "high" : priority(request.createdAt),
      due: request.task?.status === "open" ? request.task.dueAt : null,
    });
  }
  const lastOrder = d.orders.map((order) => order.createdAt).sort().at(-1) ?? "";
  for (const cart of d.carts) {
    if (cart.completed_at || cart.unsubscribed || hoursSince(cart.created_at, now) < CART_ABANDONED_AFTER_HOURS || lastOrder > cart.created_at) continue;
    out.push({ reason: `Left a ${formatMoney(num(cart.subtotal))} cart without ordering`, since: cart.created_at, priority: "normal", due: null });
  }
  const finished = d.finder.find((session) => session.completed_at && session.path === "homeowner" && !session.homeowner_request_id);
  if (finished && !d.requests.some((request) => request.kind === "homeowner") && d.orders.length === 0) {
    out.push({ reason: "Finished the system finder but has not asked for installer help", since: finished.completed_at!, priority: "normal", due: null });
  }
  for (const order of d.orders) {
    if (order.paid && order.status !== "shipped" && order.status !== "cancelled" && hoursSince(order.createdAt, now) >= 72) {
      out.push({ reason: `Order ${order.number} is paid but not shipped`, since: order.createdAt, priority: "high", due: null });
    }
  }
  return out.sort((a, b) => (a.priority === b.priority ? a.since.localeCompare(b.since) : a.priority === "high" ? -1 : 1));
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values.map((name) => name.trim()).filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const formatMoney = (value: number) => usd.format(value);

/** Pacific time: the branch's clock, not the server's. */
export function formatDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: "America/Los_Angeles" });
}

/* List helpers ---------------------------------------------------------------- */

export type PeopleFilter = { q?: string; persona?: Persona | "all"; followUp?: boolean };

export function filterPeople(people: Person[], { q = "", persona = "all", followUp = false }: PeopleFilter): Person[] {
  const query = q.trim().toLowerCase();
  return people
    .filter((person) => person.persona !== "staff")
    .filter((person) => persona === "all" || person.persona === persona)
    .filter((person) => !followUp || person.followUps.length > 0)
    .filter((person) => !query || [person.email, person.name, person.account?.name, person.phone].some((value) => value?.toLowerCase().includes(query)))
    .sort((a, b) => {
      const urgency = (person: Person) => (person.followUps.some((item) => item.priority === "high") ? 2 : person.followUps.length ? 1 : 0);
      return urgency(b) - urgency(a) || (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "");
    });
}

export function peopleKpis(people: Person[]) {
  const visible = people.filter((person) => person.persona !== "staff");
  return {
    people: visible.length,
    customers: visible.filter((person) => person.stage === "customer").length,
    needFollowUp: visible.filter((person) => person.followUps.length > 0).length,
    urgent: visible.filter((person) => person.followUps.some((item) => item.priority === "high")).length,
    subscribed: visible.filter((person) => person.marketing === "subscribed").length,
    contractors: visible.filter((person) => person.persona === "contractor").length,
    overdueTasks: visible.reduce((total, person) => total + person.requests.filter((request) => request.task?.overdue).length, 0),
  };
}
