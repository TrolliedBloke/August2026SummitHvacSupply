"use client";

import * as React from "react";
import { useQuote } from "./quote-context";
import { QuoteDrawer } from "./quote-drawer";

function useClientMounted() {
  return React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    () => true,
    () => false
  );
}

/**
 * The cart drawer is imported statically, not code-split.
 *
 * It used to be dynamic(ssr:false). Measured on a production build, that cost
 * 306ms on the first add: the header cart badge updated in 2ms while the drawer
 * did not mount until 308ms, and the entire gap was its chunk being fetched on
 * demand. No amount of easing hides that -- the slide cannot begin until the
 * code exists, so the first open looked broken while every later one was
 * smooth.
 *
 * Warming the chunk was tried twice and did not fix it. Behind
 * requestIdleCallback the fetch still landed at click time; behind a plain
 * timeout the warm did fire (a chunk arrives at 826ms) but two sibling chunks
 * still loaded at click, because a manual import() does not pull everything
 * Turbopack split out of this module's graph.
 *
 * The whole drawer is about 6KB across those chunks. Carrying it in the main
 * bundle is a better trade than a third of a second of dead air on the primary
 * action of a storefront. Rendering is still gated on `mounted`, so the drawer
 * is client-only and there is no hydration mismatch -- which is what ssr:false
 * was protecting against.
 */
export function QuoteDrawerMount() {
  const { count, isOpen } = useQuote();
  // `count` is restored from localStorage on the client only, so defer the
  // decision to render until after mount to avoid a hydration mismatch.
  const mounted = useClientMounted();
  const shouldRender = mounted && (isOpen || count > 0);

  return shouldRender ? <QuoteDrawer /> : null;
}
