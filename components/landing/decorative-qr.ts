/**
 * The QR-shaped mark the landing page's certificate mocks carry.
 *
 * It is decorative, not a real code, and that is deliberate: a mock must never
 * imply a scannable credential that does not exist. The three finder squares
 * are still laid out properly - outer ring plus centre block, with a blank
 * isolation row around each - so it registers as a QR at a glance.
 *
 * Shared rather than copied so the hero's fanned background cards and its
 * centrepiece cannot drift apart.
 */

export const DECORATIVE_QR_MODULES = 21;

function isDarkModule(x: number, y: number, size: number): boolean {
  const inFinderBlock = (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8);

  if (inFinderBlock) {
    const fx = x >= size - 8 ? x - (size - 8) : x;
    const fy = y >= size - 8 ? y - (size - 8) : y;
    if (fx === 7 || fy === 7) return false; // isolation row around the finder
    const ring = Math.max(Math.abs(fx - 3), Math.abs(fy - 3));
    return ring === 3 || ring <= 1;
  }

  // Integer hash: stable between the server render and any client render, so
  // there is no hydration mismatch and no RNG at module scope.
  return (x * 9277 + y * 2663 + x * y * 31) % 100 < 46;
}

/** One path for the dark modules instead of ~200 <rect> nodes. */
export const DECORATIVE_QR_PATH = (() => {
  let d = '';
  for (let y = 0; y < DECORATIVE_QR_MODULES; y++) {
    for (let x = 0; x < DECORATIVE_QR_MODULES; x++) {
      if (isDarkModule(x, y, DECORATIVE_QR_MODULES)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
})();
