// Deliberately NOT marked `server-only`. That specifier is aliased by Next at
// build time and does not resolve in the unit-test runner, and services.ts --
// which imports this -- is covered by tests. The actual guard against a browser
// reaching the service role is that SUPABASE_SERVICE_ROLE_KEY has no
// NEXT_PUBLIC_ prefix, so createServiceRoleSupabaseClient() returns null client
// side; ./supabase.ts relies on the same thing for the same reason.
import { createServiceRoleSupabaseClient } from "./supabase";
import type {
  Account,
  CaseRecord,
  Invoice,
  PersonaRole,
  Quote,
  SalesOrder,
  Task,
} from "./types";

/**
 * Account-scoped portal data, read from the database.
 *
 * This replaces the fixture lookup that `getPortalOverview` used to perform.
 * That version selected a "user" from `createDemoOperationsData()` by ROLE, so
 * every dealer who ever signed in saw one shared, fabricated account with its
 * orders, invoices and inventory -- and the account-scoping filter compared
 * against that fixture account rather than the caller's own.
 *
 * Two rules hold everywhere below:
 *
 *  1. `accountId` comes from the authenticated session profile
 *     (user_profiles.account_id, set by staff), never from client input.
 *  2. Every query filters on it explicitly. The service role bypasses RLS, so
 *     the filter IS the authorization boundary here -- there is no policy
 *     underneath to catch a missing `.eq("account_id", ...)`. A staff caller is
 *     the only one that may omit it.
 */

export type PortalData = {
  account: Account;
  quotes: Quote[];
  orders: SalesOrder[];
  invoices: Invoice[];
  tasks: Task[];
  rmas: CaseRecord[];
  warrantyClaims: CaseRecord[];
  rebateCases: CaseRecord[];
};

/** Thrown when real portal data cannot be served. Never falls back to fixtures. */
export class PortalDataUnavailableError extends Error {}

const num = (value: unknown): number => Number(value ?? 0);

function mapAccount(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    type: row.type as Account["type"],
    name: String(row.name),
    status: String(row.status ?? "active"),
    priceTier: String(row.price_tier ?? "standard"),
    creditLimit: num(row.credit_limit),
    balance: num(row.balance),
    serviceArea: (row.service_area as string) ?? undefined,
    licenseNumber: (row.license_number as string) ?? undefined,
  };
}

function mapCases(rows: Array<Record<string, unknown>>, prefix: string): CaseRecord[] {
  return rows.map((row) => ({
    id: String(row.id),
    number: String(row.number ?? `${prefix}-${String(row.id).slice(0, 8)}`),
    accountId: String(row.account_id),
    skuId: (row.sku_id as string) ?? undefined,
    status: (row.status as CaseRecord["status"]) ?? "open",
    title: String(row.title ?? ""),
    detail: String(row.detail ?? ""),
  }));
}

/**
 * Load one account's portal data. `accountId` must already be authorized --
 * this function trusts it and scopes every query to it.
 */
export async function loadPortalData(
  accountId: string,
  role: PersonaRole
): Promise<PortalData> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) {
    throw new PortalDataUnavailableError(
      "Account data is unavailable right now. Please try again shortly."
    );
  }

  const scoped = <T>(builder: T): T =>
    // Staff see everything; every other role is pinned to their own account.
    role === "staff" ? builder : (builder as { eq: (c: string, v: string) => T }).eq("account_id", accountId);

  const [accountRes, quotesRes, ordersRes, invoicesRes, tasksRes, rmasRes, warrantyRes, rebatesRes] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("id", accountId).maybeSingle(),
      scoped(supabase.from("quotes").select("*")),
      scoped(supabase.from("sales_orders").select("*")),
      scoped(supabase.from("invoices").select("*")),
      scoped(supabase.from("tasks").select("*")),
      scoped(supabase.from("rmas").select("*")),
      scoped(supabase.from("warranty_claims").select("*")),
      scoped(supabase.from("rebate_cases").select("*")),
    ]);

  if (accountRes.error || !accountRes.data) {
    throw new PortalDataUnavailableError(
      "This login is not linked to a wholesale account yet. Contact us to finish account setup."
    );
  }

  const rows = (res: { data: unknown }): Array<Record<string, unknown>> =>
    (res.data as Array<Record<string, unknown>>) ?? [];

  return {
    account: mapAccount(accountRes.data as Record<string, unknown>),
    quotes: rows(quotesRes).map((row) => ({
      id: String(row.id),
      quoteNumber: String(row.quote_number ?? ""),
      accountId: String(row.account_id),
      status: (row.status as Quote["status"]) ?? "draft",
      subtotal: num(row.subtotal),
      tax: num(row.tax),
      total: num(row.total),
      validUntil: String(row.valid_until ?? ""),
    })),
    orders: rows(ordersRes).map((row) => ({
      id: String(row.id),
      orderNumber: String(row.order_number ?? ""),
      quoteId: (row.quote_id as string) ?? undefined,
      accountId: String(row.account_id ?? accountId),
      status: (row.status as SalesOrder["status"]) ?? "pending",
      subtotal: num(row.subtotal),
      total: num(row.total),
    })),
    invoices: rows(invoicesRes).map((row) => {
      const total = num(row.total);
      const paid = num(row.paid);
      return {
        id: String(row.id),
        invoiceNumber: String(row.invoice_number ?? ""),
        accountId: String(row.account_id),
        orderId: (row.order_id as string) ?? undefined,
        status: (row.status as Invoice["status"]) ?? "open",
        subtotal: num(row.subtotal),
        tax: num(row.tax),
        total,
        paid,
        // Derived here rather than trusted from the row: a stale stored
        // balance is how a customer gets shown the wrong amount owed.
        balance: Math.round((total - paid) * 100) / 100,
        dueDate: String(row.due_date ?? ""),
      };
    }),
    tasks: rows(tasksRes).map((row) => ({
      id: String(row.id),
      accountId: String(row.account_id),
      title: String(row.title ?? ""),
      ownerRole: (row.owner_role as PersonaRole) ?? "staff",
      status: (row.status as Task["status"]) ?? "open",
      dueAt: String(row.due_at ?? ""),
    })),
    rmas: mapCases(rows(rmasRes), "RMA"),
    warrantyClaims: mapCases(rows(warrantyRes), "WC"),
    rebateCases: mapCases(rows(rebatesRes), "RB"),
  };
}

/**
 * Trade pricing for the signed-in account's tier.
 *
 * Returns an empty map when no trade pricing has been loaded, which is the
 * current state -- catalog_product_trade_pricing is intentionally empty rather
 * than seeded with invented numbers. Callers must treat a missing entry as
 * "no trade price on file" and fall back to quote/retail, never to 0.
 */
export async function loadTradePricing(
  productIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (productIds.length === 0) return out;

  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("catalog_product_trade_pricing")
    .select("product_id, contractor_price")
    .in("product_id", productIds);

  if (error || !data) return out;
  for (const row of data as Array<{ product_id: string; contractor_price: number | null }>) {
    if (row.contractor_price !== null && row.contractor_price > 0) {
      out.set(row.product_id, Number(row.contractor_price));
    }
  }
  return out;
}
