'use client';

import {
  animate,
  useInView,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The landing page's scroll reveal: one entrance per section or card group, fired
 * the first time the element enters the viewport and never again.
 *
 * Motion, not CSS, by choice - the project already depends on framer-motion (see
 * components/ui/calendar.tsx), so this adds no bundle. It also means the reveal is
 * driven by JS, which the global `prefers-reduced-motion` rule in globals.css
 * cannot reach: that rule zeroes CSS animation and transition durations, and a
 * JS-driven animation is unaffected by it. Honouring the preference is therefore
 * this component's job, not the stylesheet's.
 *
 * The animation is imperative (`animate()` on the node) rather than declarative
 * (`motion.div` with `initial`/`animate`):
 *
 * - `initial` in Motion is rendered as an inline style into the server HTML, so a
 *   declarative hidden state would leave every wrapped section blank for a visitor
 *   without JavaScript - and for a crawler that does not execute scripts. The
 *   hidden state therefore lives in CSS instead (`.js .reveal`), gated on the `js`
 *   marker app/layout.tsx adds before paint, so it exists only while a script is
 *   running to reverse it.
 * - With no `initial` to animate *from*, a declarative target would have to infer
 *   its origin from the element's computed style. `animate(node, keyframes)` does
 *   that explicitly and is documented to start from the current value, so the
 *   reveal cannot silently degrade into a one-frame swap - a failure that no
 *   typecheck, lint or formatting pass could catch.
 *
 * One consequence worth knowing: while JS is running, a wrapped element sits at
 * opacity 0 until it is revealed, so if this chunk failed to load after hydration
 * below-fold sections would stay faded. The text is only faded, never removed or
 * hidden with `display`/`visibility`, so it stays in the DOM and readable to search
 * engines throughout, and the print stylesheet in globals.css forces every reveal
 * visible so a printed page is never blank.
 *
 * Two smaller effects of the same design. The wrapper is usually also the card
 * itself (`lift-card` is passed in), and Motion's inline transform beats the class
 * rule - so the hover lift is suppressed for the ~0.55s the reveal runs and only
 * becomes available once `onComplete` hands the element back; that hand-back is
 * what the completion callback exists for, and it is skipped only when the node is
 * being unmounted. And that callback leaves Motion's inline `opacity: 1` in place
 * for the rest of the element's life, so a future class-based opacity state on a
 * revealed element would silently lose to it.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Stagger, in seconds, for items revealed as a group. */
  delay?: number;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Once only: re-animating on every scroll-by is an interface fighting its
  // reader. The negative bottom margin fires the reveal slightly before the
  // element's edge reaches the fold, so it settles as it arrives rather than
  // after it is already being read.
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduce = useReducedMotion();
  // Latched, and never stopped by this effect's own cleanup: `useReducedMotion()`
  // can flip mid-session and `useInView` can emit one more render after its
  // observer disconnects, and either would re-run the effect and stop the reveal
  // part-way - leaving the section frozen between 0 and 1 for good, which is worse
  // than an animation that runs a few frames long. The one stop that is safe (the
  // node is being unmounted) happens in the empty-deps effect below, where the
  // element is going away regardless.
  const revealed = useRef(false);
  const controls = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    return () => controls.current?.stop();
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!inView || !node || revealed.current) return;
    revealed.current = true;

    // Reduced motion keeps the reveal but drops the rise, so the section still
    // arrives rather than appearing between two frames; the CSS override drops the
    // transform on that path too.
    controls.current = animate(node, reduce ? { opacity: 1 } : { opacity: 1, y: 0 }, {
      duration: reduce ? 0.2 : 0.55,
      ease: [0.23, 1, 0.32, 1],
      delay: reduce ? 0 : delay,
      // Motion leaves its final values behind as inline styles, and an inline
      // `transform` beats any class rule - which would silently kill
      // `.lift-card:hover` on the cards whose reveal wrapper is also the card.
      // Dropping the inline transform and the `reveal` class together hands the
      // element back to its own classes; clearing the transform without removing
      // the class would snap it back to the CSS pre-state instead.
      onComplete: () => {
        node.style.transform = '';
        node.classList.remove('reveal');
      },
    });
  }, [inView, reduce, delay]);

  return (
    <div id={id} ref={ref} className={cn('reveal', className)}>
      {children}
    </div>
  );
}
