import { SERIES } from "@/lib/products";
import { unstable_cache } from "next/cache";
import { getSeededSeriesCardSummary } from "./catalog";
import { createDemoOperationsData } from "./mock-data";
import { invoiceBalance, summarizeInventory } from "./math";
import {
  contactRequestSchema,
  dealerApplicationSchema,
  quoteRequestSchema,
} from "./schemas";
import {
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
  hasSupabaseEnv,
} from "./supabase";
import type {
  Account,
  ContactRequestInput,
  DealerApplicationInput,
  InventorySummary,
  OperationsData,
  PersonaRole,
  QuoteRequestInput,
  Sku,
} from "./types";
import type { SeriesCardSummary } from "./catalog";
import { loadPortalData } from "./portal";
import { getStorefrontSku } from "@/lib/storefront/catalog";

const data = createDemoOperationsData();

export type OperationsOverview = {
  mode: "supabase" | "seeded";
  kpis: {
    availableUnits: number;
    reservedUnits: number;
    openQuoteRequests: number;
    openQuotes: number;
    reservedOrders: number;
    openInvoiceBalance: number;
    lowStockSkus: number;
    openCases: number;
  };
  inventory: Array<InventorySummary & { sku: Sku; seriesName: string; binCodes: string[] }>;
  quoteRequests: OperationsData["quoteRequests"];
  quotes: OperationsData["quotes"];
  orders: OperationsData["salesOrders"];
  invoices: OperationsData["invoices"];
  purchaseOrders: OperationsData["purchaseOrders"];
  rmas: OperationsData["rmas"];
  warrantyClaims: OperationsData["warrantyClaims"];
  rebateCases: OperationsData["rebateCases"];
  tasks: OperationsData["tasks"];
  activity: OperationsData["activity"];
  accounts: Account[];
};

export type PortalOverview = {
  role: PersonaRole;
  account: Account;
  userName: string;
  priceTier: string;
  quotes: OperationsData["quotes"];
  orders: OperationsData["salesOrders"];
  invoices: OperationsData["invoices"];
  tasks: OperationsData["tasks"];
  rmas: OperationsData["rmas"];
  warrantyClaims: OperationsData["warrantyClaims"];
  rebateCases: OperationsData["rebateCases"];
  recommendedSkus: Array<Sku & { available: number; seriesName: string }>;
};

export type SeriesBackendSummary = {
  skus: Array<Sku & { available: number; status: InventorySummary["status"] }>;
  availableUnits: number;
  startingDealerPrice: number;
  documents: OperationsData["skuDocuments"];
};

/**
 * Whether Supabase credentials are configured. This says nothing about where
 * any particular figure came from -- see getOperationsOverview.
 */
export function getOperationsMode(): "supabase" | "seeded" {
  return hasSupabaseEnv() ? "supabase" : "seeded";
}

export async function getOperationsOverview(): Promise<OperationsOverview> {
  // `data` is createDemoOperationsData(). Every KPI below is computed from that
  // fixture, so the mode reported to the admin dashboard is "seeded" whatever
  // the environment says.
  //
  // It previously reported getOperationsMode(), which is true only of the env
  // vars: with Supabase configured the dashboard rendered a green "Supabase
  // connected" badge above numbers that were entirely fabricated. Staff reading
  // available units, reserved orders or open invoice balance would have been
  // reading the fixture. Real account-backed operations queries are not
  // implemented yet; until they are, this must say seeded.
  return buildOperationsOverview(data, "seeded");
}

/**
 * Raised when the portal cannot serve real account data. The portal shows an
 * explicit unavailable state rather than another account's records.
 */
export class PortalUnavailableError extends Error {}

/**
 * Portal data for ONE authenticated identity.
 *
 * Previously this took only a role and looked the "user" up by role from a
 * shared demo fixture, so every dealer who ever signed in saw the same
 * fabricated account, orders, invoices and inventory -- and `accountScoped`
 * filtered against that fixture account rather than the caller's own.
 *
 * It now takes the authenticated profile and scopes to `profile.accountId`.
 * The underlying store is still the seeded fixture, which is why production
 * refuses to serve it: real account-backed queries against Supabase are not
 * implemented yet, and inventing data for a signed-in dealer is worse than an
 * honest error.
 */
