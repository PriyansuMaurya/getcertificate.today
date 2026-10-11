'use client';

import Image from 'next/image';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * The hero's flow: the two ends of the idea, drawn as the things they stand for -
 * a YouTube mark and a certificate - with the headline held between them and one
 * line travelling from the first to the second.
 *
 * One composition at every width, rather than a flanking scene above `xl` and a
 * separate row below it. What differs by width is only what has to: the line's
 * own path, the weight of its stroke, and the size and position of the marks.
 * The marks, the milestones, the particles, the sparkles and the timeline are one
 * drawing, and this file owns all of it; `HeroLearningFlow.tsx` owns the layer it
 * is drawn into.
 *
 * The two regimes, and why there are two paths rather than one scaled one:
 *
 * - From `xl`, the layer reaches into the page margin either side of the headline
 *   (see the insets in HeroLearningFlow.tsx), the marks flank the type, and the
 *   layer is roughly seven times wider than it is tall.
 * - Below `xl`, there is no page margin to reach into: the layer cancels the
 *   hero's own horizontal padding, so the marks sit at the page's own edge - and
 *   at the column's edge once the page is wider than the container's 1180px cap.
 *   They take the corners the centred lines leave free - the video mark on the
 *   left at 40% of the layer, the certificate on the right at 80% - and the layer
 *   is under two times wider than it is tall.
 *
 * The SVG scales with `preserveAspectRatio="none"`, so a path drawn in the same
 * viewBox reads at whatever height the layer has. That is what lets the desktop
 * path and the narrow path both stay inside one 1200x200 box: under a non-uniform
 * scale the endpoints' *fractions* are exactly preserved, so a path whose ends sit
 * at the marks' own fractions ends at the marks at every width. The curve between
 * them is not preserved - a swoop traced for a 6:1 box would arrive at a phone as
 * a steep dive - which is the whole reason the narrow regime gets its own cubic,
 * traced between its own two endpoints.
 *
 * Neither end is drawn here. The video end is the YouTube logo as CSS, taken from
 * a supplied stylesheet and scaled to this mark's box (`.yt-logo` in globals.css);
 * the certificate end is a supplied render, shipped as a transparent WebP and
 * placed with `object-contain` so a 3:2 artwork can sit in the square box its
 * stencil used.
 *
 * Motion carries the entrance and CSS carries the ambients, which is a division
 * rather than a mixture. The ambient cycles - the two floats, the halo, the
 * sparkles, and the line's own weight - already exist in globals.css, already
 * honour `prefers-reduced-motion`, and already step with the layer, so this file
 * does not restate any of them. What is new is a timeline: a mark, a draw, five
 * milestones and a certificate that have to happen in an order. A stylesheet
 * cannot express that without a set of coordinated delays and no way to keep them
 * honest, which is exactly what Motion is for.
 *
 * The sequence: the mark arrives, the line draws left to right, a milestone lights
 * as the draw reaches it, and - only once the line has joined it - the certificate
 * turns out of a tilt and comes forward until it faces the page straight on. That
 * order is the argument the pair makes: a video becomes a certificate, so the
 * connection has to arrive before the certificate does, and the reveal is caused by
 * the join rather than merely near it. Everything after that first pass is ambient
 * and restrained, because the certificate stage below owns the hero's one bold
 * moment and this sits behind the type as its echo.
 *
 * Nothing here animates an SVG transform. Motion builds an SVG transform into a
 * `transform` attribute with an origin it has to be told about (via
 * `originX`/`originY`), so everything it turns, moves or scales is ordinary HTML.
 * The one animated element inside the drawing dodges that the same way: the draw is
 * a `clip-path` on the block wrapping the SVG rather than anything on the path
 * itself, which is why the line is never rotated, scaled or translated - it is only
 * ever revealed.
 */

