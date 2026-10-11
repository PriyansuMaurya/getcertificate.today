/**
 * The flow drawn around the hero headline: a video mark, a certificate, and a line
 * travelling between them, so the headline's own claim - learning becoming
 * verified - is drawn rather than restated.
 *
 * Two treatments, because the room differs. From `xl` up the headline leaves a
 * gutter of its own, so the marks flank it in the page margin and the arcs sweep
 * behind the type. Below `xl` there is no gutter - the headline fills its column,
 * so flanking marks would sit on the glyphs - and the flow becomes a compact row
 * under the headline instead of disappearing. Same idea, less room: the reader
 * sees the video become a certificate either way.
 *
 * Each treatment has its own pair of marks. From `xl` up they are the objects the
 * idea is about - a YouTube mark and a certificate, joined by a journey that draws
 * itself between them - and that scene is HeroFlowScene.tsx. The compact row
 * carries its own pair at a third of the size, because at 32px even the desktop
 * pair would read as two marks rather than as a video and a certificate: the row
 * gets a filled player with a progress bar and a certificate sheet with a stamped
 * seal. Two ends either way, drawn for the size they are actually seen at and for
 * the room each one has to move in.
 *
 * The flanking treatment assumes the headline's first line stays narrower than
 * its column. That is a property of this copy, not of the layout: longer or
 * translated text that fills the column would push the marks onto the type.
 *
 * The two ends are deliberately not the same colour. The row's video mark is
 * `clay`, the unverified half of the idea; its seal is `terracotta`, the page's
 * accent, so the eye lands on the end of the journey. That split is the row's own:
 * the desktop pair is a YouTube logo and supplied artwork, so it carries its own
 * colours rather than inheriting these. Neither carries an
 * accessible name - the headline says all of this in words, and a screen reader
 * announcing "play button, certificate" over copy that already reads "Turn what
 * you learn on YouTube into verifiable certificates" would be noise. The whole
 * component is therefore `aria-hidden`, and nothing inside it can take focus.
 *
 * Both treatments read from the video to the certificate, left to right: the compact
 * row's dashes travel that way (see `.hero-flow-dash-a` in globals.css), and the
 * desktop pair is drawn in that same direction by the scene's own clip. The compact
 * row's single trail carries a brighter packet on top of its dashes for the same
 * reason: at 112px wide the row has no room for the flanking pair's one long, slow
 * line, so a shorter trail plus a travelling packet states the direction instead.
 * `preserveAspectRatio="none"` lets the scene's line fill a layer whose height
 * follows the type size, so `vector-effect` keeps it at its authored weight rather
 * than letting the non-uniform scale fatten it.
 *
 * Sparkles are the same `✦` the hero badge uses, placed in the gaps the headline
 * leaves rather than on a glyph.
 */

import HeroFlowScene from '@/components/landing/HeroFlowScene';

/* The desktop treatment's two marks, its line, its halo, its sparkles and its
   timeline all live in HeroFlowScene.tsx. That file is a client component and
   this one is not, which is deliberate: the compact row below is ordinary
   markup, and a timeline it cannot use is not a reason to ship it to the
   browser. */

/**
 * The compact row's video end: a real player rather than the flanking pair's
 * outline frame. At 40x32 the outline read as a rectangle with a triangle in it,
 * so this one carries a surface, a filled play button, and a progress bar - the
 * bar is what says "video" at this size, and it is the row's one piece of
 * motion that is not ambient (see `.hero-flow-progress`).
 *
 * Drawn at 1:1 in its own viewBox, so every unit below is a pixel at the size
 * the row actually renders it.
 */
