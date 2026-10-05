import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { sendEmail } from "./email";
import { emailShell } from "./lifecycle";
import { raiseStaffAlert, resolveStaffAlert } from "./alerts";
import { makeReference } from "@/lib/forms/result";
import { warrantyClaimSchema } from "@/lib/forms/warranty";
import { SITE } from "@/lib/site";

/**
 * Warranty claim intake (docs/LIABILITY-REMEDIATION-PLAN.md, 2.5).
 *
 * A claim is a warranty_claims row (which opens a staff task through the
 * migration 039 trigger), a staff alert email, and an acknowledgement to the
 * customer that says what Summit does -- coordinate with the manufacturer --
 * and does not promise the outcome.
 */

export class WarrantyUnavailableError extends Error {}

const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

export type WarrantyReceipt = { claimNumber: string };

export async function submitWarrantyClaim(input: unknown): Promise<WarrantyReceipt> {
  const claim = warrantyClaimSchema.parse(input);
  const supabase = createServiceRoleSupabaseClient();
  // No database means no claim: say so, never show a reference for nothing.
  if (!supabase) throw new WarrantyUnavailableError("We couldn't record the claim. Call the counter and we'll take it by phone.");

  if (claim.clientRequestId) {
    const { data } = await supabase.from("warranty_claims").select("claim_number").eq("client_request_id", claim.clientRequestId).maybeSingle();
    if (data) return { claimNumber: data.claim_number };
  }

  // Link the order only when the email matches it, so a claim can't be
  // attached to someone else's order by guessing a number.
  const orderRef = claim.orderRef?.trim().toUpperCase() || null;
  let orderId: string | null = null;
  let accountId: string | null = null;
  if (orderRef) {
    const { data: order } = await supabase.from("sales_orders").select("id, account_id, buyer_email").eq("order_number", orderRef).maybeSingle();
    if (order && order.buyer_email?.trim().toLowerCase() === claim.email.toLowerCase()) {
      orderId = order.id;
      accountId = order.account_id;
    }
  }

  const claimNumber = makeReference("W");
  const { error } = await supabase.from("warranty_claims").insert({
    claim_number: claimNumber,
    status: "open",
    issue: claim.issue,
    serial_number: claim.serialNumber,
    order_id: orderId,
    order_ref: orderRef,
    account_id: accountId,
    claimant_name: claim.name,
    claimant_email: claim.email.toLowerCase(),
    claimant_phone: claim.phone,
    product_description: claim.productDescription,
    model_number: claim.modelNumber,
    install_date: claim.installDate || null,
    installer_name: claim.installerName || null,
    installer_license: claim.installerLicense || null,
    client_request_id: claim.clientRequestId ?? null,
  });
  if (error) {
    if (error.code === "23505" && claim.clientRequestId) {
      const { data } = await supabase.from("warranty_claims").select("claim_number").eq("client_request_id", claim.clientRequestId).maybeSingle();
      if (data) return { claimNumber: data.claim_number };
    }
    throw new Error(error.message);
  }

  await raiseStaffAlert({
    kind: "warranty_claim",
    dedupeKey: `warranty:${claimNumber}`,
    subject: `Warranty claim ${claimNumber}: ${claim.modelNumber}`,
    body: [
      `${claim.name} · ${claim.email} · ${claim.phone}`,
      `${claim.productDescription}, model ${claim.modelNumber}, serial ${claim.serialNumber}`,
      `Order: ${orderRef ?? "not given"}${orderRef && !orderId ? " (not matched to this email; check it)" : ""}`,
      `Installed: ${claim.installDate || "not given"} by ${claim.installerName || "not given"}${claim.installerLicense ? `, license ${claim.installerLicense}` : ""}`,
      "",
      claim.issue,
      "",
      "Open Admin → Returns & warranty to work it.",
    ].join("\n"),
    relatedType: "warranty_claim",
  });

  await sendEmail(
    claim.email,
    `Warranty claim ${claimNumber} received`,
    emailShell(`<h2 style="font-size:20px;margin:8px 0">We've received your warranty claim.</h2>
      <p style="line-height:1.6">Claim <strong>${claimNumber}</strong>: ${escape(claim.productDescription)}, model ${escape(claim.modelNumber)}, serial ${escape(claim.serialNumber)}.</p>
      <p style="line-height:1.6"><strong>Please reply to this email with photos</strong> of the unit's data label (model and serial), the problem, and any error code on the display or board. The manufacturer usually asks for them.</p>
      <p style="line-height:1.6">What happens next: the manufacturer decides warranty cover, not Summit. We check the details with you, open the claim with the manufacturer, and keep you posted. Cover usually depends on the equipment being installed by a licensed contractor and registered with the manufacturer, so have the installer's details and any registration confirmation ready.</p>
      <p style="line-height:1.6">Questions? Reply to this email or call ${SITE.phone}.</p>`),
    { kind: "warranty_claim_received", relatedType: "warranty_claim", relatedId: claimNumber }
  );

  return { claimNumber };
}

