import { quoteDraftSchema, QUOTE_MAX_QUANTITY, QUOTE_RESPONSE_WINDOW, type CompatibilityNote, type QuoteLineCheck } from "@/lib/forms/quote";
import { makeReference } from "@/lib/forms/result";
import { getStorefrontSku, type StorefrontSku } from "@/lib/storefront/catalog";
import { createServiceRoleSupabaseClient } from "./supabase";
import { rememberedResult, rememberResult } from "./idempotency";

/**
 * Canonicalize and merge quote lines, visibly. Every input line comes back
 * with what happened to it: kept, merged into an earlier line for the same
 * product, or rejected as unknown or not quotable -- instead of the whole
 * request failing on one bad SKU.
 */
export function checkQuoteLines(lines: Array<{ skuId: string; sku: string; quantity: number }>): { lines: QuoteLineCheck[]; merged: Array<{ sku: StorefrontSku; quantity: number }> } {
  const checks: QuoteLineCheck[] = [];
  const merged = new Map<string, { sku: StorefrontSku; quantity: number }>();
  for (const line of lines) {
    const product = getStorefrontSku(line.skuId) ?? getStorefrontSku(line.sku);
    if (!product) {
      checks.push({ skuId: line.skuId, input: line, status: "unknown", quantity: line.quantity, message: `${line.sku} is not in our catalog. Remove it or describe it in the project details.` });
      continue;
    }
    if (!product.quoteEligible) {
      checks.push({ skuId: line.skuId, input: line, status: "unavailable", quantity: line.quantity, message: `${product.sku} is not available to quote right now.` });
      continue;
    }
    const existing = merged.get(product.id);
    const canonical = { skuId: product.id, sku: product.sku, title: product.title, modelNumber: product.modelNumber };
    if (existing) {
      existing.quantity = Math.min(QUOTE_MAX_QUANTITY, existing.quantity + line.quantity);
      checks.push({ skuId: line.skuId, input: line, status: "merged", canonical, quantity: existing.quantity, message: `Combined with the earlier ${product.sku} line.` });
      continue;
    }
    merged.set(product.id, { sku: product, quantity: line.quantity });
    checks.push({ skuId: line.skuId, input: line, status: "valid", canonical, quantity: line.quantity });
  }
  return { lines: checks, merged: Array.from(merged.values()) };
}

/**
 * Compatibility, only from verified data. A pairing is "verified" only when
 * the catalog carries a SOURCED compatibleOutdoorSku for the indoor unit; any
 * other indoor/outdoor combination is "unverified" -- a review note, never a
 * claim of incompatibility.
 */
export function compatibilityNotes(products: StorefrontSku[]): CompatibilityNote[] {
  const indoor = products.filter((sku) => /indoor|air handler|cassette/i.test(sku.productType));
  const outdoor = products.filter((sku) => /outdoor|condenser|heat pump/i.test(sku.productType) && !/indoor/i.test(sku.productType));
  const notes: CompatibilityNote[] = [];
  for (const unit of indoor) {
    for (const partner of outdoor) {
      const sourced = Boolean(unit.compatibleOutdoorSku && unit.fieldSources.compatibleOutdoorSku);
      const listed = unit.compatibleOutdoorSku === partner.sku;
      notes.push(
        sourced && listed
          ? { indoorSku: unit.sku, outdoorSku: partner.sku, verdict: "verified_compatible", message: `${unit.sku} with ${partner.sku} is a manufacturer-listed match.` }
          : { indoorSku: unit.sku, outdoorSku: partner.sku, verdict: "unverified", message: `Staff will confirm ${unit.sku} and ${partner.sku} work together before quoting.` }
      );
    }
  }
  return notes;
}

export type QuoteReceipt = {
  id: string;
  reference: string;
  lifecycle: "received" | "needs_information";
  responseWindow: string;
  lineCount: number;
  mode: "supabase" | "seeded";
};

/** Store a typed quote request. Retries with the same client request id return the first receipt. */
export async function submitQuoteDraft(input: unknown): Promise<QuoteReceipt & { lines: QuoteLineCheck[] }> {
  const parsed = quoteDraftSchema.parse(input);
  const replay = rememberedResult<QuoteReceipt & { lines: QuoteLineCheck[] }>("quote", parsed.clientRequestId);
  if (replay) return replay;

  const { lines, merged } = checkQuoteLines(parsed.lines);
  const rejected = lines.filter((line) => line.status === "unknown" || line.status === "unavailable");
  if (rejected.length) {
    throw Object.assign(new Error("quote lines rejected"), { lineErrors: lines });
  }
  // Too little to quote from: accepted, but explicitly marked as needing more.
  const lifecycle: QuoteReceipt["lifecycle"] = merged.length === 0 && (parsed.notes?.length ?? 0) < 60 ? "needs_information" : "received";
  const reference = makeReference("Q");

  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    if (parsed.clientRequestId) {
      const { data } = await supabase.from("quote_requests").select("id, reference, lifecycle").eq("client_request_id", parsed.clientRequestId).maybeSingle();
      if (data) {
        return { id: String(data.id), reference: String(data.reference), lifecycle: data.lifecycle as QuoteReceipt["lifecycle"], responseWindow: QUOTE_RESPONSE_WINDOW, lineCount: merged.length, mode: "supabase", lines };
      }
    }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("quote_requests").insert({
      id,
      reference,
      client_request_id: parsed.clientRequestId ?? null,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone || null,
      need: parsed.notes || `${merged.length} product lines`,
      project_type: parsed.projectType,
      zip: parsed.zip || null,
      requested_date: parsed.requestedDate || null,
      lifecycle,
    });
    if (error) throw new Error(error.message);
    if (merged.length) {
      const intents = new Map(parsed.lines.map((line) => [line.skuId, line.intent]));
      const { error: lineError } = await supabase.from("quote_request_lines").insert(
        merged.map(({ sku, quantity }) => ({
          quote_request_id: id,
          series_slug: sku.sku,
          catalog_product_id: sku.id,
          product_name: `${sku.title} (${sku.modelNumber})`,
          quantity,
          intent: intents.get(sku.id) ?? "quote",
          validation: "canonical",
        }))
      );
      if (lineError) throw new Error(lineError.message);
    }
    const receipt = { id, reference, lifecycle, responseWindow: QUOTE_RESPONSE_WINDOW, lineCount: merged.length, mode: "supabase" as const, lines };
    rememberResult("quote", parsed.clientRequestId, receipt);
    return receipt;
  }
  const receipt = { id: `qr-${Date.now()}`, reference, lifecycle, responseWindow: QUOTE_RESPONSE_WINDOW, lineCount: merged.length, mode: "seeded" as const, lines };
  rememberResult("quote", parsed.clientRequestId, receipt);
  return receipt;
}