function CompactVideoTile() {
  return (
    <svg viewBox="0 0 40 32" className="h-full w-full" fill="none">
      {/* Surface and hairline, which is what makes the tile an object rather
          than an outline. */}
      <rect
        x="1"
        y="1"
        width="38"
        height="30"
        rx="6"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      {/* Filled button with a cream triangle, so the play mark reads at 12px
          wide. The triangle's bounding box sits a touch right of the button's
          centre, which is where a play glyph looks centred. */}
      <rect
        x="13.6"
        y="8.5"
        width="12.8"
        height="9.6"
        rx="3.2"
        fill="currentColor"
        opacity="0.95"
      />
      <path d="M17.7 10.8 22.7 13.3 17.7 15.8Z" fill="#F5F0EB" />
      {/* Track first, then the fill on top of it - the fill is at full width in
          the markup and `scaleX`ed from its left edge by the animation, which is
          why it needs no width of its own. */}
      <rect x="5.5" y="25.6" width="29" height="2.8" rx="1.4" fill="currentColor" opacity="0.16" />
      {/* Same `rx` as the track, so the two agree. `scaleX` squashes the
          trailing cap a little, which at 2.8px tall is not visible.

          The fill keeps `fillOpacity` where the rest of this file uses
          `opacity`: the animation drives the element's own opacity, and a
          presentation attribute would be overridden by it. */}
      <rect
        x="5.5"
        y="25.6"
        width="29"
        height="2.8"
        rx="1.4"
        fill="currentColor"
        fillOpacity="0.9"
        className="hero-flow-progress"
      />
    </svg>
  );
}

/**
 * The compact row's other end: an actual certificate - a sheet with a title
 * rule, body rules and a signature, and a warm stamped seal over its
 * bottom-right corner.
 *
 * Two SVGs rather than one, because the stamp is a CSS transform on an element
 * and a transform on a group inside the sheet's SVG would have to be given its
 * origin in that SVG's user units, coupling globals.css to these coordinates.
 * The seal's own box is the seal, so the stamp pivots where it looks like it
 * should and this file's arithmetic stays in this file.
 */
