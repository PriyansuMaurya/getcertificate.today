import { Skeleton } from '@/components/ui/skeleton';

// Route-level loading state: dashboard pages stream from the server, so a
// skeleton matching the dashboard's card layout keeps slow networks from
// showing a blank page.
export default function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading dashboard"
      className="min-h-[calc(100dvh-80px)] bg-cream text-ink"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24 bg-linen" />
          <Skeleton className="h-9 w-64 bg-linen sm:h-11 sm:w-80" />
          <Skeleton className="h-4 w-72 bg-linen" />
        </div>

        <div className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8">
          <Skeleton className="h-7 w-72 bg-linen" />
          <Skeleton className="mt-2 h-4 w-full max-w-xl bg-linen" />
          <Skeleton className="mt-5 h-[50px] w-full bg-linen" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-28 bg-linen" />
                <Skeleton className="h-10 w-10 rounded-lg bg-linen" />
              </div>
              <Skeleton className="mt-4 h-10 w-16 bg-linen" />
              <Skeleton className="mt-2 h-3 w-40 bg-linen" />
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
            <Skeleton className="h-6 w-40 bg-linen" />
            <div className="mt-5 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-cream p-4">
                  <Skeleton className="h-4 w-3/4 bg-linen" />
                  <Skeleton className="mt-2 h-3 w-1/3 bg-linen" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
            <Skeleton className="h-6 w-32 bg-linen" />
            <div className="mt-5 rounded-xl bg-cream p-4">
              <Skeleton className="h-4 w-2/3 bg-linen" />
              <Skeleton className="mt-2 h-3 w-1/2 bg-linen" />
              <Skeleton className="mt-4 h-11 w-full bg-linen" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
