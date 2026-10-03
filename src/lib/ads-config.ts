import { PRIVACY, PRIVACY_DISCLOSES_AD_SHARING } from "@/content/legal/privacy";
import { getStorefrontSkus } from "@/lib/storefront/catalog";

/**
 * Whether Meta and Google ad tags may load, and with which account ids
 * (docs/FINDER-AND-AUDIENCE-PLAN.md Phases 5-6). Every gate must pass:
 *
 *  1. ADS_ENABLED=true -- the owner turned ads on.
 *  2. The privacy notice in force says Summit shares data for advertising.
 *     Today it says the opposite, and running a pixel would make it false.
 *  3. Counsel approved that notice.
 *  4. There is something to sell: at least one purchasable SKU, or the owner
 *     explicitly approved lead-generation ads (ADS_LEAD_GEN_APPROVED=true).
 *  5. At least one ad account id is configured.
 *
 * Even with every gate open, a visitor's browser still decides: Global
 * Privacy Control or the opt-out cookie means nothing loads (components/ad-tags.tsx).
 * The same gates guard audience exports (lib/backend/audiences.ts).
 */

export type AdsGate =
  | "ads_not_enabled"
  | "privacy_notice_does_not_disclose_sharing"
  | "privacy_notice_not_approved"
  | "nothing_purchasable"
  | "no_ad_account_ids";

export const ADS_GATE_LABEL: Record<AdsGate, string> = {
  ads_not_enabled: "ADS_ENABLED is not set to true",
  privacy_notice_does_not_disclose_sharing: "The privacy notice does not yet disclose sharing for advertising",
  privacy_notice_not_approved: "Counsel has not approved the privacy notice",
  nothing_purchasable: "No SKU is purchasable and lead-generation ads are not approved",
  no_ad_account_ids: "No Meta pixel or Google tag id is configured",
};

export type AdsConfig = {
  enabled: boolean;
  metaPixelId: string | null;
  googleTagId: string | null;
  blockers: AdsGate[];
};

type Env = Record<string, string | undefined>;

const META_ID = /^\d{6,20}$/;
const GOOGLE_ID = /^(AW|G)-[A-Z0-9]{4,20}$/;

export function adsConfig(
  env: Env = process.env,
  privacy: { disclosesSharing: boolean; approved: boolean } = {
    disclosesSharing: PRIVACY_DISCLOSES_AD_SHARING,
    approved: PRIVACY.review.status === "approved",
  },
  purchasableSkus: number = getStorefrontSkus().filter((sku) => sku.purchaseEligible).length
): AdsConfig {
  const metaPixelId = env.NEXT_PUBLIC_META_PIXEL_ID && META_ID.test(env.NEXT_PUBLIC_META_PIXEL_ID) ? env.NEXT_PUBLIC_META_PIXEL_ID : null;
  const googleTagId = env.NEXT_PUBLIC_GOOGLE_TAG_ID && GOOGLE_ID.test(env.NEXT_PUBLIC_GOOGLE_TAG_ID) ? env.NEXT_PUBLIC_GOOGLE_TAG_ID : null;
  const blockers: AdsGate[] = [];
  if (env.ADS_ENABLED !== "true") blockers.push("ads_not_enabled");
  if (!privacy.disclosesSharing) blockers.push("privacy_notice_does_not_disclose_sharing");
  if (!privacy.approved) blockers.push("privacy_notice_not_approved");
  if (purchasableSkus === 0 && env.ADS_LEAD_GEN_APPROVED !== "true") blockers.push("nothing_purchasable");
  if (!metaPixelId && !googleTagId) blockers.push("no_ad_account_ids");
  return { enabled: blockers.length === 0, metaPixelId, googleTagId, blockers };
}
