import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { requireStaff } from "./auth";
import { canTransition, type DealerApplicationStatus } from "@/lib/dealer-application-state";

export type DealerApplicationEvent = {
  id: string;
  fromStatus: DealerApplicationStatus | null;
  toStatus: DealerApplicationStatus;
  reason: string | null;
  actor: string;
  createdAt: string;
};

export type DealerApplicationReview = {
  id: string;
  reference: string;
  status: DealerApplicationStatus;
  reason: string | null;
  company: string;
  entityType: string | null;
  contactName: string;
  email: string;
  phone: string;
  businessType: string | null;
  licenseApplicable: boolean | null;
  licenseNumber: string | null;
  licenseState: string | null;
  taxIdLast4: string | null;
  resaleCertificateNumber: string | null;
  serviceArea: string | null;
  monthlyVolume: string | null;
  brands: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  events: DealerApplicationEvent[];
};

type DealerApplicationRow = {
  id: string;
  reference: string | null;
  status: DealerApplicationStatus;
  status_reason: string | null;
  company: string;
  entity_type: string | null;
  contact_name: string;
  email: string;
  phone: string;
  business_type: string | null;
  license_applicable: boolean | null;
  license_number: string | null;
  license_state: string | null;
  tax_id_last4: string | null;
  resale_certificate_number: string | null;
  service_area: string | null;
  monthly_volume: string | null;
  brands: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Staff queue projection. The admin layout supplies the session gate; this
 * read still uses the service role so incomplete applicant profiles cannot
 * make rows disappear from an operations queue. */
export async function listDealerApplicationsForReview(): Promise<{ connected: boolean; applications: DealerApplicationReview[] }> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return { connected: false, applications: [] };
  const { data, error } = await supabase
    .from("dealer_applications")
    .select("id, reference, status, status_reason, company, entity_type, contact_name, email, phone, business_type, license_applicable, license_number, license_state, tax_id_last4, resale_certificate_number, service_area, monthly_volume, brands, notes, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load dealer applications: ${error.message}`);
  const rows = (data ?? []) as DealerApplicationRow[];
  const ids = rows.map((row) => row.id);
  const eventsByApplication = new Map<string, DealerApplicationEvent[]>();
  if (ids.length > 0) {
    const { data: eventRows, error: eventError } = await supabase
      .from("dealer_application_events")
      .select("id, application_id, from_status, to_status, reason_code, actor, created_at")
      .in("application_id", ids)
      .order("created_at", { ascending: false });
    if (eventError) throw new Error(`Could not load dealer application history: ${eventError.message}`);
    for (const event of eventRows ?? []) {
      const applicationId = String(event.application_id);
      const list = eventsByApplication.get(applicationId) ?? [];
      list.push({
        id: String(event.id),
        fromStatus: (event.from_status as DealerApplicationStatus | null) ?? null,
        toStatus: event.to_status as DealerApplicationStatus,
        reason: (event.reason_code as string | null) ?? null,
        actor: String(event.actor),
        createdAt: String(event.created_at),
      });
      eventsByApplication.set(applicationId, list);
    }
  }
  return {
    connected: true,
    applications: rows.map((row) => ({
      id: row.id,
      reference: row.reference ?? row.id,
      status: row.status,
      reason: row.status_reason,
      company: row.company,
      entityType: row.entity_type,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      businessType: row.business_type,
      licenseApplicable: row.license_applicable,
      licenseNumber: row.license_number,
      licenseState: row.license_state,
      taxIdLast4: row.tax_id_last4,
      resaleCertificateNumber: row.resale_certificate_number,
      serviceArea: row.service_area,
      monthlyVolume: row.monthly_volume,
      brands: row.brands,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      events: eventsByApplication.get(row.id) ?? [],
    })),
  };
}

/**
 * Staff actions on trade applications. Both run inside Postgres functions
 * (migration 026): a transition is checked against the allowed matrix and
 * audited; approval creates or links the business account, sets the profile's
 * role and price tier, and records one event -- once, however many times it is
 * called.
 */
export async function transitionDealerApplication(applicationId: string, to: DealerApplicationStatus, reason: string) {
  const staff = await requireStaff();
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) throw new Error("Database unavailable");
  const { data: application, error: readError } = await supabase
    .from("dealer_applications")
    .select("status")
    .eq("id", applicationId)
    .maybeSingle();
  if (readError || !application) throw new Error(readError?.message ?? "Application not found");
  const from = application.status as DealerApplicationStatus;
  if (!canTransition(from, to)) throw new Error(`Transition ${from} -> ${to} is not allowed`);
  const { data, error } = await supabase.rpc("transition_dealer_application", {
    p_application_id: applicationId,
    p_to: to,
    p_reason: reason,
    p_actor: staff.userId,
  });
  if (error) throw new Error(error.message);
  return data as DealerApplicationStatus;
}

export async function approveDealerApplication(applicationId: string, priceTier = "standard") {
  const staff = await requireStaff();
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) throw new Error("Database unavailable");
  const { data, error } = await supabase.rpc("approve_dealer_application", {
    p_application_id: applicationId,
    p_price_tier: priceTier,
    p_actor: staff.userId,
  });
  if (error) throw new Error(error.message);
  return String(data);
}
