import "server-only";
import { requireStaff } from "./auth";
import { createServiceRoleSupabaseClient } from "./supabase";
import { allowUnauthenticatedAdmin } from "./supabase-ssr";
import { buildPeople, type CrmRows, type Person } from "@/lib/crm/people";
import { DEMO_CRM_ROWS } from "@/lib/crm/demo-rows";

/**
 * The customer view's data: every table that captures an email, read with the
 * service role behind requireStaff, folded into people by src/lib/crm/people.ts.
 *
 * Without the service role there is no live data. In local demo mode
 * (ALLOW_UNAUTHENTICATED_ADMIN, inert in production) the page shows a small,
 * clearly labelled fictional dataset so the screens can be developed; anywhere
 * else it says the database is not connected rather than showing anything
 * invented.
 */

export class CustomersUnavailableError extends Error {}

export type CustomersResult = { source: "supabase" | "demo"; loadedAt: string; people: Person[]; truncated: string[] };

/** Per-table cap. The view says so when a table hits it, rather than silently dropping people. */
const LIMIT = 5000;

const SELECTS: Record<keyof CrmRows, [table: string, columns: string, orderBy: string]> = {
  profiles: ["user_profiles", "id, email, name, role, account_id, access_status, created_at", "created_at"],
  accounts: ["accounts", "id, type, name, status, price_tier, license_verified_at", "created_at"],
  contacts: ["contacts", "account_id, name, email, phone, role, created_at", "created_at"],
  quoteRequests: ["quote_requests", "id, reference, name, email, phone, need, lifecycle, status, project_type, zip, account_id, created_at", "created_at"],
  contactRequests: ["contact_requests", "id, reference, name, email, topic, message, status, created_at", "created_at"],
  homeownerRequests: ["homeowner_requests", "id, reference, name, email, phone, status, zip, city, timeline, created_at", "created_at"],
  dealerApplications: ["dealer_applications", "id, reference, company, contact_name, email, phone, status, account_id, created_at", "created_at"],
  orders: [
    "sales_orders",
    "id, order_number, account_id, buyer_name, buyer_email, status, fulfillment_status, total, paid, created_at, confirmation_email_status, confirmation_email_last_attempt_at, review_request_sent_at, warranty_reminder_sent_at, maintenance_email_sent_at",
    "created_at",
  ],
  orderLines: ["order_lines", "order_id, description, quantity, unit_price, catalog_product_id", "id"],
  carts: ["cart_snapshots", "id, email, subtotal, created_at, emails_sent, last_email_at, completed_at, unsubscribed", "created_at"],
  stockAlerts: ["back_in_stock_subscriptions", "email, sku_code, created_at, notified_at, unsubscribed", "created_at"],
  categoryAlerts: ["category_stock_alerts", "email, category, created_at, last_notified_at, unsubscribed", "created_at"],
  finderSessions: ["finder_sessions", "id, email, path, segment, created_at, completed_at, shortlist_sent_at, homeowner_request_id", "created_at"],
  consents: ["marketing_consents", "email, channel, source, consented_at, withdrawn_at", "created_at"],
  emails: ["email_messages", "to_email, kind, subject, status, sent_at, related_type, related_id", "sent_at"],
};

export async function loadCustomers(now = new Date()): Promise<CustomersResult> {
  const demo = allowUnauthenticatedAdmin();
  if (!demo) await requireStaff("/admin/customers");

  const db = createServiceRoleSupabaseClient();
  if (!db) {
    if (demo) return { source: "demo", loadedAt: now.toISOString(), people: buildPeople(DEMO_CRM_ROWS, now), truncated: [] };
    throw new CustomersUnavailableError("The customer view needs SUPABASE_SERVICE_ROLE_KEY on the server.");
  }

  const keys = Object.keys(SELECTS) as Array<keyof CrmRows>;
  const results = await Promise.all(
    keys.map(async (key) => {
      const [table, columns, orderBy] = SELECTS[key];
      const { data, error } = await db.from(table).select(columns).order(orderBy, { ascending: false }).limit(LIMIT);
      // email_messages arrives with migration 036; before it runs the view
      // still works from the reconstructed history.
      if (error && key === "emails") return [key, [], false] as const;
      if (error) throw new CustomersUnavailableError(`Could not read ${table}: ${error.message}`);
      return [key, data ?? [], (data?.length ?? 0) >= LIMIT] as const;
    })
  );

  const rows = Object.fromEntries(results.map(([key, data]) => [key, data])) as unknown as CrmRows;
  return {
    source: "supabase",
    loadedAt: now.toISOString(),
    people: buildPeople(rows, now),
    truncated: results.filter(([, , capped]) => capped).map(([key]) => SELECTS[key][0]),
  };
}
