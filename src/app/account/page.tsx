import Link from "next/link";
import { Container, LinkButton } from "@/components/ui";

export default function AccountPage() {
  return <Container className="py-14 lg:py-20"><div className="mx-auto max-w-3xl text-center"><p className="font-mono text-xs uppercase tracking-[0.16em] text-brand">Summit accounts</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink-1">One store, the right account for you</h1><p className="mx-auto mt-4 max-w-2xl text-ink-2">Retail customers can shop at listed prices. Approved contractors and trade customers sign in for wholesale pricing and purchasing tools.</p><div className="mt-9 grid gap-4 text-left sm:grid-cols-2"><AccountChoice title="Retail customer" body="Create an account for faster checkout, order history, and saved equipment." href="/account/create" action="Create retail account" /><AccountChoice title="Wholesale customer" body="Apply for account pricing, net terms eligibility, saved lists, and repeat ordering." href="/dealers" action="Apply for wholesale" /></div><p className="mt-7 text-sm text-ink-2">Already have an account? <Link href="/portal/login" className="font-medium text-brand">Sign in</Link></p></div></Container>;
}

function AccountChoice({ title, body, href, action }: { title: string; body: string; href: string; action: string }) {
  return <article className="rounded-(--r-md) border border-line bg-surface-1 p-6"><h2 className="font-display text-xl font-semibold text-ink-1">{title}</h2><p className="mt-2 text-sm leading-6 text-ink-2">{body}</p><LinkButton href={href} className="mt-5">{action}</LinkButton></article>;
}
