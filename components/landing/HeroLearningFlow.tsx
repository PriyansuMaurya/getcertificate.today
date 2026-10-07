/**
 * The flow drawn around the hero headline: a video mark, a certificate seal, and
 * dashed arcs travelling between them, so the headline's own claim - learning
 * becoming verified - is drawn rather than restated.
 *
 * Two treatments, because the room differs. From `xl` up the headline leaves a
 * gutter of its own, so the marks flank it in the page margin and the arcs sweep
 * behind the type. Below `xl` there is no gutter - the headline fills its column,
 * so flanking marks would sit on the glyphs - and the flow becomes a compact row
 * under the headline instead of disappearing. Same idea, less room: the reader
 * sees the video become a certificate either way.
 *
 * The flanking treatment assumes the headline's first line stays narrower than
 * its column. That is a property of this copy, not of the layout: longer or
 * translated text that fills the column would push the marks onto the type.
 *
 * The two ends are deliberately not the same colour. The video mark is `clay`,
 * the unverified half of the idea; the seal is `terracotta`, the page's accent,
 * so the eye lands on the end of the journey. Neither carries an accessible
 * name - the headline says all of this in words, and a screen reader announcing
 * "play button, certificate" over copy that already reads "Turn what you learn on
 * YouTube into verifiable certificates" would be noise. The whole component is
 * therefore `aria-hidden` and inert.
 *
 * The arcs are drawn from the video mark to the seal, left to right, which is
 * also the direction their dashes travel - see `.hero-flow-dash-a/b` in
 * globals.css. `preserveAspectRatio="none"` lets one path fill a layer whose
 * height follows the type size, so `vector-effect` keeps the stroke at 1.6px
 * rather than letting the non-uniform scale fatten it.
 *
 * Sparkles are the same `✦` the hero badge uses, placed in the gaps the headline
 * leaves rather than on a glyph.
 */

type Sparkle = {
  key: string;
  /** Placement within the flanking layer. */
  place: string;
  size: string;
  delay: string;
};

const SPARKLES: Sparkle[] = [
  // Beside the video mark, in the strip between the mark and the first line.
  { key: 'l-1', place: 'left-[1%] top-[7%]', size: 'text-[13px]', delay: '-0.4s' },
  { key: 'l-2', place: 'left-[2.5%] bottom-[18%]', size: 'text-[10px]', delay: '-2.1s' },
  // Above and below the type, where the headline leaves the layer free.
  { key: 'm-1', place: 'left-[38%] top-[2%]', size: 'text-[9px]', delay: '-1.2s' },
  { key: 'm-2', place: 'left-[58%] bottom-[1%]', size: 'text-[11px]', delay: '-2.8s' },
  // Beside the seal.
  { key: 'r-1', place: 'right-[1%] top-[12%]', size: 'text-[12px]', delay: '-1.6s' },
  { key: 'r-2', place: 'right-[3%] bottom-[26%]', size: 'text-[8px]', delay: '-3.3s' },
];

/** The video half of the idea: a player frame with a play head in it. */
function VideoMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" fill="none">
      <rect
        x="3.5"
        y="12.5"
        width="41"
        height="23"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M20.5 19.6 30.4 24 20.5 28.4Z" fill="currentColor" />
    </svg>
  );
}

/** The verified half: a milled seal - stitched ring, medallion, tick, ribbons. */
function CertificateSeal() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" fill="none">
      <circle
        cx="24"
        cy="20"
        r="16.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2.5 3.5"
        opacity="0.55"
      />
      <circle cx="24" cy="20" r="11.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M18.3 20.4 22.2 24.3 29.9 15.6"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M17.6 30.6 15.6 42.4 24 38.6 32.4 42.4 30.4 30.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[-1.25rem] -left-14 -right-14 z-0 hidden xl:block 2xl:-left-16 2xl:-right-16"
      >
        {/* Two trails rather than one line, so the pair reads as motion. Both run
            from the video mark to the seal - x=24 of 1200 is the left mark's
            middle, and the `2xl` marks are a few px wider than the arc chases -
            and both dip well below their start, because a shallow arc across a
            1200-unit layer flattens into a straight line once it is scaled. */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="heroFlowStroke" x1="0" y1="0" x2="1" y2="0.35">
              <stop offset="0" stopColor="#B98A5C" stopOpacity="0.7" />
              <stop offset="0.55" stopColor="#CFA578" stopOpacity="0.55" />
              <stop offset="1" stopColor="#C2803F" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <path
            d="M 24 48 C 320 168 660 108 1176 164"
            stroke="url(#heroFlowStroke)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="7 11"
            vectorEffect="non-scaling-stroke"
            className="hero-flow-dash-a"
          />
          <path
            d="M 24 76 C 360 196 640 140 1176 178"
            stroke="#C2803F"
            strokeOpacity="0.4"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="2 13"
            vectorEffect="non-scaling-stroke"
            className="hero-flow-dash-b"
          />
        </svg>

        {/* Soft light behind each mark, breathing out of phase with the other. */}
        <span className="hero-flow-halo absolute -left-4 top-[3%] h-20 w-20 rounded-full bg-[radial-gradient(closest-side,rgba(198,140,86,0.4),rgba(198,140,86,0))] opacity-50 blur-[12px]" />
        <span
          className="hero-flow-halo absolute -right-4 bottom-[2%] h-20 w-20 rounded-full bg-[radial-gradient(closest-side,rgba(198,140,86,0.4),rgba(198,140,86,0))] opacity-50 blur-[12px]"
          style={{ animationDelay: '-2.4s' }}
        />

        {/* 3rem at `xl`, stepping up where `2xl` widens the gutter. The compact
            row is half this size and states its own, since it is a different
            composition rather than the same one at another breakpoint. */}
        <span className="hero-flow-float-a absolute left-0 top-[10%] h-12 w-12 text-clay/70 2xl:h-14 2xl:w-14">
          <VideoMark />
        </span>
        <span
          className="hero-flow-float-b absolute bottom-[4%] right-0 h-12 w-12 text-terracotta/85 2xl:h-14 2xl:w-14"
          style={{ animationDelay: '-1.2s' }}
        >
          <CertificateSeal />
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
      </div>

      {/* ---------- below xl: the same flow, as one row ----------
          No gutter to flank in, so the marks and a single short trail sit in flow
          under the headline - which is why `HeroLearningFlow` is placed after the
          h1 in the hero: this half is an ordinary row, not an absolute layer, so
          its document position is its position on the page. Same glyphs and same
          dash cycle, one trail rather than two, and a smaller float because these
          glyphs are half the size. The trail drops the gradient: a second SVG in
          the document cannot reuse the first one's gradient id. */}
      <div
        aria-hidden="true"
        className="relative mt-5 flex items-center justify-center gap-3 xl:hidden"
      >
        <span className="hero-flow-float-sm h-6 w-6 shrink-0 text-clay/70">
          <VideoMark />
        </span>

        <span className="relative h-7 w-24 shrink-0 sm:w-32">
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
          className="hero-flow-float-sm h-6 w-6 shrink-0 text-terracotta/85"
          style={{ animationDelay: '-3.4s' }}
        >
          <CertificateSeal />
        </span>
      </div>
    </>
  );
}
