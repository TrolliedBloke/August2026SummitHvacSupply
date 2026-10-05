import type { CrmRows } from "./people";

/**
 * Fictional rows for local demo mode only (ALLOW_UNAUTHENTICATED_ADMIN, which
 * is inert in production). Every address is @example.com. The page labels this
 * data as demo; it never stands in for live data.
 */

/** 17:00 Pacific (PDT) is 24:00 UTC: tasks are due at 5 pm Pacific (migration 038). */
const DUE_HOUR_UTC = 24;

const day = (offset: number, hour = 10) => {
  const date = new Date(Date.UTC(2026, 9, 4, hour));
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
};

export const DEMO_CRM_ROWS: CrmRows = {
  profiles: [
    { id: "p1", email: "maria@bayheat.example.com", name: "Maria Lopez", role: "dealer", account_id: "a1", access_status: "approved", created_at: day(60) },
    { id: "p2", email: "counter@example.com", name: "Counter staff", role: "staff", account_id: null, access_status: "approved", created_at: day(90) },
  ],
  accounts: [
    { id: "a1", type: "dealer", name: "Bay Heat & Air", status: "active", price_tier: "tier_2", license_verified_at: day(58) },
    { id: "a2", type: "homeowner", name: "J. Park", status: "active", price_tier: "retail", license_verified_at: null },
  ],
  contacts: [
    { account_id: "a1", name: "Maria Lopez", email: "maria@bayheat.example.com", phone: "(510) 555-0142", role: "owner", created_at: day(60) },
    { account_id: "a2", name: "Jin Park", email: "jin.park@example.com", phone: "(408) 555-0199", role: "buyer", created_at: day(20) },
  ],
  quoteRequests: [
    { id: "q1", reference: "Q-1042", name: "Maria Lopez", email: "maria@bayheat.example.com", phone: null, need: "Two 24k TCL heat pumps for a duplex", lifecycle: "received", status: "new", project_type: "replacement", zip: "94560", account_id: "a1", created_at: day(2) },
    { id: "q2", reference: "Q-1031", name: "Sam Ortiz", email: "sam.ortiz@example.com", phone: "(650) 555-0110", need: "Line sets, 50 ft", lifecycle: "quoted", status: "new", project_type: "new_install", zip: "94043", account_id: null, created_at: day(9) },
  ],
  contactRequests: [
    { id: "c1", reference: "E-2207", name: "Jin Park", email: "jin.park@example.com", topic: "order", message: "When will my condenser ship?", status: "new", channel: "email", created_at: day(2, 8) },
  ],
  homeownerRequests: [
    { id: "h1", reference: "H-3301", name: "Priya Shah", email: "priya.shah@example.com", phone: "(925) 555-0187", status: "received", zip: "94550", city: "Livermore", timeline: "Within a month", created_at: day(1) },
  ],
  dealerApplications: [
    { id: "d1", reference: "D-0412", company: "Coastal Comfort HVAC", contact_name: "Dana Reyes", email: "dana@coastalcomfort.example.com", phone: "(831) 555-0123", status: "under_review", account_id: null, created_at: day(3) },
  ],
  orders: [
    { id: "o1", order_number: "SO-5521", account_id: "a1", buyer_name: "Maria Lopez", buyer_email: "maria@bayheat.example.com", status: "shipped", fulfillment_status: "delivered", total: 4180, paid: true, created_at: day(30), confirmation_email_status: "sent", confirmation_email_last_attempt_at: day(30), review_request_sent_at: day(20), warranty_reminder_sent_at: day(25), maintenance_email_sent_at: null },
    { id: "o2", order_number: "SO-5590", account_id: "a2", buyer_name: "Jin Park", buyer_email: "jin.park@example.com", status: "reserved", fulfillment_status: "awaiting_pickup", total: 1450, paid: true, created_at: day(5), confirmation_email_status: "sent", confirmation_email_last_attempt_at: day(5), review_request_sent_at: null, warranty_reminder_sent_at: null, maintenance_email_sent_at: null },
  ],
  orderLines: [
    { order_id: "o1", description: "TCL 24k Outdoor Unit (TCL24KODU)", quantity: 2, unit_price: 1290, catalog_product_id: "tcl24kodu" },
    { order_id: "o1", description: "TCL 24k Indoor Unit (TCL24KIDU)", quantity: 2, unit_price: 800, catalog_product_id: "tcl24kidu" },
    { order_id: "o2", description: "TCL 18k MZ Outdoor Condenser", quantity: 1, unit_price: 1450, catalog_product_id: "tcl18kmzodu-r-410a" },
  ],
  carts: [
    { id: "k1", email: "sam.ortiz@example.com", subtotal: 620, created_at: day(4), emails_sent: 2, last_email_at: day(3), completed_at: null, unsubscribed: false },
  ],
  stockAlerts: [{ email: "priya.shah@example.com", sku_code: "TCL24KODU", created_at: day(6), notified_at: null, unsubscribed: false }],
  categoryAlerts: [],
  finderSessions: [
    { id: "f1", email: "priya.shah@example.com", path: "homeowner", segment: "homeowner_active", created_at: day(2), completed_at: day(2), shortlist_sent_at: day(2), homeowner_request_id: "h1" },
    { id: "f2", email: "lee.wong@example.com", path: "homeowner", segment: "homeowner_researching", created_at: day(7), completed_at: day(7), shortlist_sent_at: day(7), homeowner_request_id: null },
  ],
  consents: [
    { email: "priya.shah@example.com", channel: "email", source: "finder", consented_at: day(2), withdrawn_at: null },
    { email: "sam.ortiz@example.com", channel: "email", source: "checkout", consented_at: day(4), withdrawn_at: day(1) },
  ],
  emails: [
    { to_email: "jin.park@example.com", kind: "order_confirmation", subject: "Order SO-5590 confirmed", status: "sent", sent_at: day(5), related_type: "order", related_id: "o2", delivery_status: "opened" },
    { to_email: "dana@coastalcomfort.example.com", kind: "transactional", subject: "We received your dealer application", status: "sent", sent_at: day(3), related_type: null, related_id: null, delivery_status: "delivered" },
    { to_email: "maria@bayheat.example.com", kind: "shipped", subject: "Order SO-5521 has shipped", status: "sent", sent_at: day(28), related_type: "order", related_id: "o1", delivery_status: "bounced" },
  ],
  tasks: [
    { id: "t1", title: "Reply to quote request Q-1042 (Maria Lopez)", status: "open", due_at: day(-1, DUE_HOUR_UTC), source_type: "quote_requests", source_id: "q1", completed_at: null },
    { id: "t2", title: "Reply to support email E-2207 (Jin Park)", status: "open", due_at: day(1, DUE_HOUR_UTC), source_type: "contact_requests", source_id: "c1", completed_at: null },
    { id: "t3", title: "Contact homeowner about installer help H-3301 (Priya Shah)", status: "open", due_at: day(0, DUE_HOUR_UTC), source_type: "homeowner_requests", source_id: "h1", completed_at: null },
    { id: "t4", title: "Review dealer application D-0412 (Coastal Comfort HVAC)", status: "open", due_at: day(2, DUE_HOUR_UTC), source_type: "dealer_applications", source_id: "d1", completed_at: null },
  ],
  shipments: [{ order_id: "o1", carrier: "UPS Ground", tracking_number: "1Z999AA10123456784", shipped_at: day(29) }],
};
