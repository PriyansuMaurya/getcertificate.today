export default function AdminUsersLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="h-3.5 w-16 animate-pulse rounded bg-linen" />
        <div className="h-9 w-40 animate-pulse rounded bg-linen" />
        <div className="h-4 w-72 animate-pulse rounded bg-linen" />
      </div>

      <div className="mt-6 h-10 w-full max-w-md animate-pulse rounded-lg bg-linen" />

      <div className="mt-6 overflow-hidden rounded-2xl border border-sandline bg-paper">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="last:border-b-none flex items-center gap-4 border-b border-sandline px-4 py-4"
          >
            <div className="h-4 w-40 animate-pulse rounded bg-linen" />
            <div className="h-4 w-48 animate-pulse rounded bg-linen" />
            <div className="ml-auto h-4 w-24 animate-pulse rounded bg-linen" />
            <div className="h-7 w-20 animate-pulse rounded-full bg-linen" />
          </div>
        ))}
      </div>
    </div>
  );
}
