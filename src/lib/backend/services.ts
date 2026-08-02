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
import { createServerSupabaseClient, hasSupabaseEnv } from "./supabase";
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

export function getOperationsMode(): "supabase" | "seeded" {
  return hasSupabaseEnv() ? "supabase" : "seeded";
}

export async function getOperationsOverview(): Promise<OperationsOverview> {
  return buildOperationsOverview(data);
}

export async function getPortalOverview(role: PersonaRole): Promise<PortalOverview> {
  const user = data.users.find((candidate) => candidate.role === role) ?? data.users[0];
  const account = data.accounts.find((candidate) => candidate.id === user.accountId) ?? data.accounts[0];
  const accountScoped = <T extends { accountId: string }>(items: T[]) =>
    role === "staff" ? items : items.filter((item) => item.accountId === account.id);
  const inventory = inventoryBySku();

  return {
    role,
    account,
    userName: user.name,
    priceTier: account.priceTier,
    quotes: accountScoped(data.quotes),
    orders: accountScoped(data.salesOrders),
    invoices: accountScoped(data.invoices),
    tasks: role === "staff" ? data.tasks : data.tasks.filter((task) => task.accountId === account.id || task.ownerRole === role),
    rmas: accountScoped(data.rmas),
    warrantyClaims: accountScoped(data.warrantyClaims),
    rebateCases: accountScoped(data.rebateCases),
    recommendedSkus: data.skus.slice(0, role === "homeowner" ? 3 : 6).map((sku) => ({
      ...sku,
      available: inventory.get(sku.id)?.available ?? 0,
      seriesName: seriesName(sku.seriesSlug),
    })),
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
      supabase.from("skus").select("id, series_id, dealer_price"),
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
    existing.startingDealerPrice = Math.min(existing.startingDealerPrice, Number(sku.dealer_price));
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
  const supabase = createServerSupabaseClient();

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
    if (parsed.lines.length > 0) {
      const { error: lineError } = await supabase.from("quote_request_lines").insert(
        parsed.lines.map((line) => ({
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
    prepared: toPreparedQuote(parsed),
  };
}

export async function createDealerApplication(input: unknown) {
  const parsed = dealerApplicationSchema.parse(input);
  const supabase = createServerSupabaseClient();

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
  const supabase = createServerSupabaseClient();

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
 * reorder ("Buy Again"). Prices come from today's catalog by tier — the
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
  // Only staff or the owning account may reorder — a 404 to everyone else.
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
    const unit = trade ? sku.dealerPrice : sku.msrp;
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

function buildOperationsOverview(source: OperationsData): OperationsOverview {
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
    mode: getOperationsMode(),
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
