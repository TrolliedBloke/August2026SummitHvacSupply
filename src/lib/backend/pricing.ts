/**
 * Single source of truth for storefront pricing math. Imported by BOTH the
 * server order path (checkout.ts) and the client summary (checkout-client.tsx)
 * so the price a buyer sees always equals the price actually charged.
 *
 * Catalog prices themselves live on each SKU:
 *   - retail = sku.retailPrice (homeowners / guests, paid by card)
 *   - trade  = catalog_product_trade_pricing.contractor_price, read from the
 *              database at checkout for signed-in dealers / installers
 *
 * Trade pricing is deliberately NOT on the published SKU: the storefront
 * projection pins dealerPrice to null so contractor pricing can never reach
 * the browser. It is resolved server-side and applied by resolveUnitPrice.
 * There is intentionally no derived markup here -- the numbers come straight
 * from the catalog record or the trade-pricing table.
 */

// Combined CA sales-tax rate for the Newark (Alameda County) hub.
//
// Deliberately a hardcoded constant rather than an env var: this module is
// imported by BOTH the server order path and the client summary, so a value
// that resolved differently in the two (as any non-NEXT_PUBLIC_ env var would)
// means the buyer is shown one total and charged another.
export const SALES_TAX_RATE = 0.1075;

/**
 * Destinations whose rate has been checked, by 5-digit ZIP.
 *
 * NOT A TAX ENGINE. California sales tax is destination-based and varies by
 * district within a county, so one rate for every California ZIP (what this
 * used to do) over- or under-charges most deliveries. Until the accountant
 * picks a source (A-1: Stripe Tax recommended, or a maintained district table),
 * only destinations listed here get a computed tax. Will-call pickup is taxed
 * at the Newark counter's rate, so the warehouse ZIP is always listed.
 * Everything else returns null: card checkout refuses it and the order is
 * quoted, rather than charging a rate that may be wrong.
 *
 * Freight orders are quoted and taxed on the invoice, and trade net-terms
 * orders are taxed on the invoice too, so neither passes through here.
 */
// TODO(accountant A-1): replace with Stripe Tax or a verified district table.
export const VERIFIED_TAX_RATES: Readonly<Record<string, { rate: number; jurisdiction: string }>> = {
  "94560": { rate: SALES_TAX_RATE, jurisdiction: "Newark, Alameda County" },
};

export function isWithinTaxJurisdiction(zip: string | null | undefined): boolean {
  if (!zip) return false;
  return Object.hasOwn(VERIFIED_TAX_RATES, zip.trim().slice(0, 5));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Estimated tax, or null when the destination is outside the jurisdiction this
 * rate covers. A null result means "we cannot compute this here" and must be
 * resolved on an invoice -- it must never be coerced to 0 and presented as a
 * tax-free order.
 */
export function estimateTax(taxableSubtotal: number, zip?: string | null): number | null {
  if (!zip || !isWithinTaxJurisdiction(zip)) return null;
  return round2(taxableSubtotal * VERIFIED_TAX_RATES[zip.trim().slice(0, 5)].rate);
}

/**
 * The unit price a buyer actually pays.
 *
 * Exported so the fallback contract can be tested without a database, because
 * getting it wrong is expensive in one direction: a missing trade price must
 * become retail, NEVER zero. `catalog_product_trade_pricing` is deliberately
 * empty until the counter loads real numbers, so "no row" is the normal case,
 * not an error.
 *
 * A non-trade buyer always pays retail even if a trade price exists.
 */
export function resolveUnitPrice(
  trade: boolean,
  tradePrice: number | undefined,
  retailPrice: number
): number {
  if (!trade) return retailPrice;
  if (tradePrice === undefined || !Number.isFinite(tradePrice) || tradePrice <= 0) {
    return retailPrice;
  }
  // A "discount" above list is a data error, not a deal. Charge the lower.
  return Math.min(tradePrice, retailPrice);
}
