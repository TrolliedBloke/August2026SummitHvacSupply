import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

/* The shared state vocabulary: loading, empty, error, partial and success all
   render through these, on the --state-* tokens. Every tone pairs its color
   with an icon and a heading, so no state is distinguishable by color alone. */

export type StateTone = "info" | "success" | "warning" | "danger";

const TONE: Record<StateTone, { box: string; ink: string; Icon: typeof Info }> = {
  info: { box: "border-state-info-line bg-state-info", ink: "text-state-info-ink", Icon: Info },
  success: { box: "border-state-success-line bg-state-success", ink: "text-state-success-ink", Icon: CheckCircle2 },
  warning: { box: "border-state-warning-line bg-state-warning", ink: "text-state-warning-ink", Icon: AlertTriangle },
  danger: { box: "border-state-danger-line bg-state-danger", ink: "text-state-danger-ink", Icon: XCircle },
};

/**
 * A compact, inline message: a form error summary, a partial-data warning, a
 * pending-review note. `role` is the caller's decision -- an error raised by an
 * action is an alert; a passive status is not announced at all.
 */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  role,
  className = "",
  id,
  tabIndex,
}: {
  tone?: StateTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  role?: "alert" | "status";
  className?: string;
  id?: string;
  tabIndex?: number;
}) {
  const { box, ink, Icon } = TONE[tone];
  return (
    <div
      id={id}
      role={role}
      tabIndex={tabIndex}
      className={`flex items-start gap-3 rounded-(--r-sm) border px-4 py-3 text-sm leading-6 outline-none ${box} ${className}`}
    >
      <Icon size={18} strokeWidth={1.8} className={`mt-0.5 shrink-0 ${ink}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className={`font-medium ${ink}`}>{title}</p>}
        {children && <div className={title ? "mt-0.5 text-ink-2" : "text-ink-1"}>{children}</div>}
        {action && <div className="mt-2.5 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

/**
 * A full-region state: an empty result set, a failed load, a section that is
 * not available yet. Centered, with a heading the page outline can reach.
 */
export function StatePanel({
  tone = "info",
  title,
  children,
  actions,
  headingLevel = 2,
  className = "",
  role,
}: {
  tone?: StateTone;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
  role?: "alert" | "status";
}) {
  const { ink, Icon } = TONE[tone];
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      role={role}
      className={`rounded-(--r-md) border border-line bg-surface-1 px-6 py-10 text-center sm:px-10 ${className}`}
    >
      <Icon size={28} strokeWidth={1.5} className={`mx-auto ${ink}`} aria-hidden="true" />
      <Heading className="mt-3 text-lead font-medium text-ink-1">{title}</Heading>
      {children && <div className="mx-auto mt-2 max-w-prose text-sm leading-6 text-ink-2">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}

/** Neutral placeholder block. Decorative: the region announces aria-busy. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-(--r-sm) bg-skeleton ${className}`} />;
}
