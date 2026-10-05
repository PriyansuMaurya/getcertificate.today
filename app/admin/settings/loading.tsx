// Route-level loading state for /admin/settings - a form-shaped skeleton so a
// slow settings read never shows a blank console (mirrors app/admin/loading.tsx).
export default function AdminSettingsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading admin settings"
      className="mx-auto max-w-[880px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10"
    >
      <div className="flex flex-col gap-2">
        <div className="h-3.5 w-16 animate-pulse rounded bg-linen" />
        <div className="h-9 w-48 animate-pulse rounded bg-linen" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-linen" />
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
            <div className="h-6 w-40 animate-pulse rounded bg-linen" />
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex flex-col gap-2">
                  <div className="h-3 w-28 animate-pulse rounded bg-linen" />
                  <div className="h-11 w-full animate-pulse rounded-lg bg-linen" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
