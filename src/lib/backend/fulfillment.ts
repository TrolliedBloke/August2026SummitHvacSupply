/**
 * The fulfillment calculator. Pure functions over the versioned policy in
 * `lib/fulfillment-policy.ts` and the branch calendar in `lib/branch.ts`, usable
 * on the server (checkout validation) and the client (ZIP gate, checkout
 * summary), and with no database. The DB `delivery_zones` table mirrors the
 * policy zones and is the authoritative fee source when Supabase is configured.
 *
 * Checkout enforces these results, so every marketing surface renders a
 * projection of them (`resolveFulfillmentAnswer`, `deliveryPromise`) instead of
 * typing its own cutoff, date or zone list.
 */

import {
  addDays,
  effectiveHours,
  formatMinutes,
  getBranch,
  isoDate,
  localMoment,
  weekdayShort,
  type Branch,
  type LocalDate,
  type Weekday,
} from "@/lib/branch";
import {
  FULFILLMENT_POLICY,
  deliveryPolicyIsConfirmed,
  isConfirmed,
  pickupPolicyIsConfirmed,
  type DeliveryZone,
  type FulfillmentPolicy,
} from "@/lib/fulfillment-policy";

export type FulfillmentMethod = "pickup" | "local_delivery" | "freight";
export type { DeliveryZone };

export const WAREHOUSE = {
  id: "50000000-0000-0000-0000-000000000001",
  name: "Newark Fulfillment Center",
  city: "Newark, CA",
  /** Point of sale for will-call pickup, and so the tax destination for it. */
  zip: "94560",
};

/** Bay Area zones served from Newark. Mirrors supabase/seed.sql delivery_zones. */
export const ZONES: DeliveryZone[] = FULFILLMENT_POLICY.zones.list;

function policyBranch(policy: FulfillmentPolicy): Branch {
  const branch = getBranch(policy.branchId);
  if (!branch) throw new Error(`Fulfillment policy ${policy.id} references unknown branch ${policy.branchId}`);
  return branch;
}

export function resolveZone(zip: string | null | undefined, policy: FulfillmentPolicy = FULFILLMENT_POLICY): DeliveryZone | null {
  if (!zip) return null;
  const z = zip.trim().slice(0, 5);
  return policy.zones.list.find((zone) => zone.zip === z) ?? null;
}

function isSameDayZone(zone: DeliveryZone | null, policy: FulfillmentPolicy): boolean {
  return Boolean(zone && zone.leadTimeHours <= policy.zones.sameDayLeadHours);
}

export type FulfillmentOption = {
  method: FulfillmentMethod;
  label: string;
  detail: string;
  fee: number;
  available: boolean;
  /** Why an option is unavailable, for the UI. */
  note?: string;
};

/** The fee for local delivery, honoring the zone's free-over threshold. */
export function localDeliveryFee(zone: DeliveryZone, subtotal: number): number {
  if (!zone.localDeliveryEligible) return 0;
  if (zone.freeDeliveryOver > 0 && subtotal >= zone.freeDeliveryOver) return 0;
  return zone.deliveryFee;
}

/**
 * The fulfillment options to show for a given ZIP + cart subtotal. Pickup is
 * always available (drive to Newark); local delivery only inside a served zone;
 * freight is the fallback for everyone (cost quoted separately).
 */
