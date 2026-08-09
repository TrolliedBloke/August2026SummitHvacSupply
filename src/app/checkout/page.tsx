import { getSessionProfile } from "@/lib/backend/auth";
import { Container } from "@/components/ui";
import { CheckoutClient, type PriceMap } from "@/components/checkout-client";
import { getStorefrontSkus } from "@/lib/storefront/catalog";
import { SITE } from "@/lib/site";
import { redirect } from "next/navigation";

export const metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  if (!getStorefrontSkus().some((sku) => sku.purchaseEligible)) redirect("/quote");
  const profile = await getSessionProfile();
  const trade = profile?.role === "dealer" || profile?.role === "installer" || profile?.role === "staff";

  const prices: PriceMap = Object.fromEntries(
    getStorefrontSkus().map((sku) => [sku.id, { dealer: sku.dealerPrice, retail: sku.msrp }])
  );

  return (
    <Container className="py-10 lg:py-14">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
        Checkout
      </h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Choose how you want it: free will-call pickup in Newark, local jobsite
        delivery, or freight. {trade ? "Your Pro pricing and net terms are applied." : "Pay securely by card."}
      </p>
      {/* The cart lives in localStorage, so the order summary genuinely cannot
          be server-rendered. With JS off the client never mounts and the
          skeleton would sit there forever — this gives that user a way to
          finish the order instead of a dead page. */}
      <noscript>
        <div className="mt-8 rounded-(--r-md) border border-line bg-surface-2/60 px-5 py-4">
          <p className="font-medium text-ink-1">Checkout needs JavaScript</p>
          <p className="mt-1 text-ink-2">
            Your cart is stored in your browser, so we can&apos;t show it with
            JavaScript disabled. Call{" "}
            <a href={SITE.phoneHref} className="text-ink-1 underline underline-offset-4">
              {SITE.phone}
            </a>{" "}
            and we&apos;ll take the order over the phone, or pick up at{" "}
            {SITE.address.full}. {SITE.hours.split("·")[0].trim()}.
          </p>
        </div>
      </noscript>

      <CheckoutClient prices={prices} trade={trade} accountName={profile?.name ?? null} />
    </Container>
  );
}
