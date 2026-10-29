/**
 * Contractor credit limits (docs/LIABILITY-REMEDIATION-PLAN.md, 1.6).
 *
 * A net-terms order ships on account before it is paid, so every one extends
 * credit. The order is checked against the account's limit: what it already
 * owes on open invoices, plus net-terms orders not yet invoiced, plus this
 * order. Pure; src/lib/backend/checkout.ts loads the figures.
 *
 * Over the limit the order is HELD for staff approval rather than refused,
 * until the owner decides between hold and block (O-3). An account with no
 * limit set has a limit of $0, so every net-terms order is held until the
 * owner sets limits. That is deliberate: no limit is not unlimited credit.
 */

// TODO(summit-owner O-3): confirm "hold" (approve over-limit orders by hand) or "block".
export const CREDIT_POLICY = {
  overLimit: "hold" as "hold" | "block",
  status: "pending_owner" as "pending_owner" | "confirmed",
};

export type CreditFacts = {
  creditLimit: number | null;
  /** Unpaid balance of draft, open, partial and overdue invoices. */
  openInvoiceBalance: number;
  /** Net-terms orders placed but not yet invoiced or cancelled. */
  uninvoicedOrders: number;
};

export type CreditDecision =
  | { ok: true; exposure: number; limit: number }
  | { ok: false; reason: "no_limit" | "over_limit"; exposure: number; limit: number; action: "hold" | "block"; detail: string };

const usd = (value: number) => `$${value.toFixed(2)}`;

export function creditDecision(facts: CreditFacts, orderTotal: number): CreditDecision {
  const limit = Math.max(0, Number(facts.creditLimit ?? 0) || 0);
  const exposure = Math.round((facts.openInvoiceBalance + facts.uninvoicedOrders + orderTotal) * 100) / 100;
  if (exposure <= limit && limit > 0) return { ok: true, exposure, limit };
  const reason = limit > 0 ? "over_limit" : "no_limit";
  const detail =
    reason === "no_limit"
      ? `No credit limit is set for this account. Owed ${usd(facts.openInvoiceBalance)}, uninvoiced ${usd(facts.uninvoicedOrders)}, this order ${usd(orderTotal)}.`
      : `Limit ${usd(limit)}; owed ${usd(facts.openInvoiceBalance)}, uninvoiced ${usd(facts.uninvoicedOrders)}, this order ${usd(orderTotal)} = ${usd(exposure)}.`;
  return { ok: false, reason, exposure, limit, action: CREDIT_POLICY.overLimit, detail };
}
