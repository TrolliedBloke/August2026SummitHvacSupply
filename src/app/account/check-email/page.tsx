import { MailCheck } from "lucide-react";
import { Container, LinkButton } from "@/components/ui";

export default function CheckEmailPage() {
  return <Container className="py-20"><div className="mx-auto max-w-lg rounded-(--r-md) border border-line bg-surface-1 p-8 text-center"><MailCheck className="mx-auto text-brand" size={32} /><h1 className="mt-4 font-display text-2xl font-semibold text-ink-1">Check your email</h1><p className="mt-2 text-sm leading-6 text-ink-2">Open the confirmation email from Summit, then sign in to your retail account.</p><LinkButton href="/portal/login" className="mt-6">Go to sign in</LinkButton></div></Container>;
}
