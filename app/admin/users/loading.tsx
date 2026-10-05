import { Skeleton } from '@/components/ui/skeleton';

// Route-level loading state for /admin/users. Mirrors the real toolbar
// (search + sort + apply) and result rows so a slow query never shows a blank
// console.
export default function AdminUsersLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading admin users"
      className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-16 bg-linen" />
        <Skeleton className="h-9 w-40 bg-linen sm:h-10" />
        <Skeleton className="h-4 w-72 max-w-full bg-linen" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 min-w-[200px] flex-1 bg-linen" />
        <Skeleton className="h-10 w-32 bg-linen" />
        <Skeleton className="h-10 w-20 bg-linen" />
      </div>

      <Skeleton className="mt-3 h-3 w-24 bg-linen" />

      <div className="mt-6 overflow-hidden rounded-2xl border border-sandline bg-paper">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-sandline px-4 py-4 last:border-b-0"
          >
            <Skeleton className="h-4 w-40 bg-linen" />
            <Skeleton className="h-4 w-48 bg-linen" />
            <Skeleton className="ml-auto h-4 w-24 bg-linen" />
            <Skeleton className="h-7 w-20 rounded-full bg-linen" />
          </div>
        ))}
      </div>
    </div>
  );
}
