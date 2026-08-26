import Link from "next/link";
import { Container, LinkButton } from "@/components/ui";

export default function AccountPage() {
  return (
    <Container className="py-10 sm:py-12">
      <section aria-labelledby="account-heading" className="mx-auto max-w-4xl text-center">
        <h1
          id="account-heading"
          className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink-1 sm:text-[42px]"
        >
          One store, the right account for you
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-[15px] leading-6 text-ink-2 sm:text-base">
          Retail customers can shop at listed prices. Approved contractors and trade customers sign in for wholesale
          pricing and purchasing tools.
        </p>

        <div className="mt-6 grid items-stretch gap-4 text-left md:grid-cols-2">
          <AccountChoice
            title="Retail customer"
            body="Shop at listed prices with faster checkout, order history, and saved equipment."
            details={[
              "No license or business required. Pick up in Newark or ship anywhere in California.",
            ]}
            href="/account/create"
            action="Create retail account"
            variant="brand-outline"
          />
          <AccountChoice
            title="Wholesale customer"
            body="Account pricing, net terms eligibility, saved lists, and repeat ordering."
            details={[
              "You’ll need: contractor license #, resale certificate, and a business EIN.",
              "Most applications approved within one business day. Will-call pickup in Newark same day once approved.",
            ]}
            href="/dealers"
            action="Apply for wholesale"
            variant="primary"
          />
        </div>

        <div className="mt-5 space-y-2 text-sm leading-5 text-ink-2">
          <p>
            Already have an account?{" "}
            <Link href="/portal/login" className="font-medium text-brand hover:text-brand-hover">
              Sign in
            </Link>
          </p>
          <p>
            Just need one part?{" "}
            <Link href="/checkout" className="font-medium text-brand hover:text-brand-hover">
              Check out as a guest
            </Link>{" "}
            — no account required.
          </p>
        </div>
      </section>
    </Container>
  );
}

function AccountChoice({
  title,
  body,
  details,
  href,
  action,
  variant,
}: {
  title: string;
  body: string;
  details: string[];
  href: string;
  action: string;
  variant: "primary" | "brand-outline";
}) {
  return (
    <article className="flex h-full flex-col rounded-(--r-md) border border-line bg-surface-1 p-6 sm:p-8 md:min-h-[360px]">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-1">{title}</h2>
      <p className="mt-3 text-[15px] leading-6 text-ink-2 sm:text-base">{body}</p>
      <div className="mt-4 space-y-3 text-[15px] leading-6 text-ink-2 sm:text-base">
        {details.map((detail) => (
          <p key={detail}>{detail}</p>
        ))}
      </div>
      <div className="mt-auto pt-4">
        <LinkButton href={href} variant={variant} size="lg" className="w-full">
          {action}
        </LinkButton>
      </div>
    </article>
  );
}
