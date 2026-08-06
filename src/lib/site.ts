// Real business facts — single source of truth. No placeholder social links anywhere.
export const SITE = {
  name: "Summit HVAC Supply",
  legalName: "Summit HVAC Supply",
  origin: "https://www.summithvacsupply.com",
  tagline: "Bay Area TCL heat pumps and mini splits, supplied locally",
  brandLine: "Bay Area TCL HVAC supply from Newark, CA",
  address: {
    street: "5437 Central Ave., Suite 10",
    city: "Newark",
    state: "CA",
    zip: "94560",
    full: "5437 Central Ave., Suite 10, Newark, CA 94560",
  },
  phone: "(415) 988-4445",
  phoneHref: "tel:+14159884445",
  smsHref: "sms:+14159884445",
  email: "info@summithvacsupply.com",
  emailHref: "mailto:info@summithvacsupply.com",
  hours: "Mon-Fri 7:00a-5:00p PT · Newark will-call, Bay Area delivery & freight",
  serviceArea: "San Jose, Oakland, Fremont, San Francisco, the Peninsula, East Bay, South Bay, North Bay & nearby Bay Area cities",
  broaderServiceArea: "California, Oregon, Washington, Nevada & Arizona",
  ahriDirectory: "https://www.ahridirectory.org/",
  energyStar: "https://www.energystar.gov/",
} as const;

/**
 * Purchase assurance policy — single source of truth for the buy box, checkout,
 * and FAQ. Terms are set by Summit; update here and every surface follows.
 */
export const PURCHASE = {
  financingTermMonths: 60,
  financingNote: "60-month financing on approved credit",
  financingDisclosure:
    "Financing offered through third-party lending partners. 0% intro APR for 12 months, then 9.99–24.99% APR, on approved credit. Estimated payment assumes a 60-month term.",
  returns: "30-day returns on unopened equipment",
  returnsDetail:
    "Return unopened equipment within 30 days for a full refund. Opened or special-order items may carry a 15% restocking fee. Damaged-in-transit units are replaced free.",
  guarantee: "Ships-right guarantee",
  guaranteeDetail:
    "Wrong, damaged, or DOA unit? We replace it at no cost — a photo and the serial number is all we need.",
  delivery: "Order by 2:00p PT · same-day Newark will-call · 1–3 day Bay Area delivery",
} as const;

/** Rough monthly-payment estimate for the buy box ("as low as $/mo"). */
export function financingMonthly(price: number): number {
  return Math.max(1, Math.round(price / PURCHASE.financingTermMonths));
}

// Rebate programs surfaced in Resources — real programs, figures depend on each project.
export const REBATES = [
  {
    name: "Federal 25C status",
    detail: "The Energy Efficient Home Improvement Credit ended for property placed in service after December 31, 2025.",
    confirm: true,
  },
  {
    name: "TECH Clean California",
    detail: "Heat pump incentives for California installs. Amounts vary by contractor enrollment and region.",
    confirm: true,
  },
] as const;
