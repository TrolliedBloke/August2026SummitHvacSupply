import Link from "next/link";
import { Container } from "@/components/ui";
import { Notice } from "@/components/state";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { createServerSupabase } from "@/lib/backend/supabase-ssr";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Choose a new password",
  description: "Set a new password for your Summit HVAC Supply account.",
  path: "/portal/reset-password",
  index: false,
});

type RecoveryState = "valid" | "expired" | "invalid" | "missing" | "unavailable";

const STATE_COPY: Record<Exclude<RecoveryState, "valid">, { title: string; body: string }> = {
  expired: { title: "This reset link has expired or was already used", body: "Reset links work once and expire after an hour. Request a new one -- the newest link replaces any older ones." },
  invalid: { title: "This reset link could not be read", body: "It may be incomplete, or it was opened in a different browser from the one that requested it. Request a new link." },
  missing: { title: "Open the link from your email", body: "This page works from the link in your reset email. If you need one, request it below." },
  unavailable: { title: "Password reset is unavailable right now", body: "Nothing was changed. Try again shortly, or call the counter." },
};

/**
 * The recovery session is resolved BEFORE the form renders, so nobody types a
 * new password into a form whose link is already dead. Every non-valid state
 * shows a working route to request a new link and no password fields.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/portal/reset-password">) {
  const { state: reported } = await searchParams;
  let state: RecoveryState;
  if (reported === "expired" || reported === "invalid" || reported === "unavailable") {
    state = reported;
  } else {
    const supabase = await createServerSupabase();
    if (!supabase) state = "unavailable";
    else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      state = user ? "valid" : "missing";
    }
  }

  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold text-ink-1">Choose a new password</h1>
        {state === "valid" ? (
          <>
            <p className="mt-2 text-sm leading-6 text-ink-2">Updating your password signs out every device, including this one.</p>
            <div className="mt-6">
              <ResetPasswordForm />
            </div>
          </>
        ) : (
          <div className="mt-6">
            <Notice tone={state === "missing" ? "info" : "warning"} title={STATE_COPY[state].title}>
              {STATE_COPY[state].body}
            </Notice>
            <Link href="/portal/forgot-password" className="mt-5 inline-flex h-11 items-center rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink hover:bg-brand-hover">
              Request a new reset link
            </Link>
          </div>
        )}
      </div>
    </Container>
  );
}
