/**
 * Access-state classification and its projections, with no I/O, so the whole
 * authentication-versus-authorization matrix is unit-testable. The reads live
 * in lib/backend/session-access.ts.
 */

import type { PersonaRole } from "@/lib/backend/types";
import type { AccountContext } from "@/lib/commerce/price-presentation";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "needs_information"
  | "under_review"
  | "approved"
  | "rejected"
  | "withdrawn";

export type ResolvedProfile = {
  userId: string;
  email: string;
  name: string;
  role: PersonaRole;
  accountId: string | null;
};

export type BusinessAccount = { id: string; name: string; status: string; priceTier: string };

export type PortalAccess =
  | { kind: "signedOut" }
  | { kind: "ready"; profile: ResolvedProfile; account: BusinessAccount | null; application: ApplicationStatus | null }
  | { kind: "pendingApplication"; email: string; name: string | null; status: "submitted" | "under_review" }
  | { kind: "needsInformation"; email: string; name: string | null }
  | { kind: "profileMissing"; email: string }
  | { kind: "disabled"; email: string; name: string | null; reason: "profile_suspended" | "account_suspended" }
  | { kind: "unavailable" };

export type NavAccount =
  | { variant: "signedOut" }
  | { variant: "homeowner"; name: string; email: string }
  | { variant: "tradePending"; name: string; email: string }
  | { variant: "tradeApproved"; name: string; email: string; accountName: string; priceTierLabel: string }
  | { variant: "staff"; name: string; email: string }
  | { variant: "disabled"; name: string; email: string };

export const PRICE_TIER_LABEL: Record<string, string> = {
  standard: "Standard trade",
  preferred: "Preferred trade",
  volume: "Volume trade",
};

export function tierLabel(tier: string): string {
  return PRICE_TIER_LABEL[tier] ?? `${tier.charAt(0).toUpperCase()}${tier.slice(1)} tier`;
}

export const OPEN_APPLICATION: ReadonlySet<string> = new Set(["submitted", "pending_review", "under_review"]);

export function normalizeApplicationStatus(status: string | null | undefined): ApplicationStatus | null {
  if (!status) return null;
  if (status === "pending_review") return "submitted";
  return ([
    "draft", "submitted", "needs_information", "under_review", "approved", "rejected", "withdrawn",
  ] as const).find((known) => known === status) ?? null;
}

/**
 * Pure classification, separated from the reads so the full state matrix is
 * testable without a database.
 */
export function classifyAccess(input: {
  user: { id: string; email: string } | null;
  profile: (ResolvedProfile & { accessStatus?: string | null }) | null;
  account: BusinessAccount | null;
  application: ApplicationStatus | null;
}): PortalAccess {
  const { user, profile, account, application } = input;
  if (!user) return { kind: "signedOut" };
  if (!profile) {
    if (application === "needs_information") return { kind: "needsInformation", email: user.email, name: null };
    if (application && OPEN_APPLICATION.has(application)) {
      return { kind: "pendingApplication", email: user.email, name: null, status: application === "under_review" ? "under_review" : "submitted" };
    }
    return { kind: "profileMissing", email: user.email };
  }
  if (profile.accessStatus && profile.accessStatus !== "active") {
    return { kind: "disabled", email: profile.email, name: profile.name, reason: "profile_suspended" };
  }
  if (profile.role === "dealer" || profile.role === "installer") {
    if (!account) {
      if (application === "needs_information") return { kind: "needsInformation", email: profile.email, name: profile.name };
      if (application && OPEN_APPLICATION.has(application)) {
        return { kind: "pendingApplication", email: profile.email, name: profile.name, status: application === "under_review" ? "under_review" : "submitted" };
      }
      return { kind: "profileMissing", email: profile.email };
    }
    if (account.status !== "active") {
      return { kind: "disabled", email: profile.email, name: profile.name, reason: "account_suspended" };
    }
  }
  return { kind: "ready", profile, account, application };
}

/** Where each access state lands after sign-in. Never back to the login form. */
export function portalDestination(access: PortalAccess): string {
  switch (access.kind) {
    case "signedOut":
      return "/portal/login";
    case "ready":
      if (access.profile.role === "staff") return "/admin";
      if (access.profile.role === "dealer") return "/portal/dealer";
      if (access.profile.role === "installer") return "/portal/installer";
      return "/portal/homeowner";
    default:
      return "/portal/status";
  }
}

/** Paths each ready role may be returned to after sign-in. */
export function allowedNext(access: PortalAccess, next: string | null): string | null {
  if (!next || access.kind !== "ready") return null;
  const role = access.profile.role;
  if (next.startsWith("/admin")) return role === "staff" ? next : null;
  if (next.startsWith("/portal/dealer")) return role === "dealer" || role === "staff" ? next : null;
  if (next.startsWith("/portal/installer")) return role === "installer" || role === "staff" ? next : null;
  if (next.startsWith("/portal/homeowner")) return role === "homeowner" ? next : null;
  if (next.startsWith("/portal/login") || next.startsWith("/portal/reset-password")) return null;
  return next;
}

export function toNavAccount(access: PortalAccess): NavAccount {
  switch (access.kind) {
    case "signedOut":
    case "unavailable":
      return { variant: "signedOut" };
    case "pendingApplication":
    case "needsInformation":
      return { variant: "tradePending", name: access.name ?? access.email, email: access.email };
    case "profileMissing":
      return { variant: "homeowner", name: access.email, email: access.email };
    case "disabled":
      return { variant: "disabled", name: access.name ?? access.email, email: access.email };
    case "ready": {
      const { profile, account, application } = access;
      if (profile.role === "staff") return { variant: "staff", name: profile.name, email: profile.email };
      if ((profile.role === "dealer" || profile.role === "installer") && account) {
        return { variant: "tradeApproved", name: profile.name, email: profile.email, accountName: account.name, priceTierLabel: tierLabel(account.priceTier) };
      }
      if (application && (OPEN_APPLICATION.has(application) || application === "needs_information")) {
        return { variant: "tradePending", name: profile.name, email: profile.email };
      }
      return { variant: "homeowner", name: profile.name, email: profile.email };
    }
  }
}

export function toAccountContext(access: PortalAccess): AccountContext {
  const nav = toNavAccount(access);
  switch (nav.variant) {
    case "tradeApproved":
      return access.kind === "ready" && access.account
        ? { kind: "tradeApproved", accountId: access.account.id, tierLabel: nav.priceTierLabel }
        : { kind: "tradePending" };
    case "tradePending":
      return { kind: "tradePending" };
    case "staff":
      return { kind: "staff" };
    case "disabled":
      return { kind: "disabled" };
    case "homeowner":
      return { kind: "retail" };
    default:
      return { kind: "anonymous" };
  }
}
