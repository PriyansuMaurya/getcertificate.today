/**
 * The layer the hero's flow is drawn into: a video mark, a certificate, and one
 * line travelling between them, so the headline's own claim - learning becoming
 * verified - is drawn rather than restated. The drawing itself lives in
 * HeroFlowScene.tsx; this module owns the box it is drawn against.
 *
 * One treatment at every width. The layer's insets are what changes: below `xl`
 * there is no page margin for the marks to sit in, so the layer cancels the
 * hero's own `px-5` and the two marks take the corners the centred lines leave
 * free - flush with the page's own edge, or with the edge of the column once the
 * page is wider than that column's 1180px cap. From `xl` the headline is narrow
 * enough to flank, and the insets step out to `-3.5rem` so the same layer reaches
 * into the page margin where there is more room.
 *
 * That one decision is why the marks are placed by fraction rather than by pixel:
 * the layer's shape changes with the viewport, and a fraction is the only
 * description of "in the corner the type leaves free" that holds at 320px and at
 * 1536px alike. HeroFlowScene.tsx traces both lines between the same two
 * fractions, so the drawing stays joined to the marks at every width.
 *
 * The layer is deliberately not `hidden` below `xl` any more. It used to gate a
 * second, compact treatment - a row of hand-drawn marks under the headline - and
 * the two then had to be kept in step with each other: two pairs of marks, two
 * trails, one idea. Below `xl` the same drawing now simply has less room, which is
 * what the two trails and their measurements in HeroFlowScene.tsx are for.
 *
 * The flanking treatment assumes the headline's first line stays narrower than its
 * column. That is a property of this copy, not of the layout: longer or translated
 * text that fills the column would push the marks onto the type.
 *
 * The marks are not the same colour on purpose. The video end is the YouTube logo
 * as CSS (`.yt-logo` in globals.css), which carries its own red; the certificate
 * end is a supplied render, so it carries its own palette. Neither carries an
 * accessible name - the headline says all of this in words, and a screen reader
 * announcing "play button, certificate" over copy that already reads "Turn what
 * you learn on YouTube into verifiable certificates" would be noise. The whole
 * layer is therefore `aria-hidden` and `pointer-events-none`, and nothing inside it
 * can take focus.
 *
 * Both ends read left to right, video to certificate, which is the direction the
 * headline reads too: the line is drawn that way by the scene's own clip, and the
 * milestones light in the order the draw reaches them. `preserveAspectRatio="none"`
 * lets the scene's line fill a layer whose height follows the type size, so
 * `vector-effect` keeps it at its authored weight rather than letting the
 * non-uniform scale fatten it.
 *
 * Sparkles are the same `✦` the hero badge uses, placed in the gaps the headline
 * leaves rather than on a glyph.
 */

import HeroFlowScene from '@/components/landing/HeroFlowScene';

export default function HeroLearningFlow() {
  return (
    /* The layer is one step taller than the headline at each end, and that padding
       is geometry rather than spacing: every mark position and both lines' endpoint
       fractions are read against the layer's height, which is the headline plus
       1.25rem at each end. Change that padding, or the number of lines the headline
       wraps to, and the marks and the line move with it.

       The insets are one step wider than the marks below `xl`, so the layer's own
       edges land on the page's - and the marks cannot be clipped by the hero's
       `overflow-hidden`; from `xl` they step out to where the page margin starts,
       and the layer is still 14px inside the viewport at 1280. Between the
       container's 1180px cap and `xl` the layer is the container's own width, so
       the marks sit a little further in than they do on either side of that range -
       a step of about 35px as the viewport crosses 1280. */
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-[-1.25rem] -left-5 -right-5 z-0 xl:-left-14 xl:-right-14 2xl:-left-16 2xl:-right-16"
    >
      <HeroFlowScene />
    </div>
  );
}