export function fulfillmentOptions(zip: string | null, subtotal: number, now = new Date()): FulfillmentOption[] {
  const branchConfirmed = getBranch(FULFILLMENT_POLICY.branchId)?.hoursReview.status === "confirmed";
  const pickupConfirmed = pickupPolicyIsConfirmed() && branchConfirmed;
  const deliveryConfirmed = deliveryPolicyIsConfirmed() && branchConfirmed;
  const zone = resolveZone(zip);
  const pickupDay = pickupConfirmed ? earliestDay("pickup", zone, now) : null;
  const pickup: FulfillmentOption = {
    method: "pickup",
    label: "Will-call pickup",
    detail: pickupConfirmed
      ? `Free. ${pickupDay ? `Ready ${dayPhrase(pickupDay, now)}` : "Ready when confirmed"} at ${WAREHOUSE.city}.`
      : `Free at ${WAREHOUSE.city}. Pickup timing is confirmed with the order.`,
    fee: 0,
    available: pickupConfirmed,
    ...(!pickupConfirmed ? { note: "Pickup hours and preparation time are being confirmed by the counter" } : {}),
  };
  const deliveryDay = deliveryConfirmed && zone?.localDeliveryEligible ? earliestDay("local_delivery", zone, now) : null;
  const delivery: FulfillmentOption = deliveryConfirmed && zone?.localDeliveryEligible
    ? {
        method: "local_delivery",
        label: "Local jobsite delivery",
        detail:
          localDeliveryFee(zone, subtotal) === 0
            ? `Free to ${zone.label}. Earliest ${deliveryDay ? dayPhrase(deliveryDay, now) : "on confirmation"}.`
            : `$${localDeliveryFee(zone, subtotal)} to ${zone.label}. Earliest ${deliveryDay ? dayPhrase(deliveryDay, now) : "on confirmation"}${
                zone.freeDeliveryOver > 0 ? `, free over $${zone.freeDeliveryOver.toLocaleString()}` : ""
              }.`,
        fee: localDeliveryFee(zone, subtotal),
        available: true,
      }
    : {
        method: "local_delivery",
        label: "Local jobsite delivery",
        detail: "Not available for this ZIP.",
        fee: 0,
        available: false,
        note: !deliveryConfirmed ? "Delivery routes are being confirmed by the counter" : zip ? "Outside our Bay Area delivery radius" : "Enter a ZIP to check",
      };
  const freight: FulfillmentOption = {
    method: "freight",
    label: "Freight (LTL)",
    detail: "Curbside freight anywhere. Cost quoted after order.",
    fee: 0,
    available: true,
    note: "Freight cost billed at actual carrier rate",
  };
  return [pickup, delivery, freight];
}

/** A short stock/fulfillment promise for a product, given the visitor's ZIP. */
export function fulfillmentPromise(zip: string | null, inStock: boolean, now = new Date()): string {
  if (!inStock) return "Backorder";
  const zone = resolveZone(zip);
  if (!zip || !zone?.localDeliveryEligible) {
    const day = earliestDay("pickup", zone, now);
    return day ? `In stock, pickup ${dayPhrase(day, now)}` : "In stock, pickup on confirmation";
  }
  const day = earliestDay("local_delivery", zone, now);
  return day ? `In stock, delivery to ${zone.label} ${dayPhrase(day, now)}` : `In stock, delivery to ${zone.label} on confirmation`;
}

export type FulfillmentWindow = {
  /** Stable, server-verifiable identifier: the UTC start instant. */
  id: string;
  label: string;
  startAt: string;
  endAt: string;
};

type Day = LocalDate & { weekday: Weekday };

/** A day the branch trades on, honoring holidays and dated exceptions. */
function openHours(branch: Branch, date: Day) {
  return effectiveHours(branch, date).hours;
}

function nextOpenDay(branch: Branch, from: Day): Day | null {
  for (let offset = 1; offset <= 21; offset += 1) {
    const day = addDays(from, offset);
    if (openHours(branch, day)) return day;
  }
  return null;
}

/**
 * The order day: today when the branch trades today and the cutoff has not
 * passed, otherwise the next trading day. Every promise starts here.
 */
function orderDay(policy: FulfillmentPolicy, now: Date, branch: Branch = policyBranch(policy)): { day: Day; today: boolean } | null {
  const moment = localMoment(now, branch.timezone);
  const today: Day = { year: moment.year, month: moment.month, day: moment.day, weekday: moment.weekday };
  if (openHours(branch, today) && moment.minutes < policy.cutoff.minutes) return { day: today, today: true };
  const next = nextOpenDay(branch, today);
  return next ? { day: next, today: false } : null;
}

/** First day a method can be fulfilled: same day for pickup and same-day zones, next route day otherwise. */
function earliestDay(
  method: FulfillmentMethod,
  zone: DeliveryZone | null,
  now: Date,
  policy = FULFILLMENT_POLICY,
  branch: Branch = policyBranch(policy)
): Day | null {
  if (method === "freight") return null;
  const order = orderDay(policy, now, branch);
  if (!order) return null;
  if (method === "pickup" || isSameDayZone(zone, policy)) return order.day;
  return nextOpenDay(branch, order.day);
}

/**
 * Available windows, calculated in the branch timezone. Past slots, closed
 * days, holidays and dated exceptions, and days before the method's earliest
 * day are omitted. `now` is injectable so server validation and tests are
 * deterministic.
 */
