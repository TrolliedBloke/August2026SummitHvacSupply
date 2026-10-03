import { saveReferralPreferences } from "@/app/portal/dealer/actions";
import { createServiceRoleSupabaseClient } from "@/lib/backend/supabase";

export async function InstallerReferrals({ accountId, notice }: { accountId: string | null; notice?: string }) {
  const db = createServiceRoleSupabaseClient();
  if (!db || !accountId) return null;
  const { data, error } = await db.from("accounts").select("license_verified_at, accepts_homeowner_referrals, referral_zips, referral_paused_at").eq("id", accountId).eq("status", "active").maybeSingle();
  if (error || !data?.license_verified_at) return null;
  const message = notice === "saved" ? "Referral preferences saved." : notice === "invalid" ? "Enter up to 100 five-digit ZIP codes, separated by commas or spaces. At least one is required to accept referrals." : notice === "unavailable" ? "Preferences could not be saved. Please contact the counter." : null;
  return <section className="mt-8 rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7" aria-labelledby="installer-referrals">
    <h2 id="installer-referrals" className="text-xl font-medium">Homeowner introductions</h2>
    <p className="mt-2 text-sm text-ink-2">Tell the counter where you take installation work. Staff will coordinate introductions with homeowners.</p>
    {message && <p className="mt-3 text-sm" role={notice === "saved" ? "status" : "alert"}>{message}</p>}
    <form action={saveReferralPreferences} className="mt-5 grid max-w-xl gap-4">
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="accepts" value="yes" defaultChecked={data.accepts_homeowner_referrals} className="mt-1" />Accept homeowner introductions</label>
      <label className="text-sm">Service ZIP codes<textarea name="zips" rows={3} maxLength={700} defaultValue={(data.referral_zips as string[]).join(", ")} placeholder="94560, 94538" className="mt-2 block w-full rounded-(--r-sm) border border-line px-3 py-2" /></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="paused" value="yes" defaultChecked={Boolean(data.referral_paused_at)} className="mt-1" />Pause introductions while my schedule is full</label>
      <button type="submit" className="min-h-11 justify-self-start rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">Save preferences</button>
    </form>
  </section>;
}
