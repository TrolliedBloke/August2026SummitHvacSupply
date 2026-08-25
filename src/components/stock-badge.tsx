import { Check, Clock, HelpCircle, PackageX } from "lucide-react";
import { availabilityCopy } from "@/lib/catalog/availability";
import type { CatalogAvailability, StorefrontSku } from "@/lib/storefront/catalog";

/**
 * The stock counter. One component, every product surface.
 *
 * Counts come from QuickBooks via the live-inventory overlay and are refreshed
 * on a 15-minute schedule. Three rules hold everywhere it renders:
 *
 *  1. A number appears ONLY when the warehouse actually counted the product.
 *     An uncounted product says "Availability on request" -- it never borrows a
 *     zero, and it never implies a shelf.
 *  2. Green means one thing on this site: yes, we have it. Only a positive
 *     verified count earns it.
 *  3. The counter describes the shelf, not the checkout. The catalog is
 *     quote-only, so "In stock" sits beside "Check availability" rather than a
 *     buy button. Those are not in tension -- it is how a supply counter works.
 */

type CountedStatus = Exclude<CatalogAvailability, "unknown">;

function isCounted(status: CatalogAvailability, verified: boolean): status is CountedStatus {
  return verified && status !== "unknown";
}

type Tone = {
  className: string;
  icon: React.ReactNode;
};

function tone(status: CatalogAvailability, counted: boolean): Tone {
  if (!counted || status === "unknown") {
    return { className: "border border-line bg-surface-2 text-ink-3", icon: <HelpCircle size={13} /> };
  }
  switch (status) {
    case "in_stock":
    case "low_stock":
      return { className: "bg-stock-ready-tint text-stock-ready-ink", icon: <Check size={13} /> };
    case "out_of_stock":
      return { className: "border border-line bg-surface-2 text-ink-3", icon: <PackageX size={13} /> };
    default:
      return { className: "border border-line bg-surface-2 text-ink-3", icon: <Clock size={13} /> };
  }
}

/**
 * Raw-props form, for callers that hold availability fields but not a whole
 * StorefrontSku -- the nav search dropdown reads them straight off the JSON the
 * search endpoint returns.
 */
export function StockChip({
  status,
  available,
  verified,
  hideCount = false,
  compact = false,
  className = "",
}: {
  status: CatalogAvailability;
  available: number;
  verified: boolean;
  /** Suppress the inline count when the caller renders the figure itself. */
  hideCount?: boolean;
  /**
   * Narrow surfaces (the mobile sticky bar) where the full phrasing would wrap
   * or truncate. Compact renders the count alone and stays silent when the
   * product is uncounted -- the page it sits on already states that in full, so
   * a truncated hedge here would add nothing but noise.
   */
  compact?: boolean;
  className?: string;
}) {
  const counted = isCounted(status, verified);
  const { className: toneClass, icon } = tone(status, counted);
  const showCount =
    !hideCount && counted && (status === "in_stock" || status === "low_stock") && available > 0;
  if (compact && !counted) return null;
  const label = counted
    ? compact && showCount
      ? `${available} on hand`
      : availabilityCopy(status).label
    : "Availability on request";
  if (compact) {
    return (
      <span className={`tnum inline-flex items-center gap-1 font-mono text-xs ${showCount ? "text-stock-ready" : "text-ink-3"} ${className}`}>
        {icon}
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClass} ${className}`}
    >
      {icon}
      {label}
      {showCount && <span className="tnum font-mono">· {available}</span>}
    </span>
  );
}

/** Compact counter for product cards, search results and related items. */
export function StockBadge({ sku, className = "" }: { sku: StorefrontSku; className?: string }) {
  return (
    <StockChip
      status={sku.availabilityStatus}
      available={sku.available}
      verified={sku.availabilityVerified}
      className={className}
    />
  );
}

/**
 * The product page treatment: the count as a real figure rather than a chip,
 * because on a PDP the number is the fact the visitor came for.
 */
export function StockLine({
  sku,
  qualify = true,
  className = "",
}: {
  sku: StorefrontSku;
  /** Append the reminder that a person still confirms the order. */
  qualify?: boolean;
  className?: string;
}) {
  const status = sku.availabilityStatus;
  const counted = isCounted(status, sku.availabilityVerified);
  const onHand = counted && sku.available > 0;
  const copy = counted
    ? availabilityCopy(status)
    : {
        label: "Availability on request",
        detail: "We confirm this one with the warehouse before the order is accepted.",
      };

  return (
    <div className={className}>
      <div className="flex items-baseline gap-3">
        {onHand && (
          <span className="tnum font-mono text-3xl font-medium leading-none text-stock-ready">
            {sku.available}
          </span>
        )}
        <StockChip
          status={sku.availabilityStatus}
          available={sku.available}
          verified={sku.availabilityVerified}
          hideCount={onHand}
        />
      </div>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        {copy.detail}
        {/* The quote-only reminder only earns its place when there IS stock --
            that is the case where a visitor might otherwise expect to check out
            on the spot. The other two states already end in a sentence about
            confirming with us, and adding it twice read as a stutter. */}
        {qualify && onHand && " We confirm the order with you before it ships."}
      </p>
    </div>
  );
}
