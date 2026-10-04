'use client';

import { useFormStatus } from 'react-dom';

/**
 * Checkout submit button with pending state. Disabled while the
 * `startCheckout` server action runs so a double-click (or impatient retry on
 * a slow network) cannot fire two checkout-session creations.
 */
export default function SubscribeCheckoutButton({ popular }: { popular: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={[
        'flex h-11 w-full items-center justify-center rounded-lg px-6 text-[15px] font-bold leading-[1.366] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        popular ? 'bg-ink text-cream hover:bg-ink/90' : 'bg-linen text-ink hover:bg-sandline',
      ].join(' ')}
    >
      {pending ? 'Redirecting to checkout…' : 'Get Started'}
    </button>
  );
}