/* Staff ----------------------------------------------------------------------------------------- */

export type WarrantyRow = {
  id: string;
  claim_number: string;
  status: "open" | "waiting" | "approved" | "closed";
  issue: string;
  serial_number: string | null;
  created_at: string;
  order_ref: string | null;
  order_id: string | null;
  claimant_name: string | null;
  claimant_email: string | null;
  claimant_phone: string | null;
  product_description: string | null;
  model_number: string | null;
  install_date: string | null;
  installer_name: string | null;
  installer_license: string | null;
  staff_notes: string | null;
};

type Staff = { userId: string; name: string };

function db() {
  const client = createServiceRoleSupabaseClient();
  if (!client) throw new WarrantyUnavailableError("The database is not configured.");
  return client;
}

export async function listWarrantyClaims(): Promise<WarrantyRow[]> {
  const { data } = await db()
    .from("warranty_claims")
    .select("id, claim_number, status, issue, serial_number, created_at, order_ref, order_id, claimant_name, claimant_email, claimant_phone, product_description, model_number, install_date, installer_name, installer_license, staff_notes")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as WarrantyRow[];
}

export type WarrantyUpdate =
  | { action: "note"; note: string }
  | { action: "request_info"; message: string }
  | { action: "with_manufacturer"; note: string }
  | { action: "close"; resolution: string };

export async function updateWarrantyClaim(claimId: string, staff: Staff, update: WarrantyUpdate): Promise<string> {
  const { data } = await db().from("warranty_claims").select("id, claim_number, status, claimant_email, staff_notes").eq("id", claimId).maybeSingle();
  if (!data) throw new WarrantyUnavailableError("Claim not found.");
  const stamp = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const text = update.action === "note" ? update.note : update.action === "request_info" ? `Asked the customer: ${update.message}` : update.action === "with_manufacturer" ? `Sent to the manufacturer. ${update.note}` : `Closed. ${update.resolution}`;
  const notes = [data.staff_notes, `${stamp} ${staff.name}: ${text}`].filter(Boolean).join("\n").slice(-4000);
  const status = update.action === "request_info" ? "waiting" : update.action === "with_manufacturer" ? "approved" : update.action === "close" ? "closed" : data.status;
  await db().from("warranty_claims").update({ status, staff_notes: notes }).eq("id", data.id);
  await db().from("activity_log").insert({ actor_profile_id: staff.userId || null, event: `warranty_${update.action}`, entity_type: "warranty_claims", entity_id: data.id });

  const ref = escape(data.claim_number);
  if (data.claimant_email && update.action !== "note") {
    const body =
      update.action === "request_info"
        ? `<h2 style="font-size:20px;margin:8px 0">We need a little more for claim ${ref}.</h2><p style="line-height:1.6">${escape(update.message).replace(/\n/g, "<br>")}</p><p style="line-height:1.6">Reply to this email with the details or photos.</p>`
        : update.action === "with_manufacturer"
          ? `<h2 style="font-size:20px;margin:8px 0">Claim ${ref} is with the manufacturer.</h2><p style="line-height:1.6">${escape(update.note)}</p><p style="line-height:1.6">We'll email you when they respond.</p>`
          : `<h2 style="font-size:20px;margin:8px 0">Update on claim ${ref}</h2><p style="line-height:1.6">${escape(update.resolution)}</p><p style="line-height:1.6">Questions? Reply to this email or call ${SITE.phone}.</p>`;
    await sendEmail(data.claimant_email, `Warranty claim ${data.claim_number}`, emailShell(body), { kind: "warranty_update", relatedType: "warranty_claim", relatedId: data.claim_number });
  }
  if (update.action !== "note") await resolveStaffAlert(`warranty:${data.claim_number}`, staff.name);
  return data.claim_number;
}
