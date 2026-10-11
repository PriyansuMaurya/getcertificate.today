'use client';

import Image from 'next/image';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * The desktop half of the hero's flow (see HeroLearningFlow.tsx): the two ends of
 * the idea, shown as the things they stand for - a YouTube mark on the left, a
 * certificate on the right - joined by a journey that draws itself between them.
 *
 * Neither end is drawn here any more. The video end is the YouTube logo as CSS,
 * taken from a supplied stylesheet and scaled to this mark's box (`.yt-logo` in
 * globals.css); the certificate end is a supplied render, shipped as a
 * transparent WebP and placed with `object-contain` so a 3:2 artwork can sit in
 * the square box its stencil used. Both replace stencils - a frame with a
 * triangle in it, and a stitched medal - which at 48px survived as shapes but not
 * as meanings, the conclusion the compact row had already reached at 32px. The
 * composition is otherwise untouched: the one line takes the pair of lanes' place,
 * and the positions, the one remaining halo and the same six sparkles all stay, so
 * the headline is still the centre of the idea.
 *
 * Motion carries the entrance and CSS carries the ambients, which is a division
 * rather than a mixture. The ambient cycles already exist in globals.css, already
 * honour `prefers-reduced-motion`, and are already reused by the compact row -
 * so every floated, dashed, sparkling or breathing element below keeps its class
 * and this file does not restate any of them. What is new is a timeline: a mark,
 * a draw, five milestones and a certificate that have to happen in an order. A
 * stylesheet cannot express that without a set of coordinated delays and no way
 * to keep them honest, which is exactly what Motion is for.
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
 *
 * The scene mounts only at the breakpoint its layer is shown at. Its parent is
 * `hidden` below `xl`, and a `display:none` subtree still runs Motion's rAF loop -
 * without the gate, a phone would animate five milestones, four particles, two
 * marks and a clip it cannot see, for as long as the page is open.
 */

/**
 * Tailwind's `xl`, and the same breakpoint the layer in HeroLearningFlow.tsx
 * switches on. These two are a pair: change one and the other has to follow, or
 * this mounts into a `display:none` parent (wasting the loop the gate exists to
 * save) or the layer renders with no scene in it.
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
 * The connection: a single line from the video mark's middle (x=24 of 1200) to the
 * certificate's. It dips well below its start, because a shallow arc across a
 * 1200-unit layer flattens into a straight line once it is scaled, and it ends at
 * 1176, which is where the certificate's middle lands in these units - the mark
 * overhangs the layer's right edge, so its centre ends up just inside it. The line
 * has to *join* the mark it is about, and an end that stopped short would leave the
 * reveal it triggers looking unconnected to it.
 *
 * One line rather than the two lanes this layer used to draw. The pair of them
 * read as two separate journeys between the same two marks, and the fainter one
 * looked like a stray artefact beside the first rather than part of it: a
 * connection between two things is one line, and a single line can carry the
 * weight the pair had to share.
 */
const TRAIL = 'M 24 48 C 320 168 660 108 1176 164';

/**
 * Five points on the line, as percentages of the layer with the fraction of the
 * reveal that reaches each. The points are traced from the cubic itself - `TRAIL`
 * at t = 0.10, 0.28, 0.48, 0.68 and 0.88, computed rather than eyeballed, because
 * a milestone that lights a little before or after the edge arrives reads as unlit
 * rather than as unlit-yet. Re-trace them if `TRAIL` ever moves; nothing here can
 * tell you that it did.
 */
const MILESTONES = [
  { key: 'm1', left: '9.5%', top: '39.4%', at: 0.095 },
  { key: 'm2', left: '23.8%', top: '56.5%', at: 0.238 },
  { key: 'm3', left: '41.3%', top: '64.6%', at: 0.413 },
  { key: 'm4', left: '60.9%', top: '68.1%', at: 0.609 },
  { key: 'm5', left: '83.1%', top: '74.2%', at: 0.831 },
];

/** The same trail at t = 0.17, 0.33, 0.52 and 0.74, for the particles' slow rise
 * off it. */
const PARTICLES = [
  { key: 'p1', left: '15%', top: '47.5%' },
  { key: 'p2', left: '28%', top: '59.3%' },
  { key: 'p3', left: '45%', top: '65.4%' },
  { key: 'p4', left: '67.2%', top: '69.3%' },
];

/** The reference's six sparkles, unmoved: the `✦` the hero badge uses, placed in
 * the bands the headline leaves free rather than on a glyph. They keep the
 * `hero-flow-sparkle` cycle, so their offsets are fractions of 3.6s. */
const SPARKLES = [
  { key: 'l-1', place: 'left-[1%] top-[7%]', size: 'text-[13px]', delay: '-0.4s' },
  { key: 'l-2', place: 'left-[2.5%] bottom-[18%]', size: 'text-[10px]', delay: '-2.1s' },
  { key: 'm-1', place: 'left-[38%] top-[2%]', size: 'text-[9px]', delay: '-1.2s' },
  { key: 'm-2', place: 'left-[58%] bottom-[1%]', size: 'text-[11px]', delay: '-2.8s' },
  { key: 'r-1', place: 'right-[1%] top-[12%]', size: 'text-[12px]', delay: '-1.6s' },
  { key: 'r-2', place: 'right-[3%] bottom-[26%]', size: 'text-[8px]', delay: '-3.3s' },
];

