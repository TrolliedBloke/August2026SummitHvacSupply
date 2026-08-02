import { requireStaff } from "@/lib/backend/auth";
import { signOut } from "@/lib/backend/auth-actions";
import { allowUnauthenticatedAdmin } from "@/lib/backend/supabase-ssr";

/**
 * Staff-only gate. Fails CLOSED: anything other than a verified staff session
 * is redirected. The demo bypass must be asked for explicitly via
 * ALLOW_UNAUTHENTICATED_ADMIN=true and is inert in production, so a missing or
 * misspelled Supabase variable can no longer publish this dashboard.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let staffName: string | null = null;

  if (!allowUnauthenticatedAdmin()) {
    const profile = await requireStaff();
    staffName = profile.name;
  }

  return (
    <>
      {staffName && (
        <div className="border-b border-line bg-surface-1">
          <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-2 text-sm sm:px-6 lg:px-8">
            <span className="text-ink-3">
              Signed in as <span className="font-medium text-ink-1">{staffName}</span>
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
