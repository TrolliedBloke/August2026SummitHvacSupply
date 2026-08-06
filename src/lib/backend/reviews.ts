import { createServiceRoleSupabaseClient } from "./supabase";
import { getReviews as getPlaceholderReviews, type Review } from "@/lib/reviews";

/**
 * Real review reads.
 *
 * Source of truth is the `published_product_reviews` view (migration 009),
 * which encodes the three publish gates -- approved + consented + tied to a
 * verified order -- so a caller here cannot accidentally read a pending or
 * unconsented row.
 *
 * When Supabase is not configured this falls back to the placeholder registry
 * in @/lib/reviews, which is itself production-blocked. The net effect is that
 * production shows real reviews or nothing at all; it can never show demo data.
 */

type PublishedRow = {
  sku_id: string | null;
  series_slug: string | null;
  author_name: string;
  author_role: string | null;
  company_name: string | null;
  city: string | null;
  audience: string;
  rating: number;
  title: string | null;
  body: string;
  verified_purchase: boolean;
  submitted_at: string;
};

function toReview(row: PublishedRow): Review {
  // Contractors are credited with their company, since that is the signal a
  // trade reader weighs; homeowners are not, per what they consent to.
  const role =
    row.audience === "contractor" && row.company_name
      ? `${row.author_role ?? "Contractor"}, ${row.company_name}`
      : row.author_role ?? undefined;

  return {
    author: row.author_name,
    role,
    rating: row.rating,
    title: row.title ?? undefined,
    body: row.body,
    date: row.submitted_at,
    location: row.city ?? undefined,
    verified: row.verified_purchase,
  };
}

/**
 * Reviews for a product. Keys on SKU first; a review filed against the series
 * applies to the series, but a review filed against one SKU is never inherited
 * by a sibling SKU -- ratings must not migrate between unrelated products.
 */
export async function getPublishedReviews(
  skuId: string,
  seriesSlug: string
): Promise<Review[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return getPlaceholderReviews(skuId, seriesSlug);

  // Two `.eq()` queries rather than one interpolated `.or()`: skuId and
  // seriesSlug arrive from the URL, and PostgREST's `or` takes a filter
  // expression as a STRING, so a crafted param could inject extra filter
  // syntax. `.eq()` passes the value as a bound parameter and cannot.
  const [skuResult, seriesResult] = await Promise.all([
    supabase
      .from("published_product_reviews")
      .select("*")
      .eq("sku_id", skuId)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("published_product_reviews")
      .select("*")
      .is("sku_id", null)
      .eq("series_slug", seriesSlug)
      .order("submitted_at", { ascending: false }),
  ]);

  if (skuResult.error || seriesResult.error) {
    return getPlaceholderReviews(skuId, seriesSlug);
  }
  const data = [...(skuResult.data ?? []), ...(seriesResult.data ?? [])];

  const merged = data as PublishedRow[];

  // No real reviews yet -> fall back so local demos still have something to
  // show. Production is gated inside the placeholder module, so this returns
  // an empty array there and the "no reviews yet" state renders.
  if (merged.length === 0) return getPlaceholderReviews(skuId, seriesSlug);

  return merged.map(toReview);
}

export type ReviewSubmission = {
  skuId?: string;
  seriesSlug?: string;
  authorName: string;
  authorRole?: string;
  companyName?: string;
  city?: string;
  audience: "homeowner" | "contractor" | "property_manager";
  rating: number;
  title?: string;
  body: string;
  orderNumber?: string;
  consentPublish: boolean;
};

/**
 * Accepts a review for moderation. Never publishes: rows land as 'pending' and
 * a human approves them. Consent is recorded with a timestamp because "did the
 * reviewer agree to this" has to be answerable later, not assumed.
 */
export async function submitReview(
  input: ReviewSubmission
): Promise<{ ok: boolean; error?: string }> {
  if (!input.consentPublish) {
    return { ok: false, error: "Consent to publish is required." };
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "Rating must be a whole number from 1 to 5." };
  }
  if (input.body.trim().length < 20) {
    return { ok: false, error: "Please write at least a sentence or two." };
  }
  if (!input.skuId && !input.seriesSlug) {
    return { ok: false, error: "A review must reference a product." };
  }

  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return { ok: false, error: "Reviews are unavailable right now." };

  // Tie the review to a real order when an order number is supplied. Without a
  // match the row still stores, but verified_order_id stays null and the
  // publish gate keeps it invisible -- unverifiable reviews never go live.
  let verifiedOrderId: string | null = null;
  if (input.orderNumber) {
    const { data: order } = await supabase
      .from("sales_orders")
      .select("id")
      .eq("order_number", input.orderNumber.trim())
      .maybeSingle();
    verifiedOrderId = (order as { id: string } | null)?.id ?? null;
  }

  const { error } = await supabase.from("product_reviews").insert({
    sku_id: input.skuId ?? null,
    series_slug: input.seriesSlug ?? null,
    author_name: input.authorName.trim(),
    author_role: input.authorRole?.trim() || null,
    company_name: input.companyName?.trim() || null,
    city: input.city?.trim() || null,
    audience: input.audience,
    rating: input.rating,
    title: input.title?.trim() || null,
    body: input.body.trim(),
    verified_order_id: verifiedOrderId,
    consent_publish: true,
    consent_recorded_at: new Date().toISOString(),
    status: "pending",
  });

  if (error) return { ok: false, error: "Could not save your review." };
  return { ok: true };
}
