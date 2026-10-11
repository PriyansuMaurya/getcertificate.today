import { Avatar, Style } from '@dicebear/core';
import clay from '@dicebear/styles/clay.json' with { type: 'json' };

/**
 * Deterministic avatar markup for a seed.
 *
 * DiceBear 10 ships avatar styles as JSON definitions in `@dicebear/styles`
 * (wrapped here in a `Style`) rather than the per-style packages that the 9.x
 * `@dicebear/collection` re-exported. This is why the project's Node baseline
 * is 22: `@dicebear/core@10` declares `engines.node >= 22`.
 *
 * The "clay" style paints its own cream background by default; we clear it
 * (`backgroundColor: []`) so the SVG stays transparent and the tile colour
 * keeps coming from the `bg-linen` class on the rendering element, exactly as
 * it did for the previous style.
 */
const clayStyle = new Style(clay);

export function avatarSvg(seed: string): string {
  return new Avatar(clayStyle, {
    seed,
    size: 128,
    backgroundColor: [],
  }).toString();
}
