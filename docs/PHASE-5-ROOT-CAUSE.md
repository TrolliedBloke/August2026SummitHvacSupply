# Phase 5: product detail refresh

## Root cause

The product detail page already had the right commerce state and purchase
actions, but the buyer-critical presentation was visually underweighted: the
price qualifier and fulfillment notes used small, low-contrast text, while
the only related-products strip was a generic same-catalog fallback. That made
the price/stock decision harder to scan and could surface unrelated equipment
instead of installation parts.

## Changes

- Increased price, list-price qualifier, availability detail, and fulfillment
  copy to readable sizes and darker tokens without changing the commerce
  resolver or action labels.
- Replaced generic “Nearby catalog items” with category-driven “You might also
  need” recommendations using real non-archived catalog records.
- Ranked verified positive stock ahead of uncounted accessories.
- Added unit tests covering accessory matching and stock-priority ordering.

## Uncertainty

Live inventory is intentionally unavailable in the local environment, so the
visual check shows the neutral “Stock confirmed at order” state. Production
counts will change the badge and quantity text through the existing inventory
overlay; the recommendation ranking already handles that overlay.
