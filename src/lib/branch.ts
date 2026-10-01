/**
 * The branch as a domain entity.
 *
 * Every hours string, open/closed label, holiday, structured-data block and
 * fulfillment capability on the site is a projection of a `Branch`. Nothing
 * else may type an hour, a weekday or "open until" by hand: a hard-coded
 * "open until 5 PM" is wrong on every holiday and after every close.
 *
 * Status is computed in the branch's own timezone, never the visitor's, and a
 * missing branch resolves to `unknown` rather than to a hopeful "open".
 *
 * TODO(summit-ops): regular hours, holidays and the pickup capability below are
 * the values the site has always shown. Confirm them against the counter's
 * posted hours, then set `hoursReview.status` to "confirmed".
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Minutes after local midnight. 7:00 AM = 420. */
export type DayHours = { opens: number; closes: number };

export type BranchException = {
  /** Local calendar date in the branch timezone, YYYY-MM-DD. */
  date: string;
  kind: "holiday" | "closure" | "special_hours" | "special_pickup";
  /** Shown to customers, e.g. "Thanksgiving". */
  reason: string;
  /** Present only for special_hours / special_pickup. Absent = closed all day. */
  hours?: DayHours;
};

export type FulfillmentCapability = "will_call" | "local_delivery" | "freight";

export type Branch = {
  id: string;
  name: string;
  shortName: string;
  timezone: string;
  address: { street: string; city: string; state: string; zip: string; country: "US" };
  coordinates: { lat: number; lng: number };
  phone: string;
  phoneHref: string;
  smsHref: string;
  email: string;
  regularHours: Partial<Record<Weekday, DayHours>>;
  /** Dated one-offs: temporary closures and special pickup windows. */
  exceptions: BranchException[];
  /** Recurring closures, expanded to dated exceptions per year. */
  observedHolidays: Array<"new_year" | "memorial_day" | "independence_day" | "labor_day" | "thanksgiving" | "christmas">;
  capabilities: FulfillmentCapability[];
  hoursReview: { status: "pending_operations" | "confirmed"; reviewedAt: string | null };
};

const hm = (hour: number, minute = 0) => hour * 60 + minute;

export const NEWARK: Branch = {
  id: "newark",
  name: "Summit HVAC Supply · Newark",
  shortName: "Newark",
  timezone: "America/Los_Angeles",
  address: { street: "5437 Central Ave., Suite 10", city: "Newark", state: "CA", zip: "94560", country: "US" },
  coordinates: { lat: 37.5297, lng: -122.0402 },
  phone: "(415) 988-4445",
  phoneHref: "tel:+14159884445",
  smsHref: "sms:+14159884445",
  email: "info@summithvacsupply.com",
  regularHours: {
    1: { opens: hm(7), closes: hm(17) },
    2: { opens: hm(7), closes: hm(17) },
    3: { opens: hm(7), closes: hm(17) },
    4: { opens: hm(7), closes: hm(17) },
    5: { opens: hm(7), closes: hm(17) },
  },
  exceptions: [],
  observedHolidays: ["new_year", "independence_day", "thanksgiving", "christmas"],
  capabilities: ["will_call", "local_delivery", "freight"],
  hoursReview: { status: "pending_operations", reviewedAt: null },
};

export const BRANCHES: Branch[] = [NEWARK];

export function getBranch(id: string): Branch | null {
  return BRANCHES.find((branch) => branch.id === id) ?? null;
}

export function branchAddressLine(branch: Branch): string {
  return `${branch.address.street}, ${branch.address.city}, ${branch.address.state} ${branch.address.zip}`;
}

