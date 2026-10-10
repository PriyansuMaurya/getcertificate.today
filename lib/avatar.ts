import { createAvatar } from '@dicebear/core';
import { avataaarsNeutral } from '@dicebear/collection';

/**
 * Deterministic avatar markup for a seed.
 *
 * Pinned to the DiceBear 9.x line on purpose: 10.x declares `engines: node >=22`,
 * while this project pins Node 20 (.nvmrc), and 9.x needs only Node 18. That
 * also means the 9.x API (`createAvatar(style, options)`) rather than the
 * `new Avatar(...)` form in the DiceBear 10 docs.
 *
 * The "neutral" variant is used so the artwork's palette sits alongside the warm
 * paper/clay tones instead of fighting them. The background is deliberately left
 * transparent: the tile colour is supplied by the `bg-linen` class on the
 * rendering element, which keeps that brand token in one place (Tailwind)
 * instead of duplicating a hex here.
 */
export function avatarSvg(seed: string): string {
  return createAvatar(avataaarsNeutral, {
    seed,
    size: 128,
  }).toString();
}
