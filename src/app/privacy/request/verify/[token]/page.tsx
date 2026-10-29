import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { Notice } from "@/components/state";
import { privacyTokenIsValid, verifyPrivacyRequest } from "@/lib/backend/privacy-requests";

export const metadata = { title: "Confirm your privacy request", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Confirmation is a button, not the page load: mail scanners open links in
 * emails, and opening must not confirm a request on the person's behalf.
 */
export default async function VerifyPrivacyRequestPage({ params, searchParams }: PageProps<"/privacy/request/verify/[token]">) {
  const { token } = await params;
  const { done } = (await searchParams) as { done?: string };
  const valid = privacyTokenIsValid(token);

  async function confirm() {
    "use server";
    const result = await verifyPrivacyRequest(token);
    redirect(`/privacy/request/verify/${encodeURIComponent(token)}?done=${result ? "1" : "0"}`);
  }

  return (
    <Container className="py-12 lg:py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-ink-1">Confirm your privacy request</h1>
        {done === "1" ? (
          <Notice tone="success" role="status" className="mt-6" title="Confirmed">
            Thanks. We&apos;re working on your request and will email you the result within 45 days of when you sent it.
          </Notice>
        ) : !valid || done === "0" ? (
          <Notice tone="warning" className="mt-6" title="This link has expired or isn't valid">
            <Link href="/privacy/request" className="font-medium underline underline-offset-4">Make the request again</Link>, or email or call us.
          </Notice>
        ) : (
          <form action={confirm} className="mt-6 flex flex-col gap-4">
            <p className="text-ink-2">Press confirm to tell us this request is yours. If you didn&apos;t make it, close this page and nothing happens.</p>
            <button type="submit" className="h-11 self-start rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink">
              Confirm my request
            </button>
          </form>
        )}
      </div>
    </Container>
  );
}