export function directionsHref(branch: Branch): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branchAddressLine(branch))}`;
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

export type LocalDate = { year: number; month: number; day: number };
type LocalMoment = LocalDate & { weekday: Weekday; minutes: number };

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function localMoment(now: Date, timezone: string): LocalMoment {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: Math.max(0, WEEKDAY_SHORT.indexOf(get("weekday") as (typeof WEEKDAY_SHORT)[number])) as Weekday,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function isoDate(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function addDays(date: LocalDate, offset: number): LocalDate & { weekday: Weekday } {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + offset));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
    weekday: utc.getUTCDay() as Weekday,
  };
}

/** 420 -> "7 AM", 1020 -> "5 PM", 450 -> "7:30 AM". No ":00" anywhere. */
export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const display = hour % 12 || 12;
  return `${display}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour >= 12 && hour < 24 ? "PM" : "AM"}`;
}

export function weekdayShort(weekday: number): string {
  return WEEKDAY_SHORT[((weekday % 7) + 7) % 7];
}

/* -------------------------------------------------------------------------- */
/* Holidays and exceptions                                                    */
/* -------------------------------------------------------------------------- */

function nthWeekday(year: number, month: number, weekday: Weekday, n: number): LocalDate {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return { year, month, day };
}

function lastWeekday(year: number, month: number, weekday: Weekday): LocalDate {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return { year, month, day: last.getUTCDate() - offset };
}

const HOLIDAY_RULES: Record<Branch["observedHolidays"][number], { reason: string; date: (year: number) => LocalDate }> = {
  new_year: { reason: "New Year's Day", date: (year) => ({ year, month: 1, day: 1 }) },
  memorial_day: { reason: "Memorial Day", date: (year) => lastWeekday(year, 5, 1) },
  independence_day: { reason: "Independence Day", date: (year) => ({ year, month: 7, day: 4 }) },
  labor_day: { reason: "Labor Day", date: (year) => nthWeekday(year, 9, 1, 1) },
  thanksgiving: { reason: "Thanksgiving", date: (year) => nthWeekday(year, 11, 4, 4) },
  christmas: { reason: "Christmas Day", date: (year) => ({ year, month: 12, day: 25 }) },
};

/** Every dated exception for a branch in a given year, holidays included. */
export function branchExceptions(branch: Branch, year: number): BranchException[] {
  const holidays = branch.observedHolidays.map((key) => ({
    date: isoDate(HOLIDAY_RULES[key].date(year)),
    kind: "holiday" as const,
    reason: HOLIDAY_RULES[key].reason,
  }));
  const explicit = branch.exceptions.filter((exception) => exception.date.startsWith(`${year}-`));
  // An explicit entry for the same date wins over the holiday rule.
  const explicitDates = new Set(explicit.map((exception) => exception.date));
  return [...explicit, ...holidays.filter((holiday) => !explicitDates.has(holiday.date))].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export function exceptionOn(branch: Branch, date: LocalDate): BranchException | null {
  const key = isoDate(date);
  return branchExceptions(branch, date.year).find((exception) => exception.date === key) ?? null;
}

/** The hours that actually apply on a date: an exception overrides the week. */
export function effectiveHours(branch: Branch, date: LocalDate & { weekday: Weekday }): {
  hours: DayHours | null;
  exception: BranchException | null;
} {
  const exception = exceptionOn(branch, date);
  if (exception) return { hours: exception.hours ?? null, exception };
  return { hours: branch.regularHours[date.weekday] ?? null, exception: null };
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export const CLOSING_SOON_MINUTES = 60;

export type BranchStatus =
  | { kind: "open"; closes: number; label: string; exception: BranchException | null }
  | { kind: "closingSoon"; closes: number; label: string; exception: BranchException | null }
  | { kind: "closed"; label: string; nextOpen: { date: string; weekday: Weekday; opens: number } | null }
  | { kind: "exception"; label: string; exception: BranchException; nextOpen: { date: string; weekday: Weekday; opens: number } | null }
  | { kind: "unknown"; label: string };

function nextOpening(branch: Branch, from: LocalMoment, includeToday: boolean) {
  for (let offset = includeToday ? 0 : 1; offset <= 14; offset += 1) {
    const date = addDays(from, offset);
    const { hours } = effectiveHours(branch, date);
    if (!hours) continue;
    if (offset === 0 && from.minutes >= hours.opens) continue;
    return { date: isoDate(date), weekday: date.weekday, opens: hours.opens, offset };
  }
  return null;
}

function openingPhrase(next: ReturnType<typeof nextOpening>): string {
  if (!next) return "Closed";
  if (next.offset === 0) return `Closed · opens ${formatMinutes(next.opens)}`;
  if (next.offset === 1) return `Closed · opens tomorrow ${formatMinutes(next.opens)}`;
  return `Closed · opens ${weekdayShort(next.weekday)} ${formatMinutes(next.opens)}`;
}

/**
 * Live status at `now`. Null branch data is `unknown`: the honest answer when
 * the schedule cannot be read is "call to confirm", never "open".
 */
export function branchStatus(branch: Branch | null, now: Date = new Date()): BranchStatus {
  if (!branch || branch.hoursReview.status !== "confirmed") {
    return { kind: "unknown", label: "Call to confirm today’s hours" };
  }
  const moment = localMoment(now, branch.timezone);
  const { hours, exception } = effectiveHours(branch, moment);

  if (hours && moment.minutes >= hours.opens && moment.minutes < hours.closes) {
    const remaining = hours.closes - moment.minutes;
    const special = exception ? ` (${exception.reason})` : "";
    if (remaining <= CLOSING_SOON_MINUTES) {
      return { kind: "closingSoon", closes: hours.closes, label: `Closing soon · until ${formatMinutes(hours.closes)}${special}`, exception };
    }
    return { kind: "open", closes: hours.closes, label: `Open until ${formatMinutes(hours.closes)}${special}`, exception };
  }

  const next = nextOpening(branch, moment, Boolean(hours));
  const nextOpen = next ? { date: next.date, weekday: next.weekday, opens: next.opens } : null;
  if (exception && !exception.hours) {
    return { kind: "exception", label: `Closed today · ${exception.reason}`, exception, nextOpen };
  }
  return { kind: "closed", label: openingPhrase(next), nextOpen };
}

export function isOpenStatus(status: BranchStatus): boolean {
  return status.kind === "open" || status.kind === "closingSoon";
}

/* -------------------------------------------------------------------------- */
/* Projections                                                                */
/* -------------------------------------------------------------------------- */

/** Consecutive days with identical hours collapse: "Mon–Fri 7 AM–5 PM". */
export function weeklyHoursRows(branch: Branch): Array<{ days: string; daysLong: string; hours: string | null }> {
  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  const rows: Array<{ start: Weekday; end: Weekday; hours: DayHours | null }> = [];
  for (const day of order) {
    const hours = branch.regularHours[day] ?? null;
    const last = rows[rows.length - 1];
    const same = last && JSON.stringify(last.hours) === JSON.stringify(hours);
    if (same) last.end = day;
    else rows.push({ start: day, end: day, hours });
  }
  return rows.map((row) => ({
    days: row.start === row.end ? WEEKDAY_SHORT[row.start] : `${WEEKDAY_SHORT[row.start]}–${WEEKDAY_SHORT[row.end]}`,
    daysLong: row.start === row.end ? WEEKDAY_LONG[row.start] : `${WEEKDAY_LONG[row.start]}–${WEEKDAY_LONG[row.end]}`,
    hours: row.hours ? `${formatMinutes(row.hours.opens)}–${formatMinutes(row.hours.closes)}` : null,
  }));
}

/** "Mon–Fri 7 AM–5 PM PT" -- the one-line summary for footers and metadata. */
export function hoursSummary(branch: Branch): string {
  if (branch.hoursReview.status !== "confirmed") return "Call to confirm today’s hours";
  const open = weeklyHoursRows(branch).filter((row) => row.hours);
  return `${open.map((row) => `${row.days} ${row.hours}`).join(", ")} PT`;
}

/** Upcoming exceptions within `days`, for the location page and structured data. */
export function upcomingExceptions(branch: Branch, now: Date = new Date(), days = 60): BranchException[] {
  const today = localMoment(now, branch.timezone);
  const start = isoDate(today);
  const end = isoDate(addDays(today, days));
  return [...branchExceptions(branch, today.year), ...branchExceptions(branch, today.year + 1)].filter(
    (exception) => exception.date >= start && exception.date <= end
  );
}

const SCHEMA_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * schema.org hours generated from the same model the page renders, so the
 * visible table and the structured data cannot disagree. Exceptions become
 * specialOpeningHoursSpecification: a closed day is opens = closes = 00:00.
 */
export function branchOpeningHoursSchema(branch: Branch, now: Date = new Date()) {
  if (branch.hoursReview.status !== "confirmed") return {};
  const groups = new Map<string, string[]>();
  for (const [day, hours] of Object.entries(branch.regularHours)) {
    if (!hours) continue;
    const key = `${clock(hours.opens)}-${clock(hours.closes)}`;
    groups.set(key, [...(groups.get(key) ?? []), SCHEMA_DAY[Number(day)]]);
  }
  return {
    openingHoursSpecification: Array.from(groups.entries()).map(([key, dayOfWeek]) => {
      const [opens, closes] = key.split("-");
      return { "@type": "OpeningHoursSpecification", dayOfWeek, opens, closes };
    }),
    specialOpeningHoursSpecification: upcomingExceptions(branch, now).map((exception) => ({
      "@type": "OpeningHoursSpecification",
      validFrom: exception.date,
      validThrough: exception.date,
      opens: exception.hours ? clock(exception.hours.opens) : "00:00",
      closes: exception.hours ? clock(exception.hours.closes) : "00:00",
      description: exception.reason,
    })),
  };
}