/**
 * Tailwind's `xl`, and the same breakpoint the layer's own insets step at in
 * HeroLearningFlow.tsx. These two are a pair: change one and the other has to
 * follow, or the layer reaches into the page margin while the drawing still uses
 * the narrow path (or the reverse) - a line that stops short of both marks.
 *
 * It is also what keeps one geometry set mounted instead of two. Each set carries
 * five milestone arrivals, and the wide one carries four infinite particle rises on
 * top of that, and a `display:none` subtree still runs Motion's rAF loop, so
 * rendering both and hiding one by breakpoint would animate the set nobody can see
 * for as long as the page is open.
 */
const WIDE = '(min-width: 1280px)';

/**
 * The timeline, in seconds. `WIPE_DELAY` is the hero's own load sequence - the
 * copy settles over roughly the first second (see `hero-settle` in globals.css) -
 * so the flourish starts once there is a headline for it to sit behind rather
 * than under a headline that is still fading in.
 *
 * `DRAW` is read three times: as the wipe's duration, as the scale the milestones
 * are timed against, and as the moment the certificate's reveal hangs off. The
 * wipe's clip moves at a constant rate in `x`, so at
 * `WIPE_DELAY + DRAW * at` the reveal edge is at the fraction `at` across the
 * layer - which is why each milestone's `at` below is simply its own `left`
 * expressed as a fraction. That is the whole coupling: a milestone is lit by the
 * arrival of the edge, not by a separately tuned delay.
 */
const WIPE_DELAY = 0.55;
const DRAW = 1.7;
// The mark's arrival starts a hair before the draw, so the line leaves a mark that
// is still settling rather than waiting for one that has finished - the line
// originates there, and a gap between the two would read as two events.
const MARK_DELAY = 0.5;
// The line has to reach the certificate before the certificate is revealed, which
// is the whole point of the pair: the arrival is caused by the connection rather
// than merely near it. So this is the end of the draw itself rather than an offset
// tuned against it - move the draw and the reveal follows, because they are the
// same number.
const CERT_DELAY = WIPE_DELAY + DRAW;
// The reveal's own length, and the one value here that is free rather than derived:
// the draw decides *when* the certificate arrives, not how long the turn takes.
const REVEAL = 0.95;

/** The hero's own settle curve, so the two motions read as one page. */
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

/**
 * The connection, twice: one line for the wide layer and one for the narrow one.
 * Both are a single line from the video mark's middle to the certificate's,
 * because a connection between two things is one line - and a single line can
 * carry the weight a pair of lanes would have had to share.
 *
 * `TRAIL_WIDE` is the original: the mark's middle sits at x=24 of 1200, the
 * certificate's at 1176, and the line dips well below its start because a shallow
 * arc across a 1200-unit layer flattens into a straight line once it is scaled.
 * At `xl` the layer is 1252 units wide and 173 tall, so those two endpoints are
 * fractions of 2%/24% and 98%/82% - and the marks are placed to the same two
 * fractions, which is what makes the line join them rather than stop near them.
 *
 * `TRAIL_NARROW` is the same idea traced for the layer below `xl`, where the marks
 * are at different fractions of a much taller box: the video mark's middle at 3%
 * across and 40% down, the certificate's at 96% and 80%. Its dip is shallower in
 * viewBox units than the wide path's on purpose - the narrow layer is much closer
 * to square, so a 116-unit dip would arrive as a dive across the type instead of
 * as a swoop behind it.
 *
 * The `y` fractions are exact at every narrow width, because both marks are
 * centred on them with a half-height offset. The `x` ones are not exact: a mark's
 * centre sits half its own pixel width in from the layer's edge, and that is a
 * different fraction at 390 than at 1279 - 16px of 390, 24px of 1180. So the ends
 * are placed to land *inside* the marks, which is what joining two things at every
 * width takes, and the wide pair, whose layer is only ever rendered near one size,
 * still lands on their exact centres.
 */
const TRAIL_WIDE = 'M 24 48 C 320 168 660 108 1176 164';
const TRAIL_NARROW = 'M 36 80 C 330 168 700 92 1152 160';

