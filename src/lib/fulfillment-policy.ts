/**
 * The fulfillment policy: one versioned record of the rules every delivery
 * surface depends on. `lib/backend/fulfillment.ts` is the calculator and reads
 * only from here; the homepage, /delivery, /shipping, the location page and the
 * local landing pages render projections of that calculator. No surface keeps
 * its own copy of a cutoff, a zone list, a fee or a prep time.
 *
 * Review status is tracked per rule group. A rule still pending operations
 * sign-off may drive the calculator (checkout has to do something), but its
 * customer-facing projection must say so -- see `policyClaim()` -- and prose
 * that no calculator enforces is not published at all.
 *
 * TODO(summit-ops): every rule group below is `pending_operations`. Confirm
 * each value with the counter, then set its status to "confirmed" with a date.
 */

export type ReviewState = { status: "pending_operations" | "confirmed"; reviewedAt: string | null };

export type DeliveryZone = {
  zip: string;
  label: string;
  localDeliveryEligible: boolean;
  deliveryFee: number;
  freeDeliveryOver: number;
  /** <= SAME_DAY_LEAD_HOURS = same-day route; otherwise next route day. */
  leadTimeHours: number;
};

export type FulfillmentPolicy = {
  id: string;
  version: string;
  effectiveDate: string;
  branchId: string;
  owner: string;
  /** Orders confirmed before this local time make the earliest route/pickup. */
  cutoff: { minutes: number; review: ReviewState };
  /** Pick-and-stage time before a will-call order is ready. */
  pickupPrep: { minutes: number; review: ReviewState };
  /** Bookable windows, as [start, end] local hours. */
  windows: { slots: Array<[number, number]>; horizonDays: number; maxOffered: number };
  zones: { list: DeliveryZone[]; sameDayLeadHours: number; review: ReviewState };
  /** Whether zone fees may be quoted outside checkout. */
  fees: { review: ReviewState };
  /** What an unlisted or unknown ZIP is offered. */
  fallback: { outsideZone: "pickup_or_freight"; unknown: "contact" };
};

const PENDING: ReviewState = { status: "pending_operations", reviewedAt: null };

export const FULFILLMENT_POLICY: FulfillmentPolicy = {
  id: "newark-fulfillment",
  version: "2026.09.0-draft",
  effectiveDate: "2026-09-30",
  branchId: "newark",
  owner: "Newark counter operations",
  cutoff: { minutes: 14 * 60, review: PENDING },
  // Was stated two ways: "ready in 30 min" on the homepage while checkout
  // refused any window less than 60 minutes out. The calculator's value wins,
  // because it is the one a customer can actually book.
  pickupPrep: { minutes: 60, review: PENDING },
  windows: { slots: [[7, 9], [9, 11], [12, 14], [14, 16]], horizonDays: 14, maxOffered: 8 },
  zones: {
    sameDayLeadHours: 8,
    review: PENDING,
    list: [
      { zip: "94560", label: "Newark", localDeliveryEligible: true, deliveryFee: 0, freeDeliveryOver: 0, leadTimeHours: 4 },
      { zip: "94538", label: "Fremont", localDeliveryEligible: true, deliveryFee: 35, freeDeliveryOver: 2000, leadTimeHours: 8 },
      { zip: "94587", label: "Union City", localDeliveryEligible: true, deliveryFee: 35, freeDeliveryOver: 2000, leadTimeHours: 8 },
      { zip: "94544", label: "Hayward", localDeliveryEligible: true, deliveryFee: 45, freeDeliveryOver: 2000, leadTimeHours: 24 },
      { zip: "94601", label: "Oakland", localDeliveryEligible: true, deliveryFee: 55, freeDeliveryOver: 2500, leadTimeHours: 24 },
      { zip: "95131", label: "San Jose", localDeliveryEligible: true, deliveryFee: 55, freeDeliveryOver: 2500, leadTimeHours: 24 },
      { zip: "94103", label: "San Francisco", localDeliveryEligible: true, deliveryFee: 75, freeDeliveryOver: 3000, leadTimeHours: 24 },
      { zip: "94303", label: "Palo Alto", localDeliveryEligible: true, deliveryFee: 65, freeDeliveryOver: 3000, leadTimeHours: 24 },
    ],
  },
  fees: { review: PENDING },
  fallback: { outsideZone: "pickup_or_freight", unknown: "contact" },
};

export function isConfirmed(review: ReviewState): boolean {
  return review.status === "confirmed";
}

/** Public timing/coverage may be promised only after operations has approved
 * both the route table and the cutoff that determines the displayed date. */
export function deliveryPolicyIsConfirmed(policy: FulfillmentPolicy = FULFILLMENT_POLICY): boolean {
  return isConfirmed(policy.cutoff.review) && isConfirmed(policy.zones.review);
}

/** A bookable pickup window also depends on the branch schedule, checked by
 * the caller, but its policy-owned preparation time must be approved here. */
export function pickupPolicyIsConfirmed(policy: FulfillmentPolicy = FULFILLMENT_POLICY): boolean {
  return isConfirmed(policy.cutoff.review) && isConfirmed(policy.pickupPrep.review);
}

/** The rule groups still waiting on operations, for the dev-only review banner. */
export function pendingPolicyRules(policy: FulfillmentPolicy = FULFILLMENT_POLICY): string[] {
  const groups: Array<[string, ReviewState]> = [
    ["Order cutoff", policy.cutoff.review],
    ["Will-call prep time", policy.pickupPrep.review],
    ["Delivery zones", policy.zones.review],
    ["Delivery fees", policy.fees.review],
  ];
  return groups.filter(([, review]) => !isConfirmed(review)).map(([label]) => label);
}
