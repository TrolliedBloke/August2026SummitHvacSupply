import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Container } from "@/components/ui";
import { Notice } from "@/components/state";
import { ResendConfirmation } from "@/components/resend-confirmation";
import { pendingSignupEmail } from "@/lib/backend/pending-signup";
import { maskEmail } from "@/lib/forms/auth";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Confirm your email",
  description: "Confirm your Summit HVAC Supply account email.",
  path: "/account/check-email",
  index: false,
});

/**
 * The waiting state between signup and a confirmed account. The address comes
 * from a signed, HttpOnly cookie -- never the URL -- so refreshing, Back and
 * Forward keep working without exposing it. A link that failed in the
 * callback arrives here with ?status= and gets its own recovery path.
 */
export default async function CheckEmailPage({ searchParams }: PageProps<"/account/check-email">) {
  const { status } = await searchParams;
  const email = await pendingSignupEmail();
  const failed = status === "expired" || status === "invalid" || status === "unavailable";

  return (
    <Container className="py-16 lg:py-20">
      <div className="mx-auto max-w-lg rounded-(--r-md) border border-line bg-surface-1 p-8">
        <MailCheck className="text-brand" size={32} aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-ink-1">{failed ? "That confirmation link did not work" : "Check your email"}</h1>
        {failed ? (
          <Notice tone="warning" className="mt-4" title={status === "expired" ? "The link has expired or was already used" : status === "unavailable" ? "We could not confirm it right now" : "The link is incomplete or was opened in a different browser"}>
            {email ? "Send a fresh link below." : "Sign in if you already confirmed, or create the account again to get a new link."}
          </Notice>
        ) : (
          <p className="mt-2 text-sm leading-6 text-ink-2">
            {email ? (
              <>
                We sent a confirmation link to <span className="font-medium text-ink-1">{maskEmail(email)}</span>. Open it on this
                device to finish creating your account.
              </>
            ) : (
              <>Open the confirmation link we emailed you to finish creating your account.</>
            )}{" "}
            If that address already has an account, sign in or reset your password instead.
          </p>
        )}
        {email && <ResendConfirmation />}
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/portal/login" className="inline-flex min-h-11 items-center font-medium text-ink-1 underline underline-offset-4">
            Go to sign in
          </Link>
          <Link href="/portal/forgot-password" className="inline-flex min-h-11 items-center text-ink-2 underline underline-offset-4">
            Reset password
          </Link>
        </div>
      </div>
    </Container>
  );
}