/**
 * Five points on each line, as percentages of the layer with the fraction of the
 * reveal that reaches each. The points are traced from the cubic itself - at
 * t = 0.10, 0.28, 0.48, 0.68 and 0.88, computed rather than eyeballed, because a
 * milestone that lights a little before or after the edge arrives reads as unlit
 * rather than as unlit-yet. `at` is each point's own `left`, and that is not a
 * coincidence: the draw's edge crosses the layer linearly in `x`, so a point's
 * share of the width *is* the share of the reveal that has reached it.
 *
 * Re-trace these if a trail ever moves; nothing here can tell you that it did.
 */
const MILESTONES_WIDE = [
  { key: 'w1', left: '9.5%', top: '39.4%', at: 0.095 },
  { key: 'w2', left: '23.8%', top: '56.5%', at: 0.238 },
  { key: 'w3', left: '41.3%', top: '64.6%', at: 0.413 },
  { key: 'w4', left: '60.9%', top: '68.1%', at: 0.609 },
  { key: 'w5', left: '83.1%', top: '74.2%', at: 0.831 },
];

const MILESTONES_NARROW = [
  { key: 'n1', left: '10.5%', top: '50.9%', at: 0.105 },
  { key: 'n2', left: '25.1%', top: '61.1%', at: 0.251 },
  { key: 'n3', left: '42.7%', top: '63.7%', at: 0.427 },
  { key: 'n4', left: '61.9%', top: '64.4%', at: 0.619 },
  { key: 'n5', left: '82.7%', top: '70.6%', at: 0.827 },
];

/** The wide trail at t = 0.17, 0.33, 0.52 and 0.74, for the particles' slow rise off
 * it. Only the wide layer has a set: see the particle render below for why the
 * narrow one has none. */
const PARTICLES = [
  { key: 'p1', left: '15%', top: '47.5%' },
  { key: 'p2', left: '28%', top: '59.3%' },
  { key: 'p3', left: '45%', top: '65.4%' },
  { key: 'p4', left: '67.2%', top: '69.3%' },
];

/** The reference's six sparkles, unmoved: the `✦` the hero badge uses, placed in
 * the bands the headline leaves free rather than on a glyph. They keep the
 * `hero-flow-sparkle` cycle, so their offsets are fractions of 3.6s, and they step
 * down a size on a phone, where the same 13px mark would be nearly a quarter of
 * the line's length. */
const SPARKLES = [
  { key: 'l-1', place: 'left-[1%] top-[7%]', size: 'text-[11px] xl:text-[13px]', delay: '-0.4s' },
  {
    key: 'l-2',
    place: 'left-[2.5%] bottom-[18%]',
    size: 'text-[9px] xl:text-[10px]',
    delay: '-2.1s',
  },
  { key: 'm-1', place: 'left-[38%] top-[2%]', size: 'text-[8px] xl:text-[9px]', delay: '-1.2s' },
  {
    key: 'm-2',
    place: 'left-[58%] bottom-[1%]',
    size: 'text-[10px] xl:text-[11px]',
    delay: '-2.8s',
  },
  { key: 'r-1', place: 'right-[1%] top-[12%]', size: 'text-[10px] xl:text-[12px]', delay: '-1.6s' },
  {
    key: 'r-2',
    place: 'right-[3%] bottom-[26%]',
    size: 'text-[7px] xl:text-[8px]',
    delay: '-3.3s',
  },
];

