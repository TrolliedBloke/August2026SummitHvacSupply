/* Route-level loading skeleton -- neutral blocks matching the page rhythm
   (header band + card grid), so navigation feels instant instead of blank. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-12 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading page">
      <div className="h-4 w-40 animate-pulse rounded-full bg-surface-3" />
      <div className="mt-4 h-9 w-2/3 max-w-lg animate-pulse rounded-(--r-sm) bg-surface-3" />
      <div className="mt-3 h-4 w-1/2 max-w-md animate-pulse rounded-full bg-surface-2" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-(--r-md) border border-line bg-surface-1">
            <div className="aspect-[16/10] animate-pulse bg-surface-2" />
            <div className="flex flex-col gap-3 p-5">
              <div className="h-4 w-24 animate-pulse rounded-full bg-surface-2" />
              <div className="h-5 w-3/4 animate-pulse rounded-full bg-surface-3" />
              <div className="h-4 w-full animate-pulse rounded-full bg-surface-2" />
              <div className="h-9 w-32 animate-pulse rounded-(--r-sm) bg-surface-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