export async function getPortalOverview(profile: {
  userId: string;
  name: string;
  role: PersonaRole;
  accountId: string | null;
}): Promise<PortalOverview> {
  const role = profile.role;
  const inventory = inventoryBySku();

  // Product suggestions are catalog data, identical for everyone and containing
  // nothing account-specific, so they stay sourced from the catalog fixture.
  const recommendedSkus = data.skus.slice(0, role === "homeowner" ? 3 : 6).map((sku) => ({
    ...sku,
    available: inventory.get(sku.id)?.available ?? 0,
    seriesName: seriesName(sku.seriesSlug),
  }));

  // A signed-in user with no account has no account-scoped records. Saying so
  // is correct; showing a fixture account's orders is not.
  if (!profile.accountId) {
    throw new PortalUnavailableError(
      "This login is not linked to a wholesale account yet. Contact us to finish account setup."
    );
  }

  if (hasSupabaseEnv()) {
    // Real, account-scoped data. Every query filters on the authenticated
    // profile's account_id -- see loadPortalData.
    const portal = await loadPortalData(profile.accountId, role);
    return {
      role,
      account: portal.account,
      userName: profile.name,
      priceTier: portal.account.priceTier,
      quotes: portal.quotes,
      orders: portal.orders,
      invoices: portal.invoices,
      tasks: portal.tasks,
      rmas: portal.rmas,
      warrantyClaims: portal.warrantyClaims,
      rebateCases: portal.rebateCases,
      recommendedSkus,
    };
  }

  // No database configured. Production must never fabricate account data.
  if (process.env.NODE_ENV === "production") {
    throw new PortalUnavailableError(
      "Portal data is unavailable right now. No account information could be loaded."
    );
  }

  // Development only, and still scoped to the caller's own account id.
  const account = data.accounts.find((candidate) => candidate.id === profile.accountId);
  if (!account) {
    throw new PortalUnavailableError(
      "This login is not linked to a wholesale account yet. Contact us to finish account setup."
    );
  }
  const accountScoped = <T extends { accountId: string }>(items: T[]) =>
    role === "staff" ? items : items.filter((item) => item.accountId === account.id);

  return {
    role,
    account,
    userName: profile.name,
    priceTier: account.priceTier,
    quotes: accountScoped(data.quotes),
    orders: accountScoped(data.salesOrders),
    invoices: accountScoped(data.invoices),
    tasks: role === "staff" ? data.tasks : data.tasks.filter((task) => task.accountId === account.id || task.ownerRole === role),
    rmas: accountScoped(data.rmas),
    warrantyClaims: accountScoped(data.warrantyClaims),
    rebateCases: accountScoped(data.rebateCases),
    recommendedSkus,
  };
}

export async function getSeriesBackendSummary(slug: string): Promise<SeriesBackendSummary> {
  const summaries = inventoryBySku();
  const skus = data.skus
    .filter((sku) => sku.seriesSlug === slug)
    .map((sku) => {
      const summary = summaries.get(sku.id);
      return {
        ...sku,
        available: summary?.available ?? 0,
        status: summary?.status ?? "backorder",
      };
    });
  const documents = data.skuDocuments.filter((doc) => skus.some((sku) => sku.id === doc.skuId));
  return {
    skus,
    documents,
    availableUnits: skus.reduce((sum, sku) => sum + sku.available, 0),
    startingDealerPrice: Math.min(...skus.map((sku) => sku.dealerPrice)),
  };
}

export async function getCatalogBackendSummaries(): Promise<Record<string, SeriesBackendSummary>> {
  const entries = await Promise.all(SERIES.map(async (series) => [series.slug, await getSeriesBackendSummary(series.slug)] as const));
  return Object.fromEntries(entries);
}

async function loadSeriesCardSummaries(): Promise<Record<string, SeriesCardSummary>> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return Object.fromEntries(
      SERIES.map((series) => {
        const summary = getSeededSeriesCardSummary(series.slug);
        return [series.slug, summary] as const;
      })
    );
  }

  const [{ data: seriesRows, error: seriesError }, { data: skuRows, error: skuError }, { data: lotRows, error: lotError }] =
    await Promise.all([
      supabase.from("product_series").select("id, slug"),
      // dealer_price is deliberately NOT selected. This runs on the public
      // (anon) client, and migration 015 revokes that column from anon because
      // it was world-readable. Nothing renders startingDealerPrice, so the
      // public path has no reason to carry trade pricing at all.
      supabase.from("skus").select("id, series_id"),
      supabase.from("inventory_lots").select("sku_id, on_hand, reserved"),
    ]);

  if (seriesError || skuError || lotError || !seriesRows || !skuRows || !lotRows) {
    return Object.fromEntries(
      SERIES.map((series) => {
        const summary = getSeededSeriesCardSummary(series.slug);
        return [series.slug, summary] as const;
      })
    );
  }

  const slugBySeriesId = new Map(seriesRows.map((row) => [row.id, row.slug]));
  const availableBySku = new Map<string, number>();
  for (const lot of lotRows) {
    availableBySku.set(
      lot.sku_id,
      (availableBySku.get(lot.sku_id) ?? 0) + Number(lot.on_hand) - Number(lot.reserved)
    );
  }

  const summaries = new Map<string, SeriesCardSummary>();
  for (const sku of skuRows) {
    const slug = slugBySeriesId.get(sku.series_id);
    if (!slug) continue;
    const existing = summaries.get(slug) ?? {
      skuCount: 0,
      availableUnits: 0,
      startingDealerPrice: Number.POSITIVE_INFINITY,
    };
    existing.skuCount += 1;
    existing.availableUnits += availableBySku.get(sku.id) ?? 0;
    // Left at its initial value: trade pricing is not readable from the public
    // client and is not displayed on series cards. The field is normalised to 0
    // below rather than reporting a price this path cannot legitimately know.
    summaries.set(slug, existing);
  }

  return Object.fromEntries(
    SERIES.map((series) => {
      const live = summaries.get(series.slug);
      const summary = live
        ? {
            ...live,
            startingDealerPrice: Number.isFinite(live.startingDealerPrice)
              ? live.startingDealerPrice
              : 0,
          }
        : getSeededSeriesCardSummary(series.slug);
      return [series.slug, summary] as const;
    })
  );
}

