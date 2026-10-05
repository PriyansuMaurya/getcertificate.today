import { Skeleton } from '@/components/ui/skeleton';

// Route-level loading state: the overview runs nine parallel queries, so a
// skeleton matching its card/panel layout keeps slow networks from showing a
// blank page (mirrors app/dashboard/loading.tsx).
export default function AdminLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading admin overview"
      className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16 bg-linen" />
        <Skeleton className="h-9 w-56 bg-linen sm:h-11 sm:w-72" />
        <Skeleton className="h-4 w-80 max-w-full bg-linen" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32 bg-linen" />
              <Skeleton className="h-10 w-10 rounded-lg bg-linen" />
            </div>
            <Skeleton className="mt-4 h-10 w-20 bg-linen" />
            <Skeleton className="mt-2 h-3 w-48 max-w-full bg-linen" />
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
            <Skeleton className="h-6 w-40 bg-linen" />
            <div className="mt-5 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-xl bg-cream p-4">
                  <Skeleton className="h-4 w-3/4 bg-linen" />
                  <Skeleton className="mt-2 h-3 w-1/2 bg-linen" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
