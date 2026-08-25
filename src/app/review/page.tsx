import { Container, Eyebrow } from "@/components/ui";
import { ReviewForm } from "@/components/review-form";
import { getStorefrontSku } from "@/lib/storefront/catalog";

/**
 * Landing page for the day-14 review request email. noindex: it is reached
 * from a personal email with an order number attached and has no business in
 * search results.
 */
export const metadata = {
  title: "Write a review",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  searchParams,
}: PageProps<"/review">) {
  const params = await searchParams;
  const skuParam = typeof params.sku === "string" ? params.sku : undefined;
  const orderParam = typeof params.order === "string" ? params.order : undefined;
  // Resolve the title from the catalog rather than trusting the URL, so a
  // hand-edited ?sku= cannot put arbitrary text on the page.
  const sku = skuParam ? getStorefrontSku(skuParam) : undefined;

  return (
    <Container className="py-10 lg:py-14">
      <div className="max-w-2xl">
        <Eyebrow>Your order</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
          Tell the next buyer what actually happened.
        </h1>
        <p className="mt-3 text-ink-2">
          We publish reviews as written — including the unflattering ones — after
          a person reads them. Nothing is edited, and nothing is offered in
          exchange for a good one.
        </p>
        <div className="mt-8">
          <ReviewForm
            skuId={sku?.id}
            productTitle={sku?.title}
            orderNumber={orderParam}
          />
        </div>
      </div>
    </Container>
  );
}
