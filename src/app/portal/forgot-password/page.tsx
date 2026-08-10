import { Container } from "@/components/ui";
import { ForgotPasswordForm } from "@/components/password-reset-forms";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Reset your password",
  description: "Request a link to reset your Summit HVAC Supply account password.",
  path: "/portal/forgot-password",
  index: false,
});

export default function ForgotPasswordPage() {
  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-semibold text-ink-1">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          Enter the email on your account and we will send a reset link.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
      </div>
    </Container>
  );
}