function CompactCertificate() {
  return (
    <span className="relative block h-full w-full">
      <svg viewBox="0 0 32 32" className="h-full w-full" fill="none">
        {/* The sheet. Paper rather than cream, so it separates from the page it
            is drawn on the same way the real cards below do. */}
        <rect
          x="3"
          y="1.5"
          width="20"
          height="29"
          rx="2.5"
          fill="#FAF8F5"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.3"
        />
        {/* Title rule, then three body rules. Everything here stops above y=18,
            which is where the seal starts. */}{' '}
        <rect x="6" y="5.6" width="9" height="1.7" rx="0.85" fill="currentColor" opacity="0.5" />
        <rect x="6" y="9.4" width="14" height="1.4" rx="0.7" fill="currentColor" opacity="0.22" />
        <rect x="6" y="12.6" width="14" height="1.4" rx="0.7" fill="currentColor" opacity="0.22" />
        <rect x="6" y="15.8" width="10" height="1.4" rx="0.7" fill="currentColor" opacity="0.22" />
        {/* A signature, bottom-left, clear of the seal's left edge. */}
        <path
          d="M5.8 26.6C7 25.1 8.1 27.6 9.4 26.5 10.3 25.7 11 26.8 12.2 26.2"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
      {/* The seal, stamped on the sheet's right edge rather than beside it: the
          disc is centred on x=23, which is the paper's own right edge, so half of
          it overhangs the way a real stamp would.

          Given its own box rather than a second full-size layer, and that is what
          makes the stamp land where the seal is: `hero-flow-stamp` is an ordinary
          CSS transform, so it pivots about its element's centre - and its element
          is the seal. The 16px box is the disc's 13px plus a little stroke either
          side; `left` and `top` are the disc's centre (23, 24.5) less the box's
          half (8). */}
      <span className="hero-flow-stamp absolute left-[15px] top-[16.5px] h-4 w-4">
        <svg viewBox="0 0 16 16" className="h-full w-full" fill="none">
          <circle
            cx="8"
            cy="8"
            r="6.5"
            fill="#FBEADF"
            stroke="currentColor"
            strokeOpacity="0.85"
            strokeWidth="1.4"
          />
          <path
            d="M5.4 8.1 7.3 10 10.7 6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}

export default function HeroLearningFlow() {
  return (
    <>
      {/* ---------- xl and up: the marks flank the headline ----------
          The layer's insets are one step wider than the marks, so each mark keeps
          a gap between itself and the first line; its outer edge stays flush with
          the layer's edge at both sizes. At 1280 that still leaves the layer 14px
          inside the viewport, so the hero's `overflow-hidden` never bites.

          The layer is also 20px taller than the headline at each end, and that
          padding is geometry, not spacing: every mark position and both path
          endpoints below are fractions of the layer's height, which is the
          headline plus 1.25rem at each end. Change that padding, or the number of
          lines the headline wraps to, and the marks and arcs move with it. */}
      {/* The box is the geometry; the drawing inside it is HeroFlowScene.tsx. The
          scene places its own line, halo, marks and sparkles against the same
          fractions of this same box, so the composition is still described in
          one place even though it is now written in two files. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[-1.25rem] -left-14 -right-14 z-0 hidden xl:block 2xl:-left-16 2xl:-right-16"
      >
        <HeroFlowScene />
      </div>

      {/* ---------- below xl: the same flow, as one row ----------
          No gutter to flank in, so the marks and a single short trail sit in flow
          under the headline - which is why `HeroLearningFlow` is placed after the
          h1 in the hero: this half is an ordinary row, not an absolute layer, so
          its document position is its position on the page. One trail rather than
          two, and a smaller float, because these marks are two thirds the size of
          the flanking pair. The trail's box grew with the marks, which is not only
          a scale step: `preserveAspectRatio="none"` resamples the same path once
          per axis, so the arc's shape follows the box's ratio rather than the
          marks' size. The trail drops the gradient too: a second SVG in the
          document cannot reuse the first one's gradient id.

          This half is also the only part of the hero that is read at one size on
          every device, so it is where the two ends get drawn as the things they
          stand for - a player and a certificate - rather than as outline marks.
          `text-clay` and `text-terracotta` at full strength: a filled button at
          70% washes out, and there is no tint to inherit from the desktop pair,
          whose colours its own SVGs carry outright.

          `hero-settle` is the row's own beat in the hero's load sequence. It sits
          between the headline and the paragraph in the document, and shares the
          paragraph's delay rather than inventing a sixth step. */}
      <div
        aria-hidden="true"
        className="hero-settle hero-settle-3 relative mt-5 flex items-center justify-center gap-3 xl:hidden"
      >
        <span className="hero-flow-float-sm h-8 w-10 shrink-0 text-clay">
          <CompactVideoTile />
        </span>

        <span className="relative h-8 w-28 shrink-0 sm:w-36">
          {/* The dashes state the path; the packet on top of them states the
              direction. Two paths rather than one dashed path with an animated
              gradient, because `stroke-dashoffset` is the one property here that
              will not composite and a second sub-3px path is cheaper than a
              repaint of the trail itself. Both are drawn from the video mark to
              the seal, so their travel runs left to right. */}
          <svg
            className="h-full w-full"
            viewBox="0 0 160 40"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M 6 7 C 48 40 108 6 154 33"
              stroke="#C2803F"
              strokeOpacity="0.55"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray="5 7"
              vectorEffect="non-scaling-stroke"
              className="hero-flow-dash-a"
            />
            {/* `pathLength="100"` states the dash pattern as a share of the path
                instead of a distance in the viewBox's units, which is the only way
                to say "one packet, one lap" on a path authored 160 units long and
                rendered 112px and 144px wide at this row's two sizes: with
                `vector-effect` in play it is ambiguous whether dashes are measured
                before or after the non-uniform scale, and the ratio makes both
                readings the same. 4+96 is a whole lap, so the packet leaves the
                video exactly as the next one arrives. */}
            <path
              d="M 6 7 C 48 40 108 6 154 33"
              pathLength={100}
              stroke="#C2803F"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeDasharray="4 96"
              vectorEffect="non-scaling-stroke"
              className="hero-flow-comet"
            />
          </svg>
          <span
            className="hero-flow-sparkle absolute left-[22%] top-[-0.35rem] text-[8px] leading-none text-terracotta/60"
            style={{ animationDelay: '-1.4s' }}
          >
            ✦
          </span>
          <span
            className="hero-flow-sparkle absolute bottom-[-0.25rem] right-[22%] text-[7px] leading-none text-terracotta/60"
            style={{ animationDelay: '-2.6s' }}
          >
            ✦
          </span>
        </span>

        <span
          className="hero-flow-float-sm h-8 w-8 shrink-0 text-terracotta"
          style={{ animationDelay: '-3.4s' }}
        >
          <CompactCertificate />
        </span>
      </div>
    </>
  );
}
