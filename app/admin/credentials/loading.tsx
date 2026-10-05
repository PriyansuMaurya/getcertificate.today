export default function AdminCredentialsLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="h-3.5 w-16 animate-pulse rounded bg-linen" />
        <div className="h-9 w-56 animate-pulse rounded bg-linen" />
        <div className="h-4 w-80 animate-pulse rounded bg-linen" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="h-10 min-w-[200px] flex-1 animate-pulse rounded-lg bg-linen" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-linen" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-linen" />
        <div className="h-10 w-20 animate-pulse rounded-lg bg-linen" />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-sandline bg-paper">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="last:border-b-none flex items-center gap-4 border-b border-sandline px-4 py-4"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-linen" />
            <div className="h-4 w-40 animate-pulse rounded bg-linen" />
            <div className="h-4 w-44 animate-pulse rounded bg-linen" />
            <div className="ml-auto h-7 w-20 animate-pulse rounded-full bg-linen" />
          </div>
        ))}
      </div>
    </div>
  );
}
