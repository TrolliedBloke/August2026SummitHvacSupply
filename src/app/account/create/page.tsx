import Link from "next/link";
import { RetailSignupForm } from "@/components/retail-signup-form";
import { Container } from "@/components/ui";

export default function CreateAccountPage() {
  return <Container className="py-14 lg:py-20"><div className="mx-auto max-w-md"><p className="font-mono text-xs uppercase tracking-[0.16em] text-brand">Retail account</p><h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-1">Create your Summit account</h1><p className="mt-2 text-sm leading-6 text-ink-2">Shop listed retail prices and keep your orders in one place. Trade customer? <Link href="/dealers" className="font-medium text-brand">Apply for wholesale instead.</Link></p><RetailSignupForm /><p className="mt-4 text-center text-sm text-ink-2">Already registered? <Link href="/portal/login" className="font-medium text-brand">Sign in</Link></p></div></Container>;
}
