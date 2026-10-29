import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, FileQuestion, PauseCircle, UserX } from "lucide-react";
import { Container } from "@/components/ui";
import { portalDestination, resolvePortalAccess, type PortalAccess } from "@/lib/backend/session-access";
import { signOut } from "@/lib/backend/auth-actions";
import { SITE } from "@/lib/site";

export const metadata = { title: "Account status", robots: { index: false, follow: false } };
// Per-person: never prerender or cache, even when built without auth keys.
export const dynamic = "force-dynamic";

type Explained = Exclude<PortalAccess, { kind: "signedOut" } | { kind: "ready" }>;

const COPY: Record<Explained["kind"], { icon: React.ReactNode; title: string; body: string; action: { href: string; label: string } }> = {
  pendingApplication: {
    icon: <Clock size={28} aria-hidden="true" />,
    title: "Your trade application is under review",
    body: "You are signed in. Staff review applications in the order they arrive and email you the decision. Until then you can shop at list prices and send quote requests.",
    action: { href: "/products", label: "Shop at list prices" },
  },
  needsInformation: {
    icon: <FileQuestion size={28} aria-hidden="true" />,
    title: "We need a little more information",
    body: "Your trade application is paused until we hear from you. Check your email for what is missing, or contact the counter.",
    action: { href: "/contact?topic=account", label: "Contact the counter" },
  },
  profileMissing: {
    icon: <UserX size={28} aria-hidden="true" />,
    title: "Your sign-in worked, but your account is not set up yet",
    body: "We could not find an account profile linked to this sign-in. This usually means a trade account is still being linked by staff. Nothing is wrong with your password.",
    action: { href: "/contact?topic=account", label: "Ask the counter to link it" },
  },
  disabled: {
    icon: <PauseCircle size={28} aria-hidden="true" />,
    title: "Access to this account is paused",
    body: "Ordering and account pricing are unavailable while the account is paused. Contact the counter to resolve it.",
    action: { href: "/contact?topic=account", label: "Contact the counter" },
  },
  unavailable: {
    icon: <PauseCircle size={28} aria-hidden="true" />,
    title: "We could not load your account just now",
    body: "Your session is fine; the account service did not answer. Try again in a moment.",
    action: { href: "/portal", label: "Try again" },
  },
};

/** Signed-in explanations for every access state that is not "ready". */
export default async function PortalStatusPage() {
  const access = await resolvePortalAccess();
  if (access.kind === "signedOut") redirect("/portal/login?next=/portal");
  if (access.kind === "ready") redirect(portalDestination(access));
  const copy = COPY[access.kind];
  const email = "email" in access ? access.email : null;

  return (
    <Container className="py-14 lg:py-20">
      <div className="mx-auto max-w-xl rounded-(--r-md) border border-line bg-surface-1 p-8">
        <span className="text-ink-2">{copy.icon}</span>
        <h1 className="mt-4 text-2xl font-semibold text-ink-1">{copy.title}</h1>
        {email && <p className="mt-1 text-sm text-ink-3">Signed in as {email}</p>}
        <p className="mt-3 text-sm leading-6 text-ink-2">{copy.body}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={copy.action.href} className="inline-flex h-11 items-center rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink hover:bg-brand-hover">
            {copy.action.label}
          </Link>
          <a href={SITE.phoneHref} className="inline-flex h-11 items-center rounded-(--r-sm) border border-line-strong px-5 text-sm font-medium text-ink-1 hover:bg-surface-2">
            Call {SITE.phone}
          </a>
          <form action={signOut}>
            <button type="submit" className="inline-flex min-h-11 items-center text-sm text-ink-2 underline underline-offset-4">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </Container>
  );
}
