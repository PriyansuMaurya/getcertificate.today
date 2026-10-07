import CertificateMock from './CertificateMock';
import HeroCertificate from './HeroCertificate';
import HeroFloaters from './HeroFloaters';

/**
 * The hero's bottom composition: the centre certificate with four smaller copies
 * fanned behind it.
 *
 * Everything scales as one object. A query container sits on the stage, so every
 * offset below is `cqw` - a share of the stage's own width - and the centre card
 * carries its own nested container so its interior keeps a fixed proportion no
 * matter how wide the stage gets. The stage is deliberately uncapped - it fills
 * its parent, which is the full page width - and only the centre column caps, at
 * `min(80cqw, 620px)` between `sm` and `lg`.
 *
 * Depth is built from layering rather than effects: the far cards are dimmed and
 * sit lowest, the near cards sit above them, and the centre card emerges above
 * those. The floating marks sit lowest of all, in the same decorative layer as
 * the fans.
 *
 * The cards answer the pointer - see `.cert-lift` / `.cert-fan-wrap` in
 * globals.css - which is why each fan card takes pointer events back off the
 * decorative layer, and why the stage carries headroom above the centre card.
 */

/** The centre card is this share of the stage column's width. */
const CARD_WIDTH_RATIO = 0.78;

/**
 * Four more copies of the fanned document, behind the centre card. Outermost
 * first: later siblings paint over earlier ones, and each pair is pushed back
 * with a little more transparency so the centre card stays the thing the eye
 * lands on.
 *
 * Each entry is split in two: `place` positions the copy and receives the hover,
 * `card` carries its rotation and its dimming. The split keeps the hover honest -
 * a transform on the rotated element would lift the card along its own tilt, so a
 * fanned card would rise diagonally while the centre card rises straight up.
 *
 * Pointer events are re-enabled on `card`, not on `place`: hit testing follows the
 * rotation, so the target is the card actually painted there rather than the
 * wrapper's unrotated box, and the hover still reaches the wrapper it lifts. The
 * wrapper stays inert only for as long as the decorative layer it sits in stays
 * `pointer-events-none` - drop that and the wrapper boxes become hover hotspots.
 *
 * Nothing here is meant to be cropped. A rotated card needs a bounding box of
 * `width * cos(r) + height * sin(r)` by `height * cos(r) + width * sin(r)`, and
 * since a transform does not move the layout box, the offsets have to cover the
 * bounding box, not the width. The near pair (31cqw at 9deg) reaches 33.9cqw
 * wide and 25.3cqw tall from an offset of 12cqw - a 10.6cqw margin to the stage
 * edge. The far pair (26cqw at 14deg) reaches 29.4cqw wide and 23.1cqw tall from
 * an offset of 4cqw, leaving 2.3cqw clear of the edge. The fan reads as a fan
 * because the cards overlap the centre card and each other rather than because
 * they run off the page; the outer pair is dropped on phones, where there is no
 * width to fan into.
 *
 * The bottom offsets are floored in px for the same reason as the stage foot:
 * the mocks' shadows are measured in px, so a pure `cqw` offset stops covering
 * them on narrow viewports and `overflow-hidden` shears the blur into a hard
 * line. 2rem clears the mocks' 28px shadow, 2.5rem clears it with room to spare.
 */
const SECONDARY_CARDS = [
  {
    key: 'left-far',
    place: 'left-[4cqw] bottom-[max(8cqw,2.5rem)] hidden w-[26cqw] sm:block',
    card: '-rotate-[14deg] opacity-[0.82]',
  },
  {
    key: 'right-far',
    place: 'right-[4cqw] bottom-[max(8cqw,2.5rem)] hidden w-[26cqw] sm:block',
    card: 'rotate-[14deg] opacity-[0.82]',
  },
  {
    key: 'left-near',
    place: 'left-[12cqw] bottom-[max(3cqw,2rem)] w-[31cqw]',
    card: '-rotate-[9deg] opacity-[0.9]',
  },
  {
    key: 'right-near',
    place: 'right-[12cqw] bottom-[max(3cqw,2rem)] w-[31cqw]',
    card: 'rotate-[9deg] opacity-[0.9]',
  },
];

export default function HeroCertificateStage() {
  return (
    // The foot room clears the centre card's drop shadow, and the fanned cards'
    // offsets are floored further down for their own. The shadows' blur is in px
    // while the rest of this file is in cqw, so each is floored - at 320px wide,
    // 8cqw is only 26px, well inside the card's 36px shadow, and `overflow-hidden`
    // would shave it off as a hard line.
    //
    // The top room is the same argument for the hover lift: the centre card
    // starts at the top of the stage, so without it the card's own hover would
    // raise its top edge past the clip and shave 8px off the document.
    <div className="hero-stage query-container relative isolate w-full overflow-hidden pb-[max(8cqw,3rem)] pt-[max(1.5cqw,0.75rem)]">
      {/* Warm light pooling behind the composition, so the cream page is not
          the only thing the cards are seen against. */}
      <span
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute inset-x-0 top-[16%] mx-auto h-[72%] w-[88%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(198,140,86,0.22),rgba(198,140,86,0))] blur-[28px]"
      />

      {/* The fanned credentials and the floating marks. Decorative: the centre
          card carries the accessible name for the whole composition. The fans
          take pointer events back on the card itself so each one answers a
          hover and nothing else is a target; the marks stay inert. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <HeroFloaters />
        {SECONDARY_CARDS.map(({ key, place, card }) => (
          <div key={key} className={`cert-fan-wrap absolute ${place}`}>
            <div className={`cert-fan-inner pointer-events-auto relative ${card}`}>
              <CertificateMock />
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto flex w-[84cqw] flex-col items-center sm:w-[min(80cqw,620px)] lg:w-[62cqw]">
        <div
          className="hero-certificate relative z-10"
          style={{ width: `${CARD_WIDTH_RATIO * 100}%` }}
        >
          {/* The lift sits on its own wrapper rather than on the animated
              element: an animation with `both` fill keeps re-applying its own
              transform, which would beat a hover transform on the same box. */}
          <div className="cert-lift">
            <HeroCertificate />
          </div>
        </div>
      </div>
    </div>
  );
}
