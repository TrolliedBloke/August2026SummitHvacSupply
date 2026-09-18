import { Star, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import type { Review, ReviewSummary } from "@/lib/reviews";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = value >= i + 1;
        const half = !filled && value > i;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-ink-4" strokeWidth={2} />
            {(filled || half) && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: half ? "50%" : "100%" }}>
                <Star size={size} className="text-copper" fill="currentColor" strokeWidth={2} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function ReviewStarsInline({ summary }: { summary: ReviewSummary }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Stars value={summary.average} size={15} />
      <span className="tnum font-semibold text-ink-1">{summary.average.toFixed(1)}</span>
      <span className="text-ink-3">({summary.count})</span>
    </span>
  );
}

export function ProductReviews({
  reviews,
  summary,
}: {
  reviews: Review[];
  summary: ReviewSummary | null;
}) {
  return (
    <section className="mt-16" id="reviews">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">Reviews</h2>
        {summary && (
          <div className="flex items-center gap-3">
            <Stars value={summary.average} size={18} />
            <span className="tnum text-lg font-semibold text-ink-1">{summary.average.toFixed(1)}</span>
            <span className="text-sm text-ink-3">
              from {summary.count} verified {summary.count === 1 ? "review" : "reviews"}
            </span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-(--r-md) border border-dashed border-line-strong bg-surface-2/50 p-6">
          <span className="grid size-10 place-items-center rounded-(--r-sm) bg-surface-3 text-ink-3">
            <MessageSquarePlus size={18} />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-ink-1">No reviews yet</h3>
            <p className="mt-1 max-w-prose text-sm text-ink-2">
              Bought or installed this system? Share how it performed to help other Bay Area
              buyers choose with confidence.
            </p>
          </div>
          <Link
            href="/contact?topic=review"
            className="inline-flex h-10 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand-hover"
          >
            Write a review
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.map((review, index) => (
            <li key={index} className="rounded-(--r-md) border border-line bg-surface-1 p-5">
              <div className="flex items-center justify-between gap-3">
                <Stars value={review.rating} />
                {review.verified && (
                  <span className="rounded-full bg-eco-tint px-2 py-0.5 text-xs font-semibold text-eco-ink">
                    Verified buyer
                  </span>
                )}
              </div>
              {review.title && (
                <h3 className="mt-3 font-display text-base font-semibold text-ink-1">{review.title}</h3>
              )}
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{review.body}</p>
              <p className="mt-3 text-xs text-ink-3">
                {review.author}
                {review.role ? ` · ${review.role}` : ""}
                {review.location ? ` · ${review.location}` : ""}
                {" · "}
                {new Date(review.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
