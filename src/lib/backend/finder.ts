import "server-only";
import { cookies } from "next/headers";
import { createServiceRoleSupabaseClient } from "./supabase";
import { readSignedValue, signValue } from "./signed-cookie";
import { recordEvent } from "./events";
import { sendRequiredEmail } from "./email";
import { emailShell, startPlanningSeries, stopPlanningSeries } from "./lifecycle";
import { gpcRequested, normalizeEmail, recordAdSharingOptOut, recordMarketingConsent } from "./consent";
import { getStorefrontSkus, type StorefrontSku } from "@/lib/storefront/catalog";
import { applyLiveInventoryAll, getLiveInventory } from "@/lib/storefront/live-inventory";
import { recommend, resultSkuIds, type FinderResult } from "@/lib/finder/recommend";
import {
  finderSubmissionSchema,
  prunedAnswers,
  segmentFor,
  tagsFor,
  type FinderSegment,
  type FinderSubmission,
} from "@/lib/finder/questions";
import { shortlistBody, shortlistSubject } from "@/lib/finder/email";
import { SITE } from "@/lib/site";
import { browserOptedOut } from "@/lib/privacy-cookies";

/**
 * Finder sessions (migration 031). A completed run is stored with its
 * answers, derived segment and the SKUs it showed. The browser holds only the
 * session id, in a signed HttpOnly cookie; the shortlist email and the
 * installer handoff look the session up rather than trusting anything posted.
 */

/** Signed, HttpOnly cookie holding the visitor's latest finder session id. */
export const FINDER_COOKIE = "summit_finder";
const FINDER_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Call from a Route Handler only: cookies can't be set while rendering. */
export async function rememberFinderSession(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(FINDER_COOKIE, signValue(id, FINDER_COOKIE_TTL_SECONDS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: FINDER_COOKIE_TTL_SECONDS,
  });
}

/** The session id from the signed cookie, or null when absent, tampered or expired. */
export async function finderSessionIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return readSignedValue(jar.get(FINDER_COOKIE)?.value);
}

type StoredSession = {
  id: string;
  submission: FinderSubmission;
  segment: FinderSegment;
  email: string | null;
  homeownerRequestId: string | null;
};

// Keyless local preview must share sessions between separately bundled routes.
const previewStore = globalThis as typeof globalThis & { summitFinderSessions?: Map<string, StoredSession> };
const mem = previewStore.summitFinderSessions ??= new Map<string, StoredSession>();

async function liveSkus(): Promise<StorefrontSku[]> {
  return applyLiveInventoryAll(getStorefrontSkus(), await getLiveInventory().catch(() => ({})));
}

/** Validate, normalize to the branch actually asked, and compute results. */
export function parseSubmission(input: unknown): FinderSubmission {
  const raw = finderSubmissionSchema.parse(input);
  const answers = prunedAnswers(raw.path, raw.answers as Record<string, string | undefined>);
  return finderSubmissionSchema.parse({ path: raw.path, answers });
}

export async function runFinder(input: unknown): Promise<{ id: string; segment: FinderSegment; result: FinderResult }> {
  const submission = parseSubmission(input);
  const result = recommend(submission, await liveSkus());
  const segment = segmentFor(submission);
  const id = crypto.randomUUID();
  const supabase = createServiceRoleSupabaseClient();
  let stored = false;
  if (supabase) {
    const { error } = await supabase.from("finder_sessions").insert({
      id,
      path: submission.path,
      answers: submission.answers,
      segment,
      tags: tagsFor(submission),
      result_skus: resultSkuIds(result),
      completed_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save finder session.");
    else stored = true;
  }
  if (!stored) {
    mem.set(id, { id, submission, segment, email: null, homeownerRequestId: null });
    if (mem.size > 2000) mem.delete(mem.keys().next().value as string);
  }
  await recordEvent("finder_completed", "/finder", {
    path: submission.path,
    segment,
    options: result.path === "homeowner" ? result.options.length : result.items.length,
  });
  return { id, segment, result };
}

export async function getFinderSession(id: string): Promise<StoredSession | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("finder_sessions")
      .select("id, path, answers, segment, email, homeowner_request_id")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) {
      return {
        id: String(data.id),
        submission: finderSubmissionSchema.parse({ path: data.path, answers: data.answers }),
        segment: data.segment as FinderSegment,
        email: (data.email as string | null) ?? null,
        homeownerRequestId: (data.homeowner_request_id as string | null) ?? null,
      };
    }
  }
  return mem.get(id) ?? null;
}

