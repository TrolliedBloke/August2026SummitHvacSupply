/**
 * The three customer tiers (docs/FINDER-AND-AUDIENCE-PLAN.md 2.1).
 *
 *   self_identified_pro  picked "contractor" in the finder: contractor content,
 *                        stock alerts, an invitation to apply. No pricing.
 *   verified_pro         an approved trade account (license checked by staff,
 *                        migration 030): account pricing, quick order, reorder.
 *   homeowner            retail pricing, education, installer introduction.
 *
 * A finder answer can only ever produce the first tier. Account pricing has
 * one source, the signed-in account (lib/commerce/price-presentation.ts), so
 * nothing a visitor says about themselves can change a price.
 */

export type TradeTier = "homeowner" | "self_identified_pro" | "verified_pro";

export type TierInput = {
  /** The signed-in profile, if any. */
  profile: { role: string; accountId: string | null } | null;
  /** The finder path the visitor chose, if any. */
  finderPath?: "homeowner" | "contractor" | null;
};

export function tradeTier({ profile, finderPath }: TierInput): TradeTier {
  if (profile && (profile.role === "dealer" || profile.role === "installer") && profile.accountId) return "verified_pro";
  if (finderPath === "contractor") return "self_identified_pro";
  return "homeowner";
}

export const TIER_LABEL: Record<TradeTier, string> = {
  homeowner: "Homeowner",
  self_identified_pro: "Contractor (not yet verified)",
  verified_pro: "Verified trade account",
};
