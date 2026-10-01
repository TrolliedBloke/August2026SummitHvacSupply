import { Container } from "@/components/ui";
import { Skeleton } from "@/components/state";
import { CatalogResultsSkeleton } from "@/components/catalog-skeleton";

/* Catalog-specific loading state, in place of the generic app skeleton: the
   hero band and the sidebar/grid shape the real page will fill. */
export default function CatalogLoading() {
  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="py-12 lg:py-14">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-4 h-9 w-full max-w-2xl" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        </Container>
      </section>
      <Container className="py-10 lg:py-12">
        <CatalogResultsSkeleton />
      </Container>
    </>
  );
}
