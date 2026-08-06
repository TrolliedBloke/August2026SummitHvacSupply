import Image from "next/image";
import { Quote } from "lucide-react";
import { publishable, type Testimonial } from "@/lib/testimonials";

/**
 * Renders company testimonials for one audience.
 *
 * Returns null when there is nothing consented to show, so a page with no
 * testimonials collapses cleanly instead of leaving an empty container or a
 * "coming soon" placeholder — an empty proof box reads worse than no box.
 */
export function TestimonialSlot({
  items,
  heading,
  className = "",
}: {
  items: Testimonial[];
  heading?: string;
  className?: string;
}) {
  const shown = publishable(items);
  if (shown.length === 0) return null;

  return (
    <section className={className}>
      {heading && (
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink-1">
          {heading}
        </h2>
      )}
      <div
        className={`${heading ? "mt-5" : ""} grid gap-4 ${
          shown.length > 1 ? "sm:grid-cols-2" : ""
        }`}
      >
        {shown.map((t, i) => (
          <figure
            key={i}
            className="rounded-(--r-md) border border-line bg-surface-1 px-5 py-5"
          >
            <div className="flex items-start justify-between gap-4">
              <Quote size={18} className="text-ink-3" aria-hidden="true" />
              {t.demo && (
                <span className="rounded-(--r-sm) border border-line px-2 py-1 text-[11px] font-medium text-ink-3">
                  Sample testimonial
                </span>
              )}
            </div>
            <blockquote className="mt-3 text-base leading-relaxed text-ink-1">
              {t.quote}
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 text-sm text-ink-2">
              {t.image && (
                <Image
                  src={t.image}
                  alt={t.imageAlt ?? ""}
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-full border border-line object-cover"
                />
              )}
              <span>
                <span className="font-medium text-ink-1">{t.name}</span>
                {t.company && <>, {t.company}</>}
                <span className="block text-ink-3">
                  {[t.trade, t.city].filter(Boolean).join(" · ")}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