export function fulfillmentWindows(
  method: FulfillmentMethod,
  zip: string | null,
  now = new Date(),
  policy: FulfillmentPolicy = FULFILLMENT_POLICY
): FulfillmentWindow[] {
  if (method === "freight") return [];
  const branch = policyBranch(policy);
  const zone = resolveZone(zip, policy);
  if (method === "local_delivery" && !zone?.localDeliveryEligible) return [];
  const first = earliestDay(method, zone, now, policy);
  if (!first) return [];
  const moment = localMoment(now, branch.timezone);
  const todayKey = isoDate(moment);
  const earliestInstant = new Date(now.getTime() + policy.pickupPrep.minutes * 60_000);
  const out: FulfillmentWindow[] = [];

  for (let offset = 0; offset < policy.windows.horizonDays && out.length < policy.windows.maxOffered; offset += 1) {
    const date = addDays(first, offset);
    const hours = openHours(branch, date);
    if (!hours) continue;
    for (const [startHour, endHour] of policy.windows.slots) {
      // A shortened exception day only offers slots inside its hours.
      if (startHour * 60 < hours.opens || endHour * 60 > hours.closes) continue;
      const start = zonedDateToUtc(date, startHour, branch.timezone);
      if (start < earliestInstant) continue;
      const end = zonedDateToUtc(date, endHour, branch.timezone);
      out.push({
        id: start.toISOString(),
        label: formatWindowLabel(start, end, isoDate(date) === todayKey, branch.timezone),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
      if (out.length === policy.windows.maxOffered) break;
    }
  }
  return out;
}

export function isFulfillmentWindowAvailable(
  method: FulfillmentMethod,
  zip: string | null,
  windowId: string,
  now = new Date(),
  policy: FulfillmentPolicy = FULFILLMENT_POLICY,
  branch: Branch = policyBranch(policy)
): boolean {
  if (branch.hoursReview.status !== "confirmed") return false;
  if (method === "pickup" && !pickupPolicyIsConfirmed(policy)) return false;
  if (method === "local_delivery" && !deliveryPolicyIsConfirmed(policy)) return false;
  return fulfillmentWindows(method, zip, now, policy).some((window) => window.id === windowId);
}

/** Convert a wall-clock hour in `timezone` to its UTC instant, including DST. */
function zonedDateToUtc(date: LocalDate, hour: number, timezone: string): Date {
  const desired = Date.UTC(date.year, date.month - 1, date.day, hour);
  let guess = desired;
  for (let i = 0; i < 2; i += 1) {
    const actual = localMoment(new Date(guess), timezone);
    const actualWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, Math.floor(actual.minutes / 60), actual.minutes % 60);
    guess += desired - actualWallTime;
  }
  return new Date(guess);
}

function formatWindowLabel(start: Date, end: Date, today: boolean, timezone: string) {
  const day = today
    ? "Today"
    : new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(start);
  const time = (date: Date) => new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(date);
  return `${day}, ${time(start)}–${time(end)} PT`;
}

/* -------------------------------------------------------------------------- */
/* Projections                                                                */
/* -------------------------------------------------------------------------- */

function dayOffset(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "today", "tomorrow", "Mon", or "Mon, Oct 5" when more than a week out. */
export function dayPhrase(day: Day, now: Date, policy = FULFILLMENT_POLICY, branch: Branch = policyBranch(policy)): string {
  const moment = localMoment(now, branch.timezone);
  const offset = dayOffset(moment, day);
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";
  if (offset < 7) return weekdayShort(day.weekday);
  return `${weekdayShort(day.weekday)}, ${MONTHS[day.month - 1]} ${day.day}`;
}

/**
 * The standard next-route-day promise: order by the cutoff on the order day,
 * arrives the next trading day. This is exactly what checkout offers a
 * non-same-day zone, so the homepage line and the checkout windows agree.
 */
export function deliveryPromise(
  now = new Date(),
  policy: FulfillmentPolicy = FULFILLMENT_POLICY,
  branch: Branch = policyBranch(policy)
) {
  if (!deliveryPolicyIsConfirmed(policy) || branch.hoursReview.status !== "confirmed") return null;
  const order = orderDay(policy, now, branch);
  if (!order) return null;
  const arrives = nextOpenDay(branch, order.day);
  if (!arrives) return null;
  const orderLabel = order.today ? "today" : weekdayShort(order.day.weekday);
  return {
    cutoff: formatMinutes(policy.cutoff.minutes),
    orderDay: isoDate(order.day),
    arrivesDay: isoDate(arrives),
    /** "Order by 2 PM Thu, arrives Fri" -- weekday names, never "today", so it reads the same all day. */
    line: `Order by ${formatMinutes(policy.cutoff.minutes)} ${weekdayShort(order.day.weekday)}, arrives ${weekdayShort(arrives.weekday)}`,
    orderLabel,
    confirmed: isConfirmed(policy.cutoff.review),
  };
}

/** "Will-call ready in 1 hour" -- from the same prep time checkout enforces. */
export function pickupReadyLine(policy: FulfillmentPolicy = FULFILLMENT_POLICY): string {
  if (!pickupPolicyIsConfirmed(policy)) return "Will-call timing confirmed with your order";
  const minutes = policy.pickupPrep.minutes;
  if (minutes < 60) return `Will-call ready in ${minutes} min`;
  const hours = minutes / 60;
  return `Will-call ready in ${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`;
}

export type MethodAnswer = {
  method: FulfillmentMethod;
  label: string;
  available: boolean;
  /** "today", "tomorrow", "Fri" -- null for freight (quoted) or unavailable methods. */
  earliest: string | null;
  detail: string;
};

export type FulfillmentAnswer =
  | { kind: "malformed"; zip: string }
  | { kind: "unavailable" }
  | { kind: "unknown"; zip: string }
  | {
      kind: "eligible" | "ineligible";
      zip: string;
      area: string | null;
      methods: MethodAnswer[];
      orderBy: { cutoff: string; dayLabel: string } | null;
      fee: { status: "free" | "amount" | "quoted"; amount?: number; freeOver?: number };
      policyVersion: string;
      confirmed: boolean;
    };

const ZIP_PATTERN = /^\d{5}$/;
const SERVICE_STATE_ZIP = { min: 90001, max: 96162 };

/**
 * The answer-first projection for a ZIP. `policy` null models the policy store
 * being unavailable: the result is an explicit "cannot confirm", never a
 * guessed date.
 */
export function resolveFulfillmentAnswer(
  rawZip: string,
  now = new Date(),
  policy: FulfillmentPolicy | null = FULFILLMENT_POLICY,
  branch: Branch | null = policy ? getBranch(policy.branchId) : null
): FulfillmentAnswer {
  const zip = rawZip.trim();
  if (!policy) return { kind: "unavailable" };
  if (!ZIP_PATTERN.test(zip)) return { kind: "malformed", zip };
  if (!deliveryPolicyIsConfirmed(policy) || !branch || branch.hoursReview.status !== "confirmed") return { kind: "unavailable" };
  const numeric = Number(zip);
  if (numeric < SERVICE_STATE_ZIP.min || numeric > SERVICE_STATE_ZIP.max) return { kind: "unknown", zip };

  const zone = resolveZone(zip, policy);
  const eligible = Boolean(zone?.localDeliveryEligible);
  const pickupDay = earliestDay("pickup", zone, now, policy, branch);
  const deliveryDay = eligible ? earliestDay("local_delivery", zone, now, policy, branch) : null;
  const order = orderDay(policy, now, branch);
  const feesPublic = isConfirmed(policy.fees.review);

  const methods: MethodAnswer[] = [
    {
      method: "local_delivery",
      label: "Local delivery",
      available: eligible,
      earliest: deliveryDay ? dayPhrase(deliveryDay, now, policy, branch) : null,
      detail: eligible ? `Route delivery to ${zone!.label}` : "Not on a Newark route for this ZIP",
    },
    {
      method: "pickup",
      label: "Will-call pickup",
      available: true,
      earliest: pickupDay ? dayPhrase(pickupDay, now, policy, branch) : null,
      detail: `Newark counter, ${pickupReadyLine(policy).replace("Will-call ready", "ready").toLowerCase()} after confirmation`,
    },
    {
      method: "freight",
      label: "Freight",
      available: true,
      earliest: null,
      detail: "Carrier rate and date quoted before you pay",
    },
  ];

  return {
    kind: eligible ? "eligible" : "ineligible",
    zip,
    area: zone?.label ?? null,
    methods,
    orderBy: order ? { cutoff: formatMinutes(policy.cutoff.minutes), dayLabel: order.today ? "today" : weekdayShort(order.day.weekday) } : null,
    fee: !eligible
      ? { status: "quoted" }
      : !feesPublic
        ? { status: "quoted" }
        : zone!.deliveryFee === 0
          ? { status: "free" }
          : { status: "amount", amount: zone!.deliveryFee, freeOver: zone!.freeDeliveryOver || undefined },
    policyVersion: policy.version,
    confirmed: isConfirmed(policy.cutoff.review) && isConfirmed(policy.zones.review),
  };
}

export const FULFILLMENT_LABEL: Record<FulfillmentMethod, string> = {
  pickup: "Pickup",
  local_delivery: "Local delivery",
  freight: "Freight",
};

export const FULFILLMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  picked_up: "Picked up",
  cancelled: "Cancelled",
};