export const getSeriesCardSummaries = unstable_cache(loadSeriesCardSummaries, ["series-card-summaries"], {
  revalidate: 60,
});

export async function createQuoteRequest(input: unknown) {
  const parsed = quoteRequestSchema.parse(input);
  const canonicalLines = parsed.lines.map((line) => {
    const product = getStorefrontSku(line.skuId) ?? getStorefrontSku(line.sku);
    if (!product || !product.quoteEligible) throw new Error(`Product ${line.sku} is not available for quoting.`);
    return {
      skuId: product.id,
      sku: product.sku,
      modelNumber: product.modelNumber,
      productName: product.title,
      quantity: line.quantity,
    };
  });
  const canonicalRequest = { ...parsed, lines: canonicalLines };
  // Public form writes use the SERVICE ROLE, not the anon client.
  // The anon key is in the browser, so an anon INSERT policy means anyone can
  // POST straight to /rest/v1/<table> and skip this function entirely --
  // no zod validation, no rate limit, no canonical SKU resolution. Writing as
  // the service role lets migration 017 revoke anon INSERT, which makes this
  // server action the only way in.
  const supabase = createServiceRoleSupabaseClient();

  if (supabase) {
    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("quote_requests")
      .insert({
        id,
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        need: parsed.need,
      });
    if (error) throw new Error(error.message);
    if (canonicalLines.length > 0) {
      const { error: lineError } = await supabase.from("quote_request_lines").insert(
        canonicalLines.map((line) => ({
          quote_request_id: id,
          series_slug: line.sku,
          product_name: `${line.productName} (${line.modelNumber})`,
          quantity: line.quantity,
        }))
      );
      if (lineError) throw new Error(lineError.message);
    }
    return { id, mode: "supabase" as const };
  }

  return {
    id: `qr-${Date.now()}`,
    mode: "seeded" as const,
    prepared: toPreparedQuote(canonicalRequest),
  };
}

export async function createDealerApplication(input: unknown) {
  const parsed = dealerApplicationSchema.parse(input);
  // Public form writes use the SERVICE ROLE, not the anon client.
  // The anon key is in the browser, so an anon INSERT policy means anyone can
  // POST straight to /rest/v1/<table> and skip this function entirely --
  // no zod validation, no rate limit, no canonical SKU resolution. Writing as
  // the service role lets migration 017 revoke anon INSERT, which makes this
  // server action the only way in.
  const supabase = createServiceRoleSupabaseClient();

  if (supabase) {
    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("dealer_applications")
      .insert({
        id,
        company: parsed.company,
        contact_name: parsed.contactName,
        email: parsed.email,
        phone: parsed.phone,
        license_number: parsed.licenseNumber,
        service_area: parsed.serviceArea,
        business_type: parsed.businessType,
        monthly_volume: parsed.monthlyVolume,
        brands: parsed.brands,
        notes: parsed.notes,
      });
    if (error) throw new Error(error.message);
    return { id, mode: "supabase" as const };
  }

  return {
    id: `dealer-${Date.now()}`,
    mode: "seeded" as const,
    status: "pending_review",
    company: parsed.company,
  };
}

export async function createContactRequest(input: unknown) {
  const parsed = contactRequestSchema.parse(input);
  // Public form writes use the SERVICE ROLE, not the anon client.
  // The anon key is in the browser, so an anon INSERT policy means anyone can
  // POST straight to /rest/v1/<table> and skip this function entirely --
  // no zod validation, no rate limit, no canonical SKU resolution. Writing as
  // the service role lets migration 017 revoke anon INSERT, which makes this
  // server action the only way in.
  const supabase = createServiceRoleSupabaseClient();

  if (supabase) {
    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("contact_requests")
      .insert({
        id,
        topic: parsed.topic,
        name: parsed.name,
        email: parsed.email,
        message: parsed.message,
      });
    if (error) throw new Error(error.message);
    return { id, mode: "supabase" as const };
  }

  return {
    id: `contact-${Date.now()}`,
    mode: "seeded" as const,
    title: `${parsed.topic}: ${parsed.name}`,
  };
}

