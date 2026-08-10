/**
 * Local-fulfillment domain logic. Pure functions + the Bay Area zone table,
 * usable on the server (checkout) and client (ZIP gate, badges) and in seeded
 * mode with no database. The DB `delivery_zones` table mirrors ZONES and is the
 * authoritative fee source when Supabase is configured.
 */

export type FulfillmentMethod = "pickup" | "local_delivery" | "freight";

export type DeliveryZone = {
  zip: string;
  label: string;
  localDeliveryEligible: boolean;
  deliveryFee: number;
  freeDeliveryOver: number;
  leadTimeHours: number;
};

export const WAREHOUSE = {
  id: "50000000-0000-0000-0000-000000000001",
  name: "Newark Fulfillment Center",
  city: "Newark, CA",
  /** Point of sale for will-call pickup, and so the tax destination for it. */
  zip: "94560",
};

/** Bay Area zones served from Newark. Mirrors supabase/seed.sql delivery_zones. */
export const ZONES: DeliveryZone[] = [
  { zip: "94560", label: "Newark", localDeliveryEligible: true, deliveryFee: 0, freeDeliveryOver: 0, leadTimeHours: 4 },
  { zip: "94538", label: "Fremont", localDeliveryEligible: true, deliveryFee: 35, freeDeliveryOver: 2000, leadTimeHours: 8 },
  { zip: "94587", label: "Union City", localDeliveryEligible: true, deliveryFee: 35, freeDeliveryOver: 2000, leadTimeHours: 8 },
  { zip: "94544", label: "Hayward", localDeliveryEligible: true, deliveryFee: 45, freeDeliveryOver: 2000, leadTimeHours: 24 },
  { zip: "94601", label: "Oakland", localDeliveryEligible: true, deliveryFee: 55, freeDeliveryOver: 2500, leadTimeHours: 24 },
  { zip: "95131", label: "San Jose", localDeliveryEligible: true, deliveryFee: 55, freeDeliveryOver: 2500, leadTimeHours: 24 },
  { zip: "94103", label: "San Francisco", localDeliveryEligible: true, deliveryFee: 75, freeDeliveryOver: 3000, leadTimeHours: 24 },
  { zip: "94303", label: "Palo Alto", localDeliveryEligible: true, deliveryFee: 65, freeDeliveryOver: 3000, leadTimeHours: 24 },
];

export function resolveZone(zip: string | null | undefined): DeliveryZone | null {
  if (!zip) return null;
  const z = zip.trim().slice(0, 5);
  return ZONES.find((zone) => zone.zip === z) ?? null;
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
export function fulfillmentOptions(zip: string | null, subtotal: number): FulfillmentOption[] {
  const zone = resolveZone(zip);
  const pickup: FulfillmentOption = {
    method: "pickup",
    label: "Will-call pickup",
    detail: `Free. Ready same day at ${WAREHOUSE.city}.`,
    fee: 0,
    available: true,
  };
  const delivery: FulfillmentOption = zone?.localDeliveryEligible
    ? {
        method: "local_delivery",
        label: "Local jobsite delivery",
        detail:
          localDeliveryFee(zone, subtotal) === 0
            ? `Free to ${zone.label}. Within ${zone.leadTimeHours}h.`
            : `$${localDeliveryFee(zone, subtotal)} to ${zone.label}. Within ${zone.leadTimeHours}h${
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
        note: zip ? "Outside our Bay Area delivery radius" : "Enter a ZIP to check",
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
export function fulfillmentPromise(zip: string | null, inStock: boolean): string {
  if (!inStock) return "Backorder";
  const zone = resolveZone(zip);
  if (!zip) return "In stock, pickup today";
  if (zone?.localDeliveryEligible) {
    return zone.leadTimeHours <= 8
      ? `In stock, delivery to ${zone.label} today`
      : `In stock, delivery to ${zone.label} tomorrow`;
  }
  return "In stock, pickup today or freight";
}

export type FulfillmentWindow = {
  /** Stable, server-verifiable identifier: the UTC start instant. */
  id: string;
  label: string;
  startAt: string;
  endAt: string;
};

const WAREHOUSE_TIME_ZONE = "America/Los_Angeles";
const SAME_DAY_CUTOFF_HOUR = 14;
const PREP_MINUTES = 60;
const SLOT_HOURS: Array<[number, number]> = [[7, 9], [9, 11], [12, 14], [14, 16]];

/**
 * Available warehouse windows, calculated in Pacific time. Past slots,
 * weekends, warehouse holidays, and same-day slots after cutoff are omitted.
 * `now` is injectable so both server validation and tests are deterministic.
 */
export function fulfillmentWindows(
  method: FulfillmentMethod,
  zip: string | null,
  now = new Date()
): FulfillmentWindow[] {
  if (method === "freight") return [];
  const zone = resolveZone(zip);
  const sameDayEligible = method === "pickup" || Boolean(zone && zone.leadTimeHours <= 8);
  const today = pacificParts(now);
  const earliest = new Date(now.getTime() + PREP_MINUTES * 60_000);
  const out: FulfillmentWindow[] = [];

  for (let offset = 0; offset < 14 && out.length < 8; offset += 1) {
    const date = addUtcDays(today.year, today.month, today.day, offset);
    if (isWeekend(date) || isWarehouseHoliday(date)) continue;
    if (offset === 0 && (!sameDayEligible || today.hour >= SAME_DAY_CUTOFF_HOUR)) continue;

    for (const [startHour, endHour] of SLOT_HOURS) {
      const start = pacificDateToUtc(date.year, date.month, date.day, startHour);
      if (start < earliest) continue;
      const end = pacificDateToUtc(date.year, date.month, date.day, endHour);
      out.push({
        id: start.toISOString(),
        label: formatWindowLabel(start, end, offset),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
      if (out.length === 8) break;
    }
  }
  return out;
}

export function isFulfillmentWindowAvailable(
  method: FulfillmentMethod,
  zip: string | null,
  windowId: string,
  now = new Date()
): boolean {
  return fulfillmentWindows(method, zip, now).some((window) => window.id === windowId);
}

type DateParts = { year: number; month: number; day: number; hour: number };

function pacificParts(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WAREHOUSE_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

function addUtcDays(year: number, month: number, day: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Convert a Pacific wall-clock time to its UTC instant, including DST. */
function pacificDateToUtc(year: number, month: number, day: number, hour: number): Date {
  const desired = Date.UTC(year, month - 1, day, hour);
  let guess = desired;
  for (let i = 0; i < 2; i += 1) {
    const actual = pacificParts(new Date(guess));
    const actualWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour);
    guess += desired - actualWallTime;
  }
  return new Date(guess);
}

function isWeekend(date: { year: number; month: number; day: number }) {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function isWarehouseHoliday(date: { year: number; month: number; day: number }) {
  const key = `${date.month}-${date.day}`;
  if (["1-1", "7-4", "12-25"].includes(key)) return true;
  // Thanksgiving: fourth Thursday in November.
  if (date.month === 11) {
    const weekday = new Date(Date.UTC(date.year, 10, date.day)).getUTCDay();
    if (weekday === 4 && date.day >= 22 && date.day <= 28) return true;
  }
  return false;
}

function formatWindowLabel(start: Date, end: Date, dayOffset: number) {
  const day = dayOffset === 0
    ? "Today"
    : new Intl.DateTimeFormat("en-US", {
        timeZone: WAREHOUSE_TIME_ZONE,
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(start);
  const time = (date: Date) => new Intl.DateTimeFormat("en-US", {
    timeZone: WAREHOUSE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day}, ${time(start)}–${time(end)} PT`;
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
