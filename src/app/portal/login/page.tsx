import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import * as React from "react";
import {
  Lock,
  Tag,
  History,
  RefreshCw,
  Boxes,
  FileText,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { Container, Chip } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { getSessionProfile } from "@/lib/backend/auth";
import { SITE } from "@/lib/site";

const PORTAL_FEATURES = [
  { icon: Tag, label: "Account-specific pricing" },
  { icon: History, label: "Order history" },
  { icon: RefreshCw, label: "One-click reorder" },
  { icon: Boxes, label: "Real-time inventory" },
  { icon: FileText, label: "Invoices & statements" },
  { icon: ShieldAlert, label: "Warranty claims" },
] as const;

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const profile = await getSessionProfile();

  // Already signed in: send them where they belong.
  if (profile) {
    // `next` is attacker-controllable via the query string and this fires on a
    // bare GET, so it must be constrained to a site-relative path before use.
    redirect(profile.role === "staff" ? safeNextPath(next, "/admin") : "/portal");
  }

  const target = safeNextPath(next, "/portal");

  return (
    <Container className="py-14 lg:py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        {/* Sign-in card */}
        <div className="mx-auto w-full max-w-sm">
          <div className="inline-flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-(--r-md) bg-brand-tint text-brand">
              <Lock size={20} />
            </span>
            <Chip tone="copper">Customer account</Chip>
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink-1">
            Sign in
          </h1>
          <p className="mt-2 text-ink-2">
            Access orders, saved equipment, account details, and the tools available for your account type.
          </p>

          <LoginForm next={target} />

          <p className="mt-4 text-center text-xs text-ink-4">
            Need an account?{" "}
            <Link href="/account/create" className="text-ink-2">Create a retail account</Link>
            {" · "}<Link href="/dealers" className="text-ink-2">Apply for wholesale</Link>
            {" · "}Call{" "}
            <a href={SITE.phoneHref} className="text-ink-2">{SITE.phone}</a>
          </p>
        </div>

        {/* What's inside */}
        <div className="rounded-(--r-lg) border border-line bg-surface-2/50 p-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-3">
            What dealers will get inside
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {PORTAL_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.label}
                  className="flex items-center gap-3 rounded-(--r-md) border border-line bg-surface-1 px-4 py-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">
                    <Icon size={17} />
                  </span>
                  <span className="text-sm font-medium text-ink-1">{f.label}</span>
                </div>
              );
            })}
          </div>
          <Link href="/dealers" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover">Apply for wholesale <ArrowRight size={15} /></Link>
        </div>
      </div>
    </Container>
  );
}
