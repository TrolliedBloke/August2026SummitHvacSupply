/**
 * Single source of truth for storefront pricing math. Imported by BOTH the
 * server order path (checkout.ts) and the client summary (checkout-client.tsx)
 * so the price a buyer sees always equals the price actually charged.
 *
 * Catalog prices themselves live on each SKU:
 *   - retail  = sku.msrp        (homeowners / guests, paid by card)
 *   - trade   = sku.dealerPrice (signed-in dealers / installers, net terms)
 * There is intentionally no derived markup here -- the numbers come straight
 * from the catalog record.
 */

// Estimated combined CA sales-tax rate for the Newark (Alameda County) hub.
// Real tax is destination-based; this is a conservative default used only to
// show an honest estimate on card checkout. Trade net-terms orders are taxed
// on the issued invoice, not here.
export const SALES_TAX_RATE = 0.1075;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function estimateTax(taxableSubtotal: number): number {
  return round2(taxableSubtotal * SALES_TAX_RATE);
}
