"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { createBrowserSupabase } from "@/lib/client/supabase-browser";

/**
 * Keeps a staff page current without a reload.
 *
 * Primary: the private Realtime topic "crm" (migration 037). The database
 * broadcasts { table, op } whenever a table the customer view reads changes;
 * the event carries no customer data, so this component only asks the server
 * to re-render (router.refresh), and the server re-runs its own staff-only
 * query. Bursts are coalesced into one refresh.
 *
 * Fallback: refresh when the tab regains focus, and poll on an interval
 * while it is visible and Realtime is not live -- so the page still updates if Realtime is
 * unavailable, the session lacks staff rights, or in local demo mode.
 */

const DEBOUNCE_MS = 800;
const POLL_MS = 30_000;

export function LiveRefresh({ topic = "crm" }: { topic?: string }) {
  const router = useRouter();
  // Without Supabase in the browser (local demo) there is nothing to connect to.
  const [mode, setMode] = React.useState<"connecting" | "live" | "polling">(() => (createBrowserSupabase() ? "connecting" : "polling"));
  const [updatedAt, setUpdatedAt] = React.useState(() => new Date());
  const timer = React.useRef<number | null>(null);
  const modeRef = React.useRef(mode);
  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const refresh = React.useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      router.refresh();
      setUpdatedAt(new Date());
    }, DEBOUNCE_MS);
  }, [router]);

  // Realtime subscription.
  React.useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      // Private topics authorize with the signed-in user's token.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "change" }, () => refresh())
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") setMode("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setMode("polling");
        });
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [topic, refresh]);

  // Fallback: focus and interval.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    // While Realtime is live, polling would only duplicate its refreshes.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && modeRef.current !== "live") refresh();
    }, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [refresh]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-3" role="status" data-live-mode={mode}>
      <span aria-hidden="true" className={`size-2 rounded-full ${mode === "live" ? "bg-brand" : "bg-ink-3"}`} />
      {mode === "live" ? "Live" : mode === "connecting" ? "Connecting" : "Auto-refresh every 30 s"}
      {/* Server and browser render different seconds; the browser's is the one that counts. */}
      <span className="tnum" suppressHydrationWarning>
        · updated {updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
      </span>
    </span>
  );
}
