"use client";

import * as React from "react";
import { branchStatus, getBranch, hoursSummary, isOpenStatus, type BranchStatus as Status } from "@/lib/branch";

/**
 * Live open/closed status for a branch, computed in the branch timezone.
 *
 * Server HTML (and the no-JavaScript page) carries the regular weekly hours,
 * which are always true, instead of a guessed "Open until 5 PM" -- a cached
 * render must never claim the counter is open on a holiday or after close. The
 * live status replaces it after mount and refreshes each minute.
 */
export function useBranchStatus(branchId = "newark"): Status | null {
  const [status, setStatus] = React.useState<Status | null>(null);
  React.useEffect(() => {
    const branch = getBranch(branchId);
    const update = () => setStatus(branchStatus(branch));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [branchId]);
  return status;
}

export function BranchStatusText({
  branchId = "newark",
  withDot = false,
  className = "",
  dotClassName = "",
}: {
  branchId?: string;
  withDot?: boolean;
  className?: string;
  dotClassName?: string;
}) {
  const status = useBranchStatus(branchId);
  const branch = getBranch(branchId);
  const label = status?.label ?? (branch ? hoursSummary(branch) : "Hours unavailable · call to confirm");
  const open = status ? isOpenStatus(status) : false;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {withDot && (
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${
            !status ? "bg-ink-4" : status.kind === "closingSoon" ? "bg-[var(--amber)]" : open ? "bg-brand" : "bg-ink-4"
          } ${dotClassName}`}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
