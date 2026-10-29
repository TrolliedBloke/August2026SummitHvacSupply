# Summit HVAC Supply theme

## Concept

"The counter, extended." The website should feel like a supply counter that happens to be online. Nothing decorative. The stock count is the hero, not imagery.

## Color

Gold, grey, white only. Gold replaced green as the accent on 2026-10-29; the
single-meaning rule it carried is unchanged, and matters more now, not less.

- `--ink`: `#111111` for navigation text, headings, and body
- `--text-2`: `#555555` for secondary text
- `--text-muted`: `#6F6E69` for hints and metadata
- `--page`: `#F4F4F2` for the neutral page background
- `--surface`: `#FFFFFF` for cards and navigation
- `--border`: `#DEDEDA` for all hairlines
- `--gold`: `#8A6512` — text-weight gold
- `--gold-fill`: `#D4AF37` — fills only
- `--chrome`: `#2E2E2B` — the utility strip and footer, nothing else

The page is a neutral grey, not the warm off-white green used. Gold is the only
chroma on the screen, and a warm background muddied it.

**The two golds are not interchangeable, and this is the rule most likely to be
got wrong.**

- `--gold-fill` (`#D4AF37`) is for fills, and anything on it takes **ink**.
  White on it measures about 2.3:1 — unreadable at any size. If you find
  yourself writing white text on gold, you want the other one.
- `--gold` (`#8A6512`) is for text. It sits around 5:1 on white, so it is safe
  for links, headings, and status at small sizes.

Gold has exactly one meaning: yes.

- Gold text means availability.
- Gold fill means action.
- Nothing else is gold. No gold headers, backgrounds, icons, or decorative
  fills.

The one named exception is `--chrome`: the utility strip and footer sit on dark
grey. It is a surface, never an action or a status (DESIGN-UX-DECISION-LOG
D-08), and `tests/tokens.test.ts` pins which files may use it.

Chrome is deliberately grey rather than a third gold. Two golds already carry
meaning; a third would stop the ranking reading as a ranking.

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
