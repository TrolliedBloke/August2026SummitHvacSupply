# Summit HVAC Supply theme

## Concept

"The counter, extended." The website should feel like a supply counter that happens to be online. Nothing decorative. The stock count is the hero, not imagery.

## Color

Black, white, green only:

- `--ink`: `#1C1C1A` for navigation text, headings, and body
- `--text-2`: `#5F5E5A` for secondary text
- `--text-muted`: `#8A8880` for hints and metadata
- `--page`: `#FAFAF8` for the warm page background
- `--surface`: `#FFFFFF` for cards and navigation
- `--border`: `#E3E1DA` for all hairlines
- `--green`: `#1B7A3D`

Green has exactly one meaning: yes.

- Green text means availability.
- Green fill means action.
- Nothing else is green. No green headers, backgrounds, icons, or decorative fills.

## Typography

- Match the reference metrics as closely as possible.
- Use weights `400` and `500` only. Never `600` or `700`.
- Use tabular and lining numerals everywhere: `font-variant-numeric: tabular-nums lining-nums`.
- Render all part numbers, model numbers, and serials in monospace.
- Sentence case everywhere. No all caps, no title case, no exclamation marks.
- Font choice: the reference reads like a neutral grotesk with Inter/Helvetica proportions. The closest already-installed free equivalent is Inter for body and Inter Tight for large headings. Use Inter Tight only for headline metrics; keep weights at `400` and `500`.

## Chrome

- Navigation is white, sticky, `52px` to `54px` tall, with a hairline bottom border.
- No nav shadow and no height change on scroll.
- Borders are `0.5px solid var(--border)`.
- Control radius is `6px`.
- Card radius is `12px`.
- No gradients, drop shadows, glass, parallax, or carousels.
- Transitions are `150ms` or less.
- No entrance animations.

## Layout priorities

- Search field is the hero.
- No hero image and no hero video.
- Homepage order:
  1. Navigation
  2. Search
  3. Two-door split: trade and homeowner
  4. Category tiles
  5. Branch strip
  6. Compliance block
  7. Thin footer
- Mobile order:
  1. Search
  2. Branch strip
  3. Two-door split
- Category tiles use line art or product-on-white. Never scenes.

## Implementation rules

- Change tokens before one-off component values.
- Keep semantic HTML.
- Do not add libraries without approval.
- If real operational copy or numbers are unknown, use copy shaped to the correct length and flag it for replacement.
