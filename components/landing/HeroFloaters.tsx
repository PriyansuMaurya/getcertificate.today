import { CheckIcon } from '@/components/icons';

/**
 * Ambient marks drifting either side of the hero's certificate stage.
 *
 * Decorative, so the layer is `pointer-events-none` and every mark is hidden from
 * assistive tech: nothing here means anything, and a screen reader announcing
 * "check mark" or "black star" beside a certificate would be noise. The stage's
 * decorative layer is `aria-hidden` already; the attribute here is repeated so
 * the component is inert on its own terms rather than by where it happens to be
 * mounted.
 *
 * Positions are hand-authored rather than random at runtime. A `Math.random()`
 * in render would differ between the server render and the client render and
 * break hydration, so "random places" is a fixed scatter that reads as unplanned
 * - paired marks never share a height, an inset, a size or a phase.
 *
 * Each mark carries its own negative delay so the drift is already out of step
 * on the first frame instead of every mark leaving together.
 */
type Mark = 'star' | 'check' | 'ring' | 'dot';

type Floater = {
  key: string;
  /** Placement plus the breakpoint at which the mark appears. */
  place: string;
  /** Size of the mark's box, in stage-relative units like everything else. */
  box: string;
  mark: Mark;
  /** Which of the three drift cycles this mark runs. */
  drift: 'hero-drift-1' | 'hero-drift-2' | 'hero-drift-3';
  delay: string;
};

const FLOATERS: Floater[] = [
  // Left of the cards.
  {
    key: 'l-star-high',
    place: 'left-[2.5%] top-[9%]',
    box: 'h-[2.4cqw] w-[2.4cqw]',
    mark: 'star',
    drift: 'hero-drift-1',
    delay: '-0.6s',
  },
  {
    key: 'l-ring-mid',
    place: 'left-[6.5%] top-[30%] hidden sm:block',
    box: 'h-[3.2cqw] w-[3.2cqw]',
    mark: 'ring',
    drift: 'hero-drift-2',
    delay: '-4.2s',
  },
  {
    key: 'l-dot',
    place: 'left-[3%] top-[54%] hidden sm:block',
    box: 'h-[7cqw] w-[7cqw]',
    mark: 'dot',
    drift: 'hero-drift-3',
    delay: '-1.8s',
  },
  {
    key: 'l-check-low',
    place: 'left-[10%] top-[76%]',
    box: 'h-[3cqw] w-[3cqw]',
    mark: 'check',
    drift: 'hero-drift-2',
    delay: '-6.5s',
  },
  // Right of the cards, deliberately not mirroring the left.
  {
    key: 'r-star-high',
    place: 'right-[3%] top-[7%]',
    box: 'h-[2.8cqw] w-[2.8cqw]',
    mark: 'star',
    drift: 'hero-drift-2',
    delay: '-2.3s',
  },
  {
    key: 'r-ring-mid',
    place: 'right-[7.5%] top-[28%] hidden sm:block',
    box: 'h-[2.2cqw] w-[2.2cqw]',
    mark: 'ring',
    drift: 'hero-drift-1',
    delay: '-5.1s',
  },
  {
    key: 'r-dot',
    place: 'right-[4%] top-[50%] hidden sm:block',
    box: 'h-[8cqw] w-[8cqw]',
    mark: 'dot',
    drift: 'hero-drift-3',
    delay: '-0.9s',
  },
  {
    key: 'r-check-low',
    place: 'right-[11%] top-[72%]',
    box: 'h-[3.4cqw] w-[3.4cqw]',
    mark: 'check',
    drift: 'hero-drift-1',
    delay: '-3.7s',
  },
];

function MarkGlyph({ mark }: { mark: Mark }) {
  switch (mark) {
    // The same star the hero badge uses, so the scatter belongs to the page.
    case 'star':
      return <span className="text-[1.5cqw] leading-none text-terracotta/70">✦</span>;
    case 'check':
      return (
        <span className="flex h-full w-full items-center justify-center rounded-full border border-sand bg-cream/70">
          <CheckIcon className="h-[55%] w-[55%] text-terracotta/80" />
        </span>
      );
    case 'ring':
      return <span className="h-full w-full rounded-full border border-sand/80" />;
    case 'dot':
      return <span className="h-full w-full rounded-full bg-terracotta/20 blur-[10px]" />;
  }
}

export default function HeroFloaters() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {FLOATERS.map(({ key, place, box, mark, drift, delay }) => (
        <span key={key} className={`absolute ${place}`}>
          <span
            className={`flex items-center justify-center ${box} ${drift}`}
            style={{ animationDelay: delay }}
          >
            <MarkGlyph mark={mark} />
          </span>
        </span>
      ))}
    </div>
  );
}
