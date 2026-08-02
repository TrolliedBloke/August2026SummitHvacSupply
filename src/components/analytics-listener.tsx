"use client";

import * as React from "react";
import { track } from "@/lib/track";

/**
 * Activates every `data-conversion-hook` attribute in the app: one delegated
 * click listener, one event per interaction, named by the hook value. The
 * hooks were already scattered through the UI as mount points — this is the
 * listener they were waiting for.
 */
export function AnalyticsListener() {
  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest?.("[data-conversion-hook]");
      const hook = target?.getAttribute("data-conversion-hook");
      if (hook) track(hook.replace(/[^a-z0-9_-]/gi, "-").toLowerCase());
    }
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
