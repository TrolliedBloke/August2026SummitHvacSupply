import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getStorefrontSku } from "@/lib/storefront/catalog";
import { applyLiveInventory, getLiveInventory } from "@/lib/storefront/live-inventory";
import { buildSnapshot } from "@/lib/checkout-snapshot";
import type { CheckoutSnapshot } from "@/lib/checkout-snapshot-types";
import { createServiceRoleSupabaseClient } from "./supabase";
import { loadTradePricingResult } from "./portal";
import { resolvePortalAccess, toAccountContext } from "./session-access";
import type { FulfillmentMethod } from "./fulfillment";

/**
 * Issues the checkout snapshot: authoritative unit prices (by the session's
 * authorization), stock, fulfillment methods and windows, fee, tax and total,
 * hashed and signed with an expiry. The checkout page renders only this, and
 * an order is accepted only against a snapshot whose digest still matches.
 */
function secret(): string {
  const configured = process.env.CHECKOUT_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "summit-local-checkout-snapshot";
  throw new Error("CHECKOUT_TOKEN_SECRET is required in production");
}

async function dbDeliveryFee(zip: string | null): Promise<{ fee: number; freeOver: number; eligible: boolean } | null> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase || !zip) return null;
  const { data } = await supabase
    .from("delivery_zones")
    .select("local_delivery_eligible, delivery_fee, free_delivery_over")
    .eq("zip", zip.slice(0, 5))
    .maybeSingle();
  if (!data) return null;
  return { fee: Number(data.delivery_fee), freeOver: Number(data.free_delivery_over), eligible: Boolean(data.local_delivery_eligible) };
}

export async function issueCheckoutSnapshot(input: {
  items: Array<{ skuId: string; qty: number }>;
  method: FulfillmentMethod;
  zip: string | null;
  now?: Date;
}): Promise<CheckoutSnapshot> {
  const access = await resolvePortalAccess();
  const account = toAccountContext(access);
  const live = await getLiveInventory();
  const skuIds = input.items.map((item) => item.skuId);
  const pricing = account.kind === "tradeApproved" ? await loadTradePricingResult(skuIds) : null;
  const zoneFee = await dbDeliveryFee(input.zip);

  const built = buildSnapshot({
    ...input,
    resolveSku: (skuId) => {
      const sku = getStorefrontSku(skuId);
      return sku ? applyLiveInventory(sku, live) : undefined;
    },
    account,
    pricing,
    deliveryFee: (subtotal) =>
      zoneFee ? (!zoneFee.eligible ? 0 : zoneFee.freeOver > 0 && subtotal >= zoneFee.freeOver ? 0 : zoneFee.fee) : null,
  });
  const { digestSource, ...snapshot } = built;
  const digest = createHash("sha256").update(digestSource).digest("base64url");
  const payload = Buffer.from(JSON.stringify({ d: digest, e: snapshot.expiresAt })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { ...snapshot, digest, token: `${payload}.${signature}` };
}

/** The digest a token vouches for, or null when it is forged or expired. */
export function verifySnapshotToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const payload = token.slice(0, split);
  const expected = Buffer.from(createHmac("sha256", secret()).update(payload).digest("base64url"));
  const provided = Buffer.from(token.slice(split + 1));
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { d: string; e: string };
    return new Date(parsed.e).getTime() > now ? parsed.d : null;
  } catch {
    return null;
  }
}
