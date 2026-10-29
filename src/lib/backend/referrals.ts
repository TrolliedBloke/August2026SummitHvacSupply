import "server-only";
import { requireStaff } from "./auth";
import { createServiceRoleSupabaseClient } from "./supabase";
import { readReportPages } from "./report-pages";
import { attributeReferralOrders } from "@/lib/referrals";

export async function referralQueue() {
  await requireStaff("/admin/referrals");
  const db = createServiceRoleSupabaseClient();
  if (!db) return null;
  const [requests, installers, referrals, orders] = await Promise.all([
    readReportPages((from, to) => db.from("homeowner_requests").select("id, reference, name, email, phone, zip, home_type, existing_ducts, timeline, notes, status, consent_to_contact").order("created_at", { ascending: false }).order("id").range(from, to)),
    readReportPages((from, to) => db.from("accounts").select("id, name, referral_zips").eq("type", "dealer").eq("status", "active").eq("accepts_homeowner_referrals", true).not("license_verified_at", "is", null).is("referral_paused_at", null).order("id").range(from, to)),
    readReportPages((from, to) => db.from("referrals").select("id, homeowner_request_id, account_id, introduced_at, outcome, notes, accounts(name)").order("introduced_at", { ascending: false }).order("id").range(from, to)),
    readReportPages((from, to) => db.from("sales_orders").select("id, account_id, created_at, total").eq("paid", true).order("id").range(from, to)),
  ]);
  return { requests, installers, referrals, attribution: attributeReferralOrders(referrals, orders) };
}
