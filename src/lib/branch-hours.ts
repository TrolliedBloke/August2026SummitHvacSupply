/**
 * The Newark counter's schedule, and every label derived from it.
 *
 * This is the single source for "Open until 5 PM", "Closed · opens 7 AM" and
 * "Order by 2 PM Wed, arrives Thu". No weekday and no closing hour may be
 * written into a component: a hardcoded "Wed" is wrong four days out of five,
 * and a hardcoded closing time drifts from the branch page the moment one of
 * the two is edited.
 *
 * Hours are Pacific, because the branch is. Callers render time-dependent
 * labels after mount (see the mounted guard in site-nav) so a server render at
 * 4:59 PM and a client render at 5:01 PM cannot disagree in the same paint.
 */
export const BRANCH_TIME_ZONE = "America/Los_Angeles";

/**
 * Open hours per weekday, 0 = Sunday, as [openHour, closeHour] in 24h Pacific.
 * A missing day is closed. Matches SITE.hours ("Mon-Fri 7:00a-5:00p PT").
 *
 * TODO(summit-ops): confirm against the counter's real posted hours, including
 * any Saturday will-call.
 */
export const BRANCH_HOURS: Record<number, readonly [number, number] | undefined> = {
  1: [7, 17],
  2: [7, 17],
  3: [7, 17],
  4: [7, 17],
  5: [7, 17],
};

/** 17 -> "5 PM", 7 -> "7 AM", 14 -> "2 PM". No ":00" anywhere. */
export function formatHour(hour: number): string {
  const display = hour % 12 || 12;
  return `${display} ${hour >= 12 ? "PM" : "AM"}`;
}

type PacificParts = { weekday: number; hour: number; minute: number };

function pacificParts(now: Date): PacificParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRANCH_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    weekday: Math.max(0, weekdayNames.indexOf(value("weekday"))),
    hour: Number(value("hour") || 0),
    minute: Number(value("minute") || 0),
  };
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[((weekday % 7) + 7) % 7];
}

export function isOpenDay(weekday: number): boolean {
  return Boolean(BRANCH_HOURS[((weekday % 7) + 7) % 7]);
}

/** The next weekday the counter is open, strictly after `weekday`. */
export function nextOpenDay(weekday: number): number {
  for (let step = 1; step <= 7; step += 1) {
    const day = (weekday + step) % 7;
    if (isOpenDay(day)) return day;
  }
  return weekday;
}

/** "Open until 5 PM" while open; otherwise the next opening. */
export function branchStatus(now: Date = new Date()): { open: boolean; label: string } {
  const { weekday, hour } = pacificParts(now);
  const today = BRANCH_HOURS[weekday];
  if (today && hour >= today[0] && hour < today[1]) {
    return { open: true, label: `Open until ${formatHour(today[1])}` };
  }
  // Before opening on a day the branch trades, the next opening is today.
  const opensToday = today && hour < today[0];
  const nextDay = opensToday ? weekday : nextOpenDay(weekday);
  const nextOpenHour = (BRANCH_HOURS[nextDay] ?? [7, 17])[0];
  return {
    open: false,
    label: opensToday
      ? `Closed · opens ${formatHour(nextOpenHour)}`
      : `Closed · opens ${weekdayLabel(nextDay)} ${formatHour(nextOpenHour)}`,
  };
}

/**
 * "Order by 2 PM Wed, arrives Thu".
 *
 * The order day is today when the counter is open today and the cutoff has not
 * passed; otherwise it is the next open day. Arrival is the next open day after
 * that, so a Friday order reads "arrives Mon" rather than promising a weekend
 * delivery the branch does not run.
 */
export function orderByLine(cutoffHour: number, now: Date = new Date()): string {
  const { weekday, hour } = pacificParts(now);
  const canOrderToday = isOpenDay(weekday) && hour < cutoffHour;
  const orderDay = canOrderToday ? weekday : nextOpenDay(weekday);
  const arriveDay = nextOpenDay(orderDay);
  return `Order by ${formatHour(cutoffHour)} ${weekdayLabel(orderDay)}, arrives ${weekdayLabel(arriveDay)}`;
}
