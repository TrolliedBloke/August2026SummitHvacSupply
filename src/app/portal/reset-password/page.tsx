import { Container } from "@/components/ui";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Choose a new password",
  description: "Set a new password for your Summit HVAC Supply account.",
  path: "/portal/reset-password",
  index: false,
});

/** Reached from the emailed recovery link; Supabase establishes the recovery
 *  session before this renders. */
export default function ResetPasswordPage() {
  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-semibold text-ink-1">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          Setting a new password signs out any other session using the old one.
        </p>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </div>
    </Container>
  );
}
