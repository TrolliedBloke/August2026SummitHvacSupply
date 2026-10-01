/**
 * The trade-application state machine, mirrored from
 * dealer_application_transition_allowed() in migration 026 so the matrix is
 * testable without a database and the admin surface can disable impossible
 * actions. The database function is the enforcement; this is the projection.
 */
export type DealerApplicationStatus = "draft" | "submitted" | "needs_information" | "under_review" | "approved" | "rejected" | "withdrawn";

export const DEALER_TRANSITIONS: Record<DealerApplicationStatus, DealerApplicationStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "needs_information", "withdrawn", "rejected", "approved"],
  needs_information: ["submitted", "under_review", "withdrawn", "rejected"],
  under_review: ["approved", "rejected", "needs_information"],
  approved: [],
  rejected: ["submitted"],
  withdrawn: ["submitted"],
};

export function canTransition(from: DealerApplicationStatus, to: DealerApplicationStatus): boolean {
  return from === to || DEALER_TRANSITIONS[from].includes(to);
}

/** What the applicant is told in each state. */
export const APPLICANT_COPY: Record<DealerApplicationStatus, string> = {
  draft: "Your application is not submitted yet.",
  submitted: "Received. Staff will start the review shortly.",
  needs_information: "Paused: we need more information. Check your email.",
  under_review: "Staff are reviewing your application.",
  approved: "Approved. Sign in to see account pricing.",
  rejected: "Not approved. Contact the counter if you would like to reapply.",
  withdrawn: "Withdrawn at your request.",
};
