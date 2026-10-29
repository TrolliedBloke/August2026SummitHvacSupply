import { branchAddressLine, directionsHref, hoursSummary, NEWARK } from "./branch";
import { FULFILLMENT_POLICY } from "./fulfillment-policy";
import { pickupReadyLine } from "./backend/fulfillment";
import { formatHour } from "./branch-hours";

// Real business facts -- single source of truth. No placeholder social links anywhere.
// Address, contacts and hours are projections of the Branch entity in branch.ts.
export const SITE = {
  name: "Summit HVAC Supply",
  legalName: "Summit HVAC Supply",
  origin: "https://www.summithvacsupply.com",
  tagline: "Bay Area HVAC equipment and quote support, supplied locally",
  brandLine: "Bay Area HVAC equipment supply from Newark, CA",
  address: {
    street: NEWARK.address.street,
    city: NEWARK.address.city,
    state: NEWARK.address.state,
    zip: NEWARK.address.zip,
    full: branchAddressLine(NEWARK),
  },
  phone: NEWARK.phone,
  phoneHref: NEWARK.phoneHref,
  smsHref: NEWARK.smsHref,
  email: NEWARK.email,
  emailHref: `mailto:${NEWARK.email}`,
  /** Regular weekly hours only. Live status (holidays, closures) comes from branchStatus(). */
  counterHours: hoursSummary(NEWARK),
  hours: `${hoursSummary(NEWARK)} · Newark will-call, Bay Area delivery & freight`,
  serviceArea: "San Jose, Oakland, Fremont, San Francisco, the Peninsula, East Bay, South Bay, North Bay & nearby Bay Area cities",
  broaderServiceArea: "California, Oregon, Washington, Nevada & Arizona",
  ahriDirectory: "https://www.ahridirectory.org/",
  energyStar: "https://www.energystar.gov/",
} as const;

/**
 * Purchase assurance policy -- single source of truth for the buy box, checkout,
 * and FAQ. Terms are set by Summit; update here and every surface follows.
 */
export const PURCHASE = {
  financingTermMonths: 60,
  financingNote: "60-month financing on approved credit",
  financingDisclosure:
    "Financing offered through third-party lending partners. 0% intro APR for 12 months, then 9.99–24.99% APR, on approved credit. Estimated payment assumes a 60-month term.",
  returns: "30-day returns on unopened equipment",
  restockingFeePercent: 15,
  /** Days an RMA stays valid. Returns arriving later go back to the counter. */
  rmaValidDays: 15,
  /** Carrier deadline for concealed freight damage. Ours matches theirs. */
  concealedDamageDays: 5,
  returnsDetail:
    "Return unopened equipment within 30 days for a full refund. Opened but uninstalled equipment is refunded less a 15% restocking fee. Special-order items and installed equipment are not returnable. Damaged-in-transit units are replaced free.",
  guarantee: "Ships-right guarantee",
  guaranteeDetail:
    "Wrong, damaged, or DOA unit? We replace it at no cost. A photo and the serial number is all we need.",
  delivery: "Newark will-call, Bay Area delivery, and freight are confirmed with each quote",
} as const;

/** "14" -> "2 PM". Shared so the string and the countdown cannot disagree. */
export function formatCutoffHour(hour: number): string {
  return formatHour(hour);
}

const CUTOFF_HOUR = FULFILLMENT_POLICY.cutoff.minutes / 60;

/**
 * Fulfillment facts shown on the landing page and /delivery, read from the
 * versioned policy (lib/fulfillment-policy.ts) that the checkout calculator
 * also enforces. Nothing here is typed by hand: the cutoff and the ready time
 * a customer reads are the ones checkout will hold them to.
 */
export const FULFILLMENT = {
  pickupReady: pickupReadyLine(),
  /** The cutoff as an hour in branch time. The SOURCE is the policy. */
  deliveryCutoffHour: CUTOFF_HOUR,
  /** Derived from deliveryCutoffHour. Do not hand-edit. */
  deliveryCutoff: formatCutoffHour(CUTOFF_HOUR),
  deliveryLine: "for next-day delivery",
  /** Shown under both fulfillment rows on product cards. */
  bothMethods: "Pickup or delivery",
  mapsHref: directionsHref(NEWARK),
} as const;

/** Rough monthly-payment estimate for the buy box ("as low as $/mo"). */
export function financingMonthly(price: number): number {
  return Math.max(1, Math.round(price / PURCHASE.financingTermMonths));
}

// Rebate programs surfaced in Resources -- real programs, figures depend on each project.
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
