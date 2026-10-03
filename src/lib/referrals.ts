import { z } from "zod";

export const REFERRAL_OUTCOMES = ["introduced", "contacted", "quoted", "installed", "declined", "no_response"] as const;

export const referralPreferencesSchema = z.object({
  accepts: z.boolean(),
  paused: z.boolean(),
  zips: z.string().transform((value) => [...new Set(value.split(/[\s,;]+/).filter(Boolean))])
    .pipe(z.array(z.string().regex(/^\d{5}$/, "Use five-digit ZIP codes.")).max(100)),
}).refine((value) => !value.accepts || value.zips.length > 0, "Enter at least one ZIP code to accept referrals.");

/** Account orders after an introduction are a correlation, not proof of a referred sale.
 * Each order belongs only to the most recent preceding introduction for that account. */
export function attributeReferralOrders(
  referrals: Array<{ id: string; account_id: string; introduced_at: string }>,
  orders: Array<{ id: string; account_id: string | null; created_at: string; total: number | string }>,
) {
  const totals = new Map(referrals.map((row) => [row.id, { orders: 0, total: 0 }]));
  const newest = [...referrals].sort((a, b) => b.introduced_at.localeCompare(a.introduced_at) || a.id.localeCompare(b.id));
  for (const order of orders) {
    const referral = newest.find((row) => row.account_id === order.account_id && row.introduced_at <= order.created_at);
    if (!referral) continue;
    const tally = totals.get(referral.id)!;
    tally.orders += 1;
    tally.total += Number(order.total);
  }
  return totals;
}
