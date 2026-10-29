import Link from "next/link";
import { Container } from "@/components/ui";
import { GuestReturnLinkForm } from "@/components/returns/guest-return-link-form";

export const metadata = { title: "Start a return", robots: { index: false, follow: true } };

export default function StartGuestReturnPage() {
  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-ink-1">Start a return</h1>
        <p className="mt-2 text-sm text-ink-2">
          Enter your order number and the email you ordered with. We&apos;ll email you a link to choose the items. Have an account?{" "}
          <Link href="/portal/returns/new" className="font-medium underline underline-offset-4">
            Start it from your orders
          </Link>
          .
        </p>
        <div className="mt-6">
          <GuestReturnLinkForm />
        </div>
        <p className="mt-6 text-sm text-ink-3">
          Installed equipment that stopped working?{" "}
          <Link href="/warranty" className="font-medium text-ink-1 underline underline-offset-4">
            File a warranty claim
          </Link>{" "}
          instead. See the <Link href="/returns" className="underline underline-offset-4">returns policy</Link> for the terms.
        </p>
      </div>
    </Container>
  );
}
