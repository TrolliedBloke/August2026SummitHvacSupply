"use client";

import * as React from "react";
import { HardHat, UserRound } from "lucide-react";

/**
 * "Show prices as" -- a real radio group, not two clickable divs, so arrow keys
 * move between the options and a screen reader announces one of two.
 *
 * Signed-out visitors default to Homeowner, because list pricing is what the
 * page actually shows them: net pricing is gated on an approved trade account,
 * so defaulting to Contractor would label the prices on screen wrongly.
 *
 * NOTE(summit): selecting Contractor does not change any price today. There is
 * no pricing state in the app -- these two options were navigation links
 * (/portal/login and /products) before this control existed, and wiring the
 * radio to displayed prices is pricing logic, which this change deliberately
 * does not touch. Decide whether Contractor should route to sign-in or request
 * access before this ships.
 */
const OPTIONS = [
  { value: "contractor", title: "Shop as contractor", note: "Net pricing", Icon: HardHat },
  { value: "homeowner", title: "Shop as homeowner", note: "List pricing", Icon: UserRound },
] as const;

export function PriceAudience() {
  const [value, setValue] = React.useState<string>("homeowner");

  return (
    <fieldset className="mt-8 max-w-[835px] border-0 p-0">
      <legend className="mb-4 p-0 text-meta text-ink-3">Show prices as</legend>
      <div className="grid overflow-hidden rounded-(--r-sm) border border-brand sm:grid-cols-2">
        {OPTIONS.map(({ value: optionValue, title, note, Icon }, index) => (
          <label
            key={optionValue}
            className={`relative flex min-h-15 cursor-pointer items-center gap-4 pl-5 pr-4 transition-colors duration-120 has-[:checked]:bg-brand-tint ${
              index === 0 ? "border-b border-brand sm:border-b-0 sm:border-r" : ""
            } peer-focus-visible:outline-none`}
          >
            <input
              type="radio"
              name="price-audience"
              value={optionValue}
              checked={value === optionValue}
              onChange={() => setValue(optionValue)}
              className="peer sr-only"
            />
            <Icon
              size={24}
              strokeWidth={1.6}
              className="shrink-0 text-ink-1 peer-focus-visible:outline-none"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block text-item font-medium text-ink-1">{title}</span>
              <span className="mt-0.5 block text-meta text-ink-3">{note}</span>
            </span>
            {/* The focus ring belongs to the visible row, not the hidden input. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[2px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
