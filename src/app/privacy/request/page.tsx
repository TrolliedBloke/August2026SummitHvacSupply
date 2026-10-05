import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow } from "@/components/ui";
import { PrivacyRequestForm } from "@/components/privacy/privacy-request-form";

export const metadata: Metadata = {
  title: "Privacy Request - Know, Delete or Correct Your Information",
  description: "Ask Summit HVAC Supply what personal information it holds about you, or ask us to delete or correct it.",
};

export default function PrivacyRequestPage() {
  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Your privacy rights</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-1">Make a privacy request</h1>
        <p className="mt-3 text-ink-2">
          Ask what we hold about you, or ask us to delete or correct it. We confirm the request by email before acting, and respond within 45
          days. Some records, like orders and warranty records, are kept where the law requires it; see the{" "}
          <Link href="/privacy" className="underline underline-offset-4">privacy policy</Link>. To opt out of sale or sharing, use the{" "}
          <Link href="/privacy/opt-out" className="underline underline-offset-4">opt-out page</Link>.
        </p>
        <div className="mt-8">
          <PrivacyRequestForm />
        </div>
      </div>
    </Container>
  );
}