export default function HeroFlowScene() {
  const reduce = useReducedMotion();
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

  // Mounted rather than merely hidden, so a phone does not run any of this. The
  // query is read inside the effect and the first render is always `false`, so
  // the server HTML and the first client render agree.
  useEffect(() => {
    const mql = window.matchMedia(WIDE);
    const sync = () => setWide(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  // The draw itself. Guarded on `wide` as well as `reduce`, so the clock starts
  // when the scene mounts instead of running to completion behind a
  // `display:none` parent and being over before anyone could see it.
  useEffect(() => {
    if (!wide || reduce) {
      revealed.set(reduce ? 100 : 0);
      return;
    }
    // Set back to the start as well as animated from it, for the one case this
    // effect re-runs on: the viewport came back across the breakpoint, the scene
    // remounted, and the draw should begin again rather than appear finished.
    revealed.set(0);
    const controls = animate(revealed, 100, {
      duration: DRAW,
      delay: WIPE_DELAY,
      ease: 'linear',
    });
    return () => controls.stop();
  }, [wide, reduce, revealed]);

  if (!wide) return null;

  return (
    <>
      {/* Soft light behind the video mark. The certificate end has none: the
          artwork carries its own, and a glow can only be aimed once the artwork
          says where its seal sits. */}
      <span className="hero-flow-halo absolute -left-4 top-[3%] h-20 w-20 rounded-full bg-[radial-gradient(closest-side,rgba(198,140,86,0.4),rgba(198,140,86,0))] opacity-50 blur-[12px]" />
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
          {/* One stroke, deliberately heavier than either lane it replaces: it is now
              the only thing saying "these two are connected", and at the weight a
              lane carried a single line reads as a hairline rule rather than as a
              link. The gradient is the long lane's, crisped rather than replaced: a
              flat 1.0 alpha over a deepened ramp, #9E6C3E/#AB7443/#B0722C, which
              measures about 1.9-2.0:1 against the cream where the translucent ramp it
              started as sat nearer 1.2-1.6:1. The stroke therefore holds one weight of
              colour along its whole length instead of fading through its middle, and
              what still shifts across it is saturation rather than brightness -
              #B0722C at the certificate end is the most saturated - so it warms
              toward the certificate without the alpha doing any of that work. */}
          <path
            d={TRAIL}
            stroke="url(#heroFlowStroke)"
            strokeWidth="4"
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
          read as the journey restarting. */}
      {MILESTONES.map((m) => (
        <motion.span
          key={m.key}
          className="absolute block h-5 w-5"
          style={{ left: m.left, top: m.top, x: '-50%', y: '-50%' }}
          initial={reduce ? false : { opacity: 0, scale: 0.35 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduce ? 0 : 0.6,
            delay: reduce ? 0 : WIPE_DELAY + DRAW * m.at,
            ease: EASE,
          }}
        >
          {!reduce && (
            <motion.span
              className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(194,128,63,0.5),rgba(194,128,63,0))] blur-[5px]"
              animate={{ opacity: [0.7, 1, 0.7], scale: [0.92, 1.08, 0.92] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
            />
          )}
          <span className="absolute left-1/2 top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C2803F] bg-cream" />
        </motion.span>
      ))}

      {/* Particles: the dust the journey kicks up, not a second journey. Four
          small rises off the trail, spaced along it and staggered so they are
          never all in the air together, and dropped entirely under reduced
          motion - like the compact row's packet, a particle carries no meaning on
          its own. */}
      {!reduce &&
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

      {/* The video half. Three nested spans, each with one job: the outer one is
          the layer's existing float, the middle one is the arrival, and the inner
          one is the ambient turn. They have to be separate elements because each
          animates `transform` and an element has only one - stacked, the float,
          the arrival and the turn compose instead of overwriting each other.

          The logo is centred in its box rather than stretched to fill it: the
          mark is 60:36 in a square box, and the box's size is what the layer's
          geometry is written against, so the slack belongs to the box.

          The turn moves nothing on `y`: `.hero-flow-float-a` is the only owner of
          the mark's vertical travel, and the two of them would beat against each
          other (the class floats on 7.5s, anything here on 9s) to put six pixels
          of bob on a mark designed for three.

          `rotateZ` rests at -7deg rather than 0: the tilt is composition, not
          motion, so reduced motion keeps it while dropping everything that moves.
          The turn is what is deliberately small - seven degrees of yaw and five
          of pitch over nine seconds - because a mark at this size reads as
          wobbling rather than floating if it goes further. */}
      <span className="hero-flow-float-a absolute left-0 top-[10%] h-12 w-12 2xl:h-14 2xl:w-14">
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

      {/* The verified half, and the one element in this scene that is artwork
          rather than a drawing.

          Its footprint is the pair it replaces rather than either one of them: an
          80px halo and a 48px stencil were one region of the layer, so the
          artwork takes a single 80px box anchored where the glow was. The box
          steps with the rest of the layer at `2xl`. `object-contain` because the
          render is 3:2 inside a square box - the slack is the box's, exactly as
          it is for the logo on the other side.

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
          handful of repaints on an 80px box, which is why the depth is worth it.

          No `y` travel anywhere in here: the wrapper's float owns that axis, and
          a second owner would beat against it. */}
      <span
        className="hero-flow-float-b absolute -bottom-2 -right-4 h-20 w-20 2xl:h-24 2xl:w-24"
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
            sizes="(min-width: 1536px) 96px, 80px"
            className="hero-flow-cert-shadow h-full w-full object-contain"
          />
        </motion.span>
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