export function roleCanAccessAccount(role: PersonaRole, accountId: string, requestedAccountId: string): boolean {
  return role === "staff" || accountId === requestedAccountId;
}

export type ReorderItem = {
  skuId: string;
  sku: string;
  modelNumber: string;
  title: string;
  image: string;
  qty: number;
  unitPrice: number;       // current price for the requesting tier
  priceChanged: boolean;   // vs what the original order paid
  available: number;
};

/**
 * Resolve a past order's lines against the CURRENT catalog for one-click
 * reorder ("Buy Again"). Prices come from today's catalog by tier -- the
 * original order's prices are only used to flag changes. Lines whose SKU no
 * longer exists are counted, not silently dropped.
 */
export function getReorderItems(
  orderId: string,
  role: PersonaRole,
  accountId: string | null
): { orderNumber: string; items: ReorderItem[]; unresolved: number } | null {
  const order = data.salesOrders.find((candidate) => candidate.id === orderId);
  if (!order) return null;
  // Only staff or the owning account may reorder -- a 404 to everyone else.
  if (!roleCanAccessAccount(role, accountId ?? "", order.accountId)) return null;
  const trade = role === "dealer" || role === "installer" || role === "staff";
  const lines = data.orderLines.filter((line) => line.orderId === orderId);
  const items: ReorderItem[] = [];
  let unresolved = 0;
  for (const line of lines) {
    const sku = getStorefrontSku(line.skuId);
    if (!sku) {
      unresolved++;
      continue;
    }
    // Retail is the floor when no trade price exists; reorder must never quote 0.
    const unit = trade && sku.dealerPrice !== null && sku.dealerPrice > 0 ? sku.dealerPrice : sku.msrp;
    items.push({
      skuId: sku.id,
      sku: sku.sku,
      modelNumber: sku.modelNumber,
      title: sku.title,
      image: sku.image,
      qty: line.quantity,
      unitPrice: unit,
      priceChanged: Math.abs(unit - line.unitPrice) >= 0.01,
      available: sku.available,
    });
  }
  return { orderNumber: order.orderNumber, items, unresolved };
}

export function resetSeededDemo() {
  return createDemoOperationsData();
}

function buildOperationsOverview(
  source: OperationsData,
  mode: OperationsOverview["mode"]
): OperationsOverview {
  const inventorySummaries = summarizeInventory(source.inventoryLots);
  const inventory = inventorySummaries.map((summary) => {
    const sku = source.skus.find((candidate) => candidate.id === summary.skuId)!;
    return {
      ...summary,
      sku,
      seriesName: seriesName(sku.seriesSlug),
      binCodes: source.inventoryLots
        .filter((lot) => lot.skuId === sku.id)
        .map((lot) => lot.binCode),
    };
  });
  const openInvoiceBalance = source.invoices
    .filter((invoice) => invoice.status === "open" || invoice.status === "overdue" || invoice.status === "partial")
    .reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  return {
    mode,
    kpis: {
      availableUnits: inventory.reduce((sum, item) => sum + item.available, 0),
      reservedUnits: inventory.reduce((sum, item) => sum + item.reserved, 0),
      openQuoteRequests: source.quoteRequests.filter((request) => request.status === "new").length,
      openQuotes: source.quotes.filter((quote) => quote.status === "sent" || quote.status === "draft").length,
      reservedOrders: source.salesOrders.filter((order) => order.status === "reserved").length,
      openInvoiceBalance,
      lowStockSkus: inventory.filter((item) => item.status !== "ready").length,
      openCases: [...source.rmas, ...source.warrantyClaims, ...source.rebateCases].filter((record) => record.status === "open" || record.status === "waiting").length,
    },
    inventory,
    quoteRequests: source.quoteRequests,
    quotes: source.quotes,
    orders: source.salesOrders,
    invoices: source.invoices,
    purchaseOrders: source.purchaseOrders,
    rmas: source.rmas,
    warrantyClaims: source.warrantyClaims,
    rebateCases: source.rebateCases,
    tasks: source.tasks,
    activity: source.activity,
    accounts: source.accounts,
  };
}

function inventoryBySku() {
  return new Map(summarizeInventory(data.inventoryLots).map((summary) => [summary.skuId, summary]));
}

function seriesName(slug: string): string {
  return SERIES.find((series) => series.slug === slug)?.name ?? slug;
}

function toPreparedQuote(parsed: QuoteRequestInput) {
  return {
    customer: parsed.name,
    lineCount: parsed.lines.length,
    unitCount: parsed.lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export type { ContactRequestInput, DealerApplicationInput, QuoteRequestInput };
