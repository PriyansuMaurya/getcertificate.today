import { cn } from '@/lib/utils';

/**
 * DiceBear avatar for a user, loaded from our own /api/avatar route.
 *
 * Always decorative: every call site renders the person's name beside it, so the
 * image is aria-hidden with an empty alt rather than repeating that name to
 * screen readers. `bg-linen` provides the tile colour behind the (transparent)
 * artwork, which is also why the class lives here and not in lib/avatar.ts.
 *
 * `priority` marks above-the-fold avatars (the dashboard header) so they load
 * eagerly; everything else stays lazy, which matters for the 25-row admin list.
 * The 128x128 attributes are the SVG's intrinsic size and give the browser an
 * aspect ratio to reserve before the image arrives, even if a call site only
 * sets one dimension via `className`.
 */
export default function Avatar({
  seed,
  className,
  priority = false,
}: {
  seed: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    // next/image cannot optimise an SVG, and this is a same-origin generated
    // image, so a plain <img> is the correct element (same exception the
    // og-image route already takes for ImageResponse).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/avatar/${encodeURIComponent(seed)}`}
      alt=""
      aria-hidden="true"
      width={128}
      height={128}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={cn('block shrink-0 bg-linen object-cover', className)}
    />
  );
}
