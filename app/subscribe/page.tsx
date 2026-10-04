import SubscribePricingCards from '@/components/SubscribePricingCards';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';
import { generateStripeBillingPortalLink } from '@/utils/stripe/api';

export const metadata = {
  title: 'Pricing & Plans | getcertificate.today',
  description: 'Upgrade your learning with unlimited certificates and deep-syllabus assessments',
  alternates: { canonical: '/subscribe' },
};

export default async function Subscribe({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Was: `user!.email!` - crashed with a TypeError for signed-out visitors.
  if (!user) {
    redirect('/login');
  }

  // No users row yet means onboarding was never finished (the row - and its
  // Stripe customer - is only created by completeOnboarding once every detail
  // is supplied), so finish that first instead of selling a plan for an
  // account that cannot be attached to it.
  const rows = await db
    .select({ plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));
  if (rows.length === 0) {
    redirect('/onboarding');
  }

  // Existing subscribers should manage their plan, not buy a second one.
  const subscribed = Boolean(rows[0]?.plan && rows[0].plan !== 'none');
  let billingUrl: string | null = null;
  if (subscribed) {
    try {
      billingUrl = await generateStripeBillingPortalLink(user.email!);
    } catch (err) {
      // Customer portal disabled in Stripe settings or no Stripe customer yet -
      // fall back to the default Get Started buttons rather than a dead link.
      console.error(
        'subscribe: billing portal link failed:',
        err instanceof Error ? err.message : 'unknown error'
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <header className="sticky top-0 z-50 h-20 border-b border-sandline bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 xl:px-20">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-semibold text-clay transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
          <Link href="/" className="flex items-center">
            <Image
              src="/figma/logo.png"
              alt="getcertificate.today"
              width={180}
              height={40}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>
          <div className="hidden w-24 sm:block" />
        </div>
      </header>

      <div className="w-full px-4 py-12 sm:px-6 md:py-20">
        <div className="mx-auto max-w-[1200px] text-center">
          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Pricing Plans</p>
          <h1 className="mt-2 font-fraunces text-3xl font-black text-ink sm:text-4xl md:text-5xl">
            Upgrade your learning capacity
          </h1>
          <p className="mt-3 text-base text-clay sm:text-lg">
            Unlock unlimited credentials, in-depth AI assessments, and verified skill proof.
          </p>
        </div>

        {checkout && (
          <p
            role="status"
            className={
              checkout === 'success'
                ? 'mx-auto mt-8 max-w-[600px] rounded-lg border border-ink bg-paper p-4 text-center text-sm font-semibold text-ink'
                : 'mx-auto mt-8 max-w-[600px] rounded-lg border border-sandline bg-paper p-4 text-center text-sm text-clay'
            }
          >
            {checkout === 'success'
              ? 'Subscription active - welcome aboard!'
              : checkout === 'canceled'
                ? 'Checkout canceled. No charge was made.'
                : 'Checkout is temporarily unavailable. Please try again later.'}
          </p>
        )}

        <div className="mx-auto mt-10 w-full max-w-[1200px]">
          <SubscribePricingCards subscribed={subscribed} billingUrl={billingUrl} />
        </div>
      </div>
    </div>
  );
}
