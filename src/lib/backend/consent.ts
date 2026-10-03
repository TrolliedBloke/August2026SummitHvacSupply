import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { PRIVACY } from "@/content/legal/privacy";
import { readReportPages } from "./report-pages";

/**
 * Marketing consent and ad-sharing opt-outs (migration 032). Every marketing
 * send and every ad-audience export reads this module; a transactional send (a
 * receipt, a shortlist someone asked for) does not.
 *
 * Same conventions as the rest of lib/backend: Supabase when configured, an
 * in-memory fallback otherwise, and normalized lowercase emails throughout.
 */

export type ConsentSource = "finder" | "checkout" | "account" | "homeowner_request" | "staff" | "opt_out_form";

export type ConsentRecord = {
  email: string;
  source: ConsentSource;
  noticeVersion: string;
  consentedAt: string | null;
  withdrawnAt: string | null;
  adSharingOptOutAt: string | null;
  unsubscribeToken: string;
};

const mem = new Map<string, ConsentRecord>();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function noticeVersion(): string {
  return `privacy-${PRIVACY.version}`;
}

/** Whether a record permits marketing email right now. */
export function canMarket(record: ConsentRecord | null): boolean {
  return Boolean(record?.consentedAt) && !record?.withdrawnAt;
}

/** Whether a record permits ad-platform sharing, given the person consented. */
export function canShareForAds(record: ConsentRecord | null): boolean {
  return canMarket(record) && !record?.adSharingOptOutAt;
}

type Row = {
  email: string;
  source: ConsentSource;
  notice_version: string;
  consented_at: string | null;
  withdrawn_at: string | null;
  ad_sharing_opt_out_at: string | null;
  unsubscribe_token: string;
};

function fromRow(row: Row): ConsentRecord {
  return {
    email: row.email,
    source: row.source,
    noticeVersion: row.notice_version,
    consentedAt: row.consented_at,
    withdrawnAt: row.withdrawn_at,
    adSharingOptOutAt: row.ad_sharing_opt_out_at,
    unsubscribeToken: row.unsubscribe_token,
  };
}

const COLUMNS = "email, source, notice_version, consented_at, withdrawn_at, ad_sharing_opt_out_at, unsubscribe_token";

export async function getConsent(rawEmail: string): Promise<ConsentRecord | null> {
  const email = normalizeEmail(rawEmail);
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from("marketing_consents").select(COLUMNS).eq("email", email).eq("channel", "email").maybeSingle();
    if (!error) return data ? fromRow(data as Row) : null;
    throw new Error("Could not read marketing consent.");
  }
  return mem.get(email) ?? null;
}

/**
 * Write a consent change without clobbering the fields it does not touch: an
 * opt-out must not erase a consent, and a fresh consent must not erase an
 * opt-out. The database merges atomically; memory is only for keyless previews.
 */
async function upsertConsent(rawEmail: string, source: ConsentSource, patch: Partial<Omit<ConsentRecord, "email" | "unsubscribeToken">>): Promise<ConsentRecord> {
  const email = normalizeEmail(rawEmail);
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("record_marketing_preference", {
      p_email: email, p_source: source, p_notice_version: noticeVersion(),
      p_opt_out: patch.adSharingOptOutAt !== undefined,
    }).single();
    if (error || !data) throw new Error("Could not save marketing preference.");
    return fromRow(data as Row);
  }
  const existing = await getConsent(email);
  const merged: ConsentRecord = {
    email,
    source: existing?.source ?? source,
    noticeVersion: patch.noticeVersion ?? existing?.noticeVersion ?? noticeVersion(),
    consentedAt: patch.consentedAt !== undefined ? patch.consentedAt : existing?.consentedAt ?? null,
    withdrawnAt: patch.withdrawnAt !== undefined ? patch.withdrawnAt : existing?.withdrawnAt ?? null,
    adSharingOptOutAt: patch.adSharingOptOutAt !== undefined ? patch.adSharingOptOutAt : existing?.adSharingOptOutAt ?? null,
    unsubscribeToken: existing?.unsubscribeToken ?? crypto.randomUUID(),
  };
  mem.set(email, merged);
  return merged;
}

/** The person ticked an unchecked opt-in box. Records the notice version they saw. */
export async function recordMarketingConsent(email: string, source: ConsentSource): Promise<ConsentRecord> {
  return upsertConsent(email, source, { consentedAt: new Date().toISOString(), withdrawnAt: null, noticeVersion: noticeVersion() });
}

/** "Do not sell or share", by email. Never touches marketing consent. */
export async function recordAdSharingOptOut(email: string): Promise<ConsentRecord> {
  return upsertConsent(email, "opt_out_form", { adSharingOptOutAt: new Date().toISOString() });
}

/** Unsubscribe link. Returns the email so the caller can stop open sequences. */
export async function withdrawByToken(token: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("marketing_consents")
      .update({ withdrawn_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .select("email");
    if (!error) return data && data.length > 0 ? String(data[0].email) : null;
    throw new Error("Could not save unsubscribe preference.");
  }
  for (const record of mem.values()) {
    if (record.unsubscribeToken === token) {
      record.withdrawnAt = new Date().toISOString();
      return record.email;
    }
  }
  return null;
}

/** All records that currently permit ad sharing (audience exports only). */
export async function listAdShareableConsents(): Promise<ConsentRecord[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const data = await readReportPages((from, to) => supabase
      .from("marketing_consents")
      .select(COLUMNS)
      .eq("channel", "email")
      .not("consented_at", "is", null)
      .is("withdrawn_at", null)
      .is("ad_sharing_opt_out_at", null)
      .order("id").range(from, to));
    return (data as Row[]).map(fromRow);
  }
  return [...mem.values()].filter(canShareForAds);
}

/** Global Privacy Control: the browser's standing opt-out of sale and sharing. */
export function gpcRequested(headers: Headers): boolean {
  return headers.get("sec-gpc")?.trim() === "1";
}
