import { Skeleton } from "@/components/state";

/* Catalog-shaped placeholder: sidebar, toolbar and a grid of card outlines,
   so the page does not jump when results arrive. The region announces itself
   as busy; the blocks are decorative. */
export function CatalogResultsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading products"
      className="grid gap-8 lg:grid-cols-[minmax(15rem,17.5rem)_minmax(0,1fr)]"
    >
      <div className="hidden space-y-6 lg:block">
        <Skeleton className="h-16" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9 w-3/4" />
          </div>
        ))}
      </div>
      <div className="min-w-0">
        <div className="flex flex-col gap-3 lg:hidden">
          <Skeleton className="h-16" />
          <Skeleton className="h-11" />
        </div>
        <div className="mb-5 mt-5 flex items-center justify-between lg:mt-0">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-52" />
        </div>
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-[16/10] w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading products…</span>
      </div>
    </div>
  );
}
