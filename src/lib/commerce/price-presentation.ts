/**
 * How a price is presented, and on whose authority.
 *
 * A number on its own cannot say whether it is the list price, an approved
 * account's price, a figure that is only indicative until checkout, or a stand-
 * in because the account price failed to load. Every commerce surface renders
 * through this object instead, so none of them can relabel a retail figure as a
 * trade one or keep showing a stale account price after sign-out.
 *
 * Account pricing is only ever produced by the session-scoped server projection
 * (app/api/commerce/lines). Public HTML and cached pages only ever carry
 * `tier: "retail"`.
 */

export type AccountContext =
  | { kind: "anonymous" }
  | { kind: "retail" }
  | { kind: "tradePending" }
  | { kind: "tradeApproved"; accountId: string; tierLabel: string }
  | { kind: "staff" }
  | { kind: "disabled" };

export type PriceState = "finalForSnapshot" | "indicative" | "unavailable" | "authorizationRequired";

export type PricePresentation = {
  state: PriceState;
  amount: number | null;
  currency: "USD";
  tier: "retail" | "account";
  /** "List price", "Your account price", "Account price unavailable". */
  tierLabel: string;
  /** Where the figure came from: the public catalog or one account. */
  source: "catalog" | `account:${string}`;
  asOf: string | null;
  expiresAt: string | null;
  taxQualifier: "plus tax" | "tax on invoice" | null;
};

export function isTradeContext(account: AccountContext): account is Extract<AccountContext, { kind: "tradeApproved" }> {
  return account.kind === "tradeApproved";
}

export function retailPrice(amount: number | null, state: PriceState = "indicative", asOf: string | null = null): PricePresentation {
  return {
    state: amount === null ? "unavailable" : state,
    amount,
    currency: "USD",
    tier: "retail",
    tierLabel: "List price",
    source: "catalog",
    asOf,
    expiresAt: null,
    taxQualifier: amount === null ? null : "plus tax",
  };
}

export function accountPrice(
  amount: number,
  account: Extract<AccountContext, { kind: "tradeApproved" }>,
  { asOf, expiresAt, state = "indicative" }: { asOf: string; expiresAt: string | null; state?: PriceState }
): PricePresentation {
  return {
    state,
    amount,
    currency: "USD",
    tier: "account",
    tierLabel: `Your account price · ${account.tierLabel}`,
    source: `account:${account.accountId}`,
    asOf,
    expiresAt,
    taxQualifier: "tax on invoice",
  };
}

/** The account price could not be confirmed. Never falls back to retail as if it were trade. */
export function accountPriceUnavailable(): PricePresentation {
  return {
    state: "unavailable",
    amount: null,
    currency: "USD",
    tier: "account",
    tierLabel: "Account price unavailable",
    source: "catalog",
    asOf: null,
    expiresAt: null,
    taxQualifier: null,
  };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function formatPrice(price: PricePresentation | null): string | null {
  if (!price || price.amount === null) return null;
  return usd.format(price.amount);
}

/** True when a presentation has expired and must be refreshed before use. */
export function isStale(price: PricePresentation, now = new Date()): boolean {
  return Boolean(price.expiresAt && new Date(price.expiresAt).getTime() <= now.getTime());
}