export type ShortlistReceipt = { sent: true; marketing: boolean };

/**
 * Email the shortlist. Transactional: the person asked for this one message.
 * Marketing consent is a separate, unchecked box; only when it is ticked does
 * the homeowner planning series start. A Global Privacy Control signal on the
 * request is recorded as an ad-sharing opt-out against the address.
 */
export async function sendShortlist(
  sessionId: string,
  rawEmail: string,
  marketingOptIn: boolean,
  headers: Headers
): Promise<ShortlistReceipt> {
  const session = await getFinderSession(sessionId);
  if (!session) throw new FinderSessionMissing();
  const email = normalizeEmail(rawEmail);
  const result = recommend(session.submission, await liveSkus());
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? SITE.origin;

  if (gpcRequested(headers) || browserOptedOut(headers.get("cookie") ?? "", false)) await recordAdSharingOptOut(email);
  let unsubscribeUrl: string | undefined;
  if (marketingOptIn) {
    const consent = await recordMarketingConsent(email, "finder");
    unsubscribeUrl = `${origin}/api/unsubscribe?kind=marketing&token=${consent.unsubscribeToken}`;
  }

  await sendRequiredEmail(email, shortlistSubject(result), emailShell(`${shortlistBody(result, origin, SITE.phone)}
    <p style="margin-top: 20px; font-size: 12px; color: dimgray;">You received this because you asked for your finder results on ${escapeOrigin(origin)}.${
      marketingOptIn ? " You also asked for occasional planning emails; every one has an unsubscribe link." : " It is a one-time message. You are not subscribed to anything."
    }</p>`, unsubscribeUrl), undefined, { kind: "finder_shortlist", relatedType: "finder" });

  if (marketingOptIn && !session.homeownerRequestId && (session.segment === "homeowner_active" || session.segment === "homeowner_researching")) {
    await startPlanningSeries(email, session.id, session.segment);
  }

  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    await supabase
      .from("finder_sessions")
      .update({ email, shortlist_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", session.id);
  }
  const memSession = mem.get(session.id);
  if (memSession) memSession.email = email;

  await recordEvent("finder_shortlist_emailed", "/finder", { path: session.submission.path });
  if (marketingOptIn) await recordEvent("finder_marketing_optin", "/finder", { segment: session.segment });
  return { sent: true, marketing: marketingOptIn };
}

function escapeOrigin(origin: string): string {
  return origin.replace(/[<>"']/g, "");
}

export class FinderSessionMissing extends Error {
  constructor() {
    super("finder session not found");
  }
}

/**
 * A homeowner request that came from the finder: link the two, stop the
 * planning series (a person talking to an installer does not need nudging),
 * and count it in the funnel.
 */
export async function linkHomeownerRequest(sessionId: string, requestId: string, email: string): Promise<void> {
  const session = await getFinderSession(sessionId);
  if (!session || session.submission.path !== "homeowner") return;
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    await supabase
      .from("finder_sessions")
      .update({ homeowner_request_id: requestId, email: session.email ?? normalizeEmail(email), updated_at: new Date().toISOString() })
      .eq("id", session.id);
  }
  const memSession = mem.get(session.id);
  if (memSession) memSession.homeownerRequestId = requestId;
  await stopPlanningSeries(normalizeEmail(email), "requested_installer");
  await recordEvent("finder_installer_requested", "/homeowners", { segment: session.segment });
}