export default function HeroFlowScene() {
  const reduce = useReducedMotion();
  // Which geometry set is mounted, not whether the scene renders at all: both
  // regimes draw at every width, and this only picks which path and which traced
  // points go with the layer's current shape. The first render is always `false`,
  // so the server HTML and the first client render agree.
  const [wide, setWide] = useState(false);
  // The reveal's clock, as a number rather than as an animation between two
  // `clip-path` strings. A string value only animates if Motion's complex-string
  // mixer accepts both ends, and a snap there would silently delete the entire
  // entrance with no type error anywhere to catch it - so the amount revealed is
  // what is animated and the inset is built from it. That also lets the finished
  // clip be `none`: no clip, no stacking context, and nothing to unwind
  // afterwards, which is one mechanism instead of two.
  const revealed = useMotionValue(reduce ? 100 : 0);
  // `>= 100` rather than `=== 100`: the value only lands on exactly 100 because
  // the effect below asks for it, and an equality test would leave the clip on if
  // a frame ever stopped a tenth of a percent short.
  const clipPath = useTransform(revealed, (p) => (p >= 100 ? 'none' : `inset(0 ${100 - p}% 0 0)`));

  useEffect(() => {
    const mql = window.matchMedia(WIDE);
    const sync = () => setWide(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  // The draw itself. `wide` is a dependency rather than a value read inside, and
  // that is the point: crossing the breakpoint swaps the path's `d` and every
  // milestone's `key`, so the new drawing has to be drawn rather than found
  // already complete. On the first desktop paint it also means this runs twice -
  // the media query resolves one render after mount - and the second run restarts
  // a draw that had barely a millisecond on it, which is what the reset below is
  // for.
  //
  // What does not restart is the certificate: its reveal is a mount-only
  // `initial`, so after a flip the line redraws under a sheet that is already in
  // place. The arrive-then-reveal order therefore holds on the first pass only,
  // which is the right trade - the reveal is the entrance, not something to replay
  // because a window was dragged across 1280.
  useEffect(() => {
    if (reduce) {
      revealed.set(100);
      return;
    }
    revealed.set(0);
    const controls = animate(revealed, 100, {
      duration: DRAW,
      delay: WIPE_DELAY,
      ease: 'linear',
    });
    return () => controls.stop();
  }, [reduce, revealed, wide]);

  const trail = wide ? TRAIL_WIDE : TRAIL_NARROW;
  const milestones = wide ? MILESTONES_WIDE : MILESTONES_NARROW;

  return (
    <>
      {/* Soft light behind the video mark, sized and placed to the mark it sits
          under: the negative margin is half the halo's own height and the
          negative offset is what puts its centre over the mark's, so at every
          narrow width the two are concentric - 44px over a 32px mark on a phone,
          64px over 48px at `md`, 80px over 48px from `xl`, which is the size it
          has always been there. The base pair is deliberately not the desktop
          ratio: a 56px halo on a 32px mark would have run a further 4px past the
          layer's edge, and the glow is the one thing here that is clipped rather
          than hidden. The certificate end has none: the artwork carries its own,
          and a glow can only be aimed once the artwork says where its seal
          sits. */}
      <span className="hero-flow-halo absolute -left-1.5 top-[40%] -mt-[1.375rem] h-11 w-11 rounded-full bg-[radial-gradient(closest-side,rgba(198,140,86,0.4),rgba(198,140,86,0))] opacity-50 blur-[12px] md:-left-2 md:-mt-8 md:h-16 md:w-16 xl:-left-4 xl:top-[3%] xl:mt-0 xl:h-20 xl:w-20" />
      {/* The line itself, and the draw that puts it there.

          The line is solid, and a solid path has no "drawn" state to interpolate
          to either - an animated `stroke-dashoffset` would slide a pattern along
          it, not extend it - so the draw is a hard edge crossing the line, which is
          also what a hand drawing this connection would leave behind. The edge is
          driven by a numeric motion value rather than by Motion interpolating two
          `inset()` strings (see `revealed` in the component), which is what makes
          the draw something that cannot silently degrade into a snap: a number
          animates or it does not, and this one has no way not to. It is a paint
          operation rather than a composited one, and it is the only such thing in
          the file: it runs once, for 1.7s, over one stroke's worth of pixels. The
          payoff is that the milestones can be timed against it exactly, which
          nothing else could have told them, and that the certificate's reveal can
          begin as the edge closes on the line's far end rather than on a delay
          tuned to look about right.

          The clip sits on a wrapper rather than on the layer so the marks, the
          halos and the sparkles are outside it and are not wiped as the edge
          crosses them. */}
      <motion.div className="absolute inset-0" style={{ clipPath }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="heroFlowStroke" x1="0" y1="0" x2="1" y2="0.35">
              <stop offset="0" stopColor="#9E6C3E" />
              <stop offset="0.55" stopColor="#AB7443" />
              <stop offset="1" stopColor="#B0722C" />
            </linearGradient>
          </defs>
          {/* One stroke, and its weight comes from `.hero-flow-line` rather than
              from this attribute: at 2.5px the line reads as a drawn connection
              against the wide layer, and the same 2.5px against a 390px-wide one
              reads as a bar laid across the composition. The attribute repeats the
              path's own base - 2.5 for the wide layer, 1.6 for the narrow one - as
              the fallback for an engine that never applies the stylesheet; the CSS
              steps it to 1.8px at `md`, 2px at `lg` and 2.5px at `xl`. Either way
              it stays under the certificate's own mark and over the milestones',
              so the two ends still outweigh the connection between them.

              The gradient is the long lane's, crisped rather than replaced: a flat
              1.0 alpha over a deepened ramp, #9E6C3E/#AB7443/#B0722C, which
              measures about 1.9-2.0:1 against the cream where the translucent ramp
              it started as sat nearer 1.2-1.6:1. The stroke therefore holds one
              weight of colour along its whole length instead of fading through its
              middle, and what still shifts across it is saturation rather than
              brightness - #B0722C at the certificate end is the most saturated - so
              it warms toward the certificate without the alpha doing any of that
              work. */}
          <path
            d={trail}
            className="hero-flow-line"
            stroke="url(#heroFlowStroke)"
            strokeWidth={wide ? '2.5' : '1.6'}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </motion.div>

      {/* The milestones. Each is lit by the reveal reaching its own fraction of
          the layer, so the order and the spacing come from the path rather than
          from a hand-tuned list - re-trace the trail and only the coordinates
          above need to change.

          Each keeps a slow breath after it lights, nested inside the one-shot
          span rather than folded into it: a single animation cannot both arrive
          once and repeat forever, and re-running the arrival every cycle would
          read as the journey restarting. The breath itself is `xl` and up, and the
          reason is the size rather than the machinery: on a phone the trail runs
          behind the headline, so these read as a lit seam in the type's leading
          rather than as marks with room to breathe around them, and five endless
          Motion loops for a 5px dot nobody can see is the same trade the particle
          set is dropped under. */}
      {milestones.map((m) => (
        <motion.span
          key={m.key}
          className="absolute block h-4 w-4 xl:h-5 xl:w-5"
          style={{ left: m.left, top: m.top, x: '-50%', y: '-50%' }}
          initial={reduce ? false : { opacity: 0, scale: 0.35 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduce ? 0 : 0.6,
            delay: reduce ? 0 : WIPE_DELAY + DRAW * m.at,
            ease: EASE,
          }}
        >
          {!reduce && wide && (
            <motion.span
              className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(194,128,63,0.5),rgba(194,128,63,0))] blur-[5px]"
              animate={{ opacity: [0.7, 1, 0.7], scale: [0.92, 1.08, 0.92] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
            />
          )}
          <span className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C2803F] bg-cream md:h-[6px] md:w-[6px] xl:h-[7px] xl:w-[7px]" />
        </motion.span>
      ))}

      {/* Particles: the dust the journey kicks up, not a second journey. Four
          small rises off the trail, spaced along it and staggered so they are
          never all in the air together, and dropped entirely under reduced
          motion - a particle carries no meaning on its own.

          Dropped below `xl` as well, and for the size rather than only for the
          cost: at 4px, behind a headline whose glyphs cover most of the trail,
          they are not visible enough to be worth four endless Motion loops on the
          device least able to spend them. The narrow layer keeps the line, the two
          marks, their arrival and the milestones - everything that states the
          connection. */}
      {!reduce &&
        wide &&
        PARTICLES.map((p, i) => (
          <motion.span
            key={p.key}
            className="absolute block h-1 w-1 rounded-full bg-[#C2803F]"
            style={{ left: p.left, top: p.top }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.85, 0], scale: [0.5, 1, 0.4], y: [1, -7, -14] }}
            transition={{
              duration: 5.4,
              times: [0, 0.4, 1],
              repeat: Infinity,
              repeatDelay: 0.6,
              delay: WIPE_DELAY + DRAW * 0.5 + i * 1.1,
              ease: 'easeOut',
            }}
          />
        ))}

      {/* The video half. A positioner, then three nested spans with one job each:
          the positioner puts the mark where the line begins, the outer span owns
          the layer's existing float, the middle one owns the arrival, and the
          inner one owns the ambient turn. They have to be separate elements
          because each animates `transform` and an element has only one - stacked,
          the float, the arrival and the turn compose instead of overwriting each
          other.

          The positioner is what lets one set of marks serve both regimes: below
          `xl` it centres the mark on the 40% the narrow trail's first endpoint
          also uses, from `xl` it holds it at the wide layer's own 10% with no
          offset. Its size is what `--yt-w` in globals.css follows - the logo sets
          its own width there, so the box only centres it.

          32px on a phone rather than 36, and that is the one number here chosen by
          measurement rather than by eye: at 390 the headline's first line reaches
          to 34.8px from the layer's edge, so a 36px mark flush to that edge would
          sit 1.2px over the type. 32 leaves 2.8px, and at that size the four
          pixels are invisible.

          The turn moves nothing on `y`: `.hero-flow-float-a` is the only owner of
          the mark's vertical travel, and the two of them would beat against each
          other (the class floats on 7.5s, anything here on 9s) to put six pixels
          of bob on a mark designed for three.

          `rotateZ` rests at -7deg rather than 0: the tilt is composition, not
          motion, so reduced motion keeps it while dropping everything that moves.
          The turn is what is deliberately small - seven degrees of yaw and five
          of pitch over nine seconds - because a mark at this size reads as
          wobbling rather than floating if it goes further. */}
      <span className="absolute left-0 top-[40%] -translate-y-1/2 xl:top-[10%] xl:translate-y-0">
        <span className="hero-flow-float-a block h-8 w-8 md:h-12 md:w-12 2xl:h-14 2xl:w-14">
          <motion.span
            className="block h-full w-full"
            initial={reduce ? false : { opacity: 0, scale: 0.84 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : MARK_DELAY, ease: EASE }}
          >
            <motion.span
              className="flex h-full w-full items-center justify-center drop-shadow-[0_5px_10px_rgba(107,96,89,0.22)]"
              style={{ transformPerspective: 900 }}
              animate={
                reduce
                  ? { rotateZ: -7 }
                  : {
                      rotateZ: [-7, -5.2, -7],
                      rotateY: [0, 7, 0],
                      rotateX: [0, -5, 0],
                    }
              }
              transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="yt-logo" />
            </motion.span>
          </motion.span>
        </span>
      </span>

      {/* The verified half, and the one element in this scene that is artwork
          rather than a drawing.

          Its footprint is the pair it replaces rather than either one of them: an
          80px halo and a 48px stencil were one region of the layer, so the
          artwork takes a single box anchored where the glow was, and the box steps
          with the layer - 52px on a phone, 64px at `md`, 80px from `xl`. The
          positioner centres it on the 80% the narrow trail's last endpoint uses;
          from `xl` it returns to the authored corner (-1rem, -0.5rem) with no
          offset. `object-contain` because the render is 3:2 inside a square box -
          the slack is the box's, exactly as it is for the logo on the other side.

          The narrow box is also the one place where a mark shares a band with the
          type: at 320 the headline's fourth line reaches 4.4px past the sheet's
          left edge. Whether that is a collision is decided by the ink rather than
          by the inline box - the box overlaps the artwork by 9px, the ink stops
          0.9px above it - and that gap belongs to the copy rather than to the
          layout: a descender on that line would close it, the same way the 32px
          mark on the other side is sized to the 34.8px line at 390.

          The arrival is a 3D reveal, and the whole of it is one transform on one
          element: the sheet starts turned away from the page - yawed, pitched
          back and rolled - and recessed behind the layer, then turns toward the
          viewer as it comes forward, so the turn and the approach are a single
          gesture rather than a rotation followed by a dolly. `z` is what makes it
          an arrival rather than a fade: at `transformPerspective: 900` - the same
          camera the video mark's turn uses - the recess alone is roughly a sixth
          off the resting size, which is why the explicit scale is only 0.94. The
          recess does the growing and the scale is a small second term: the two
          multiply, so the sheet starts a touch under 0.8 of its size and gains
          about a quarter across the reveal. A larger scale on top of this recess
          would read as two arrivals rather than one.

          It finishes front-facing, every axis at zero. The pair is composed on a
          tilt - see the logo on the other side - but a certificate presented to
          the reader is the wrong thing to leave cocked, and resolving that tilt
          is the reveal's whole job. There is no ambient turn afterwards for the
          same reason: a mark that has just faced the page should not start yawing
          again. What carries it afterwards is the float on the wrapper, which is
          the layer's shared ambient cycle and moves on `y` only.

          The layered shadows sit on the image (`.hero-flow-cert-shadow` in
          globals.css) and are static: this reveal animates transform and opacity
          and nothing else, so the motion itself never leaves the compositor. The
          filter is the one honest caveat - a silhouette shadow on a
          perspective-animated element can be re-rasterised as the raster scale
          changes, so the blur is not literally free; at this size that is a
          handful of repaints on a small box, which is why the depth is worth it.

          No `y` travel anywhere in here: the positioner's offset and the
          wrapper's float own that axis, and a second owner would beat against it. */}
      <span className="absolute right-0 top-[80%] -translate-y-1/2 xl:bottom-[-0.5rem] xl:right-[-1rem] xl:top-auto xl:translate-y-0">
        <span
          className="hero-flow-float-b block h-[3.25rem] w-[3.25rem] md:h-16 md:w-16 xl:h-20 xl:w-20 2xl:h-24 2xl:w-24"
          style={{ animationDelay: '-1.2s' }}
        >
          <motion.span
            className="block h-full w-full"
            style={{ transformPerspective: 900 }}
            initial={
              reduce
                ? false
                : { opacity: 0, z: -160, scale: 0.94, rotateX: 14, rotateY: -24, rotateZ: 10 }
            }
            animate={{ opacity: 1, z: 0, scale: 1, rotateX: 0, rotateY: 0, rotateZ: 0 }}
            transition={{
              duration: reduce ? 0 : REVEAL,
              delay: reduce ? 0 : CERT_DELAY,
              ease: EASE,
              // One curve for every value, opacity included, and that is a decision
              // rather than a default: the sheet is then exactly as opaque as it is
              // far along its turn, so it materialises with the approach instead of
              // before or after it. A flatter or later opacity curve - the obvious
              // "improvement" - leaves a half-transparent card already sitting in
              // place, which reads as a fade-in on the spot.
            }}
          >
            <Image
              src="/figma/certificate-gold.webp"
              alt=""
              width={768}
              height={512}
              sizes="(min-width: 1536px) 96px, (min-width: 1280px) 80px, (min-width: 768px) 64px, 52px"
              className="hero-flow-cert-shadow h-full w-full object-contain"
            />
          </motion.span>
        </span>
      </span>

      {SPARKLES.map(({ key, place, size, delay }) => (
        <span
          key={key}
          className={`hero-flow-sparkle absolute leading-none text-terracotta/60 ${place} ${size}`}
          style={{ animationDelay: delay }}
        >
          ✦
        </span>
      ))}
    </>
  );
}
