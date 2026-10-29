import { requireStaff } from "@/lib/backend/auth";
import { signOut } from "@/lib/backend/auth-actions";
import { allowUnauthenticatedAdmin, createServerSupabase } from "@/lib/backend/supabase-ssr";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Staff-only gate. Fails CLOSED: anything other than a verified staff session
 * is redirected. The demo bypass must be asked for explicitly via
 * ALLOW_UNAUTHENTICATED_ADMIN=true and is inert in production, so a missing or
 * misspelled Supabase variable can no longer publish this dashboard.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let staffName: string | null = null;

  let openAlerts = 0;
  let urgentAlerts = 0;
  if (!allowUnauthenticatedAdmin()) {
    const profile = await requireStaff();
    staffName = profile.name;
    // Open alerts follow staff onto every admin page (plan 7.1).
    const supabase = await createServerSupabase();
    if (supabase) {
      const [{ count: open }, { count: urgent }] = await Promise.all([
        supabase.from("staff_alerts").select("id", { count: "exact", head: true }).is("resolved_at", null),
        supabase.from("staff_alerts").select("id", { count: "exact", head: true }).is("resolved_at", null).eq("severity", "urgent"),
      ]);
      openAlerts = open ?? 0;
      urgentAlerts = urgent ?? 0;
    }
  }

  return (
    <>
      {staffName && (
        <div className="border-b border-line bg-surface-1">
          <div className="mx-auto flex w-full max-w-[var(--page-max)] items-center justify-between px-5 py-2 text-sm sm:px-6 lg:px-8">
            <span className="flex flex-wrap items-center gap-3 text-ink-3">
              <span>
                Signed in as <span className="font-medium text-ink-1">{staffName}</span>
              </span>
              {openAlerts > 0 && (
                <Link href="/admin/alerts" className={`font-medium underline underline-offset-4 ${urgentAlerts > 0 ? "text-state-danger-ink" : "text-ink-1"}`}>
                  {openAlerts} open {openAlerts === 1 ? "alert" : "alerts"}
                  {urgentAlerts > 0 ? `, ${urgentAlerts} urgent` : ""}
                </Link>
              )}
            </span>
            <form action={signOut}>
              <button type="submit" className="font-medium text-brand hover:text-brand-hover">
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
