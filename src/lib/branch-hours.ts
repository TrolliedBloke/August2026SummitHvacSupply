/**
 * Compatibility layer over `lib/branch.ts`.
 *
 * The branch schedule used to live here as its own weekly table with no holiday
 * model, so "Open until 5 PM" showed on Thanksgiving. Hours, exceptions and
 * status now come from the Branch entity; these helpers only adapt that model
 * to the older call shape. New code should import from `lib/branch.ts`.
 */
import { branchStatus as statusFor, formatMinutes, isOpenStatus, NEWARK } from "./branch";
import { deliveryPromise } from "./backend/fulfillment";

export const BRANCH_TIME_ZONE = NEWARK.timezone;

/** 17 -> "5 PM", 7 -> "7 AM", 14 -> "2 PM". No ":00" anywhere. */
export function formatHour(hour: number): string {
  return formatMinutes(hour * 60);
}

/** "Open until 5 PM" while open; otherwise the next opening or the exception. */
export function branchStatus(now: Date = new Date()): { open: boolean; label: string } {
  const status = statusFor(NEWARK, now);
  return { open: isOpenStatus(status), label: status.label };
}

/** "Order by 2 PM Wed, arrives Thu", from the same calculator checkout uses. */
export function orderByLine(_cutoffHour?: number, now: Date = new Date()): string {
  return deliveryPromise(now)?.line ?? "Delivery dates confirmed with your order";
}
