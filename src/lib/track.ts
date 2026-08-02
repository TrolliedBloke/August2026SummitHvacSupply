"use client";

/**
 * Fire-and-forget client analytics. sendBeacon survives navigation (the
 * moments worth measuring are usually right before one); fetch keepalive is
 * the fallback. Never throws, never blocks.
 */
export function track(name: string, metadata?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ name, page: window.location.pathname, metadata });
  try {
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
      return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics never breaks the page */
  }
}
