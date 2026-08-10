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

// Combined CA sales-tax rate for the Newark (Alameda County) hub.
//
// Deliberately a hardcoded constant rather than an env var: this module is
// imported by BOTH the server order path and the client summary, so a value
// that resolved differently in the two (as any non-NEXT_PUBLIC_ env var would)
// means the buyer is shown one total and charged another.
export const SALES_TAX_RATE = 0.1075;

/**
 * ZIP range for the only jurisdiction this rate is valid in.
 *
 * NOT A TAX ENGINE. US sales tax is destination-based and varies by district
 * within a single county; this covers the current business, which is will-call
 * at the Newark hub plus Bay Area local delivery. Freight orders are quoted and
 * taxed on the invoice, and trade net-terms orders are taxed on the invoice
 * too, so neither passes through here.
 *
 * Selling into another state, or shipping parcels interstate, requires a real
 * tax service (nexus tracking, product taxability, exemption certificates)
 * before this function can be trusted. Until then an out-of-jurisdiction
 * destination returns null rather than silently applying an Alameda rate to it.
 */
const CA_ZIP_MIN = 90001;
const CA_ZIP_MAX = 96162;

export function isWithinTaxJurisdiction(zip: string | null | undefined): boolean {
  if (!zip) return false;
  const numeric = Number(zip.slice(0, 5));
  return Number.isInteger(numeric) && numeric >= CA_ZIP_MIN && numeric <= CA_ZIP_MAX;
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
  if (!isWithinTaxJurisdiction(zip)) return null;
  return round2(taxableSubtotal * SALES_TAX_RATE);
}
