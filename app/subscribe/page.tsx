import StripePricingTable from '@/components/StripePricingTable';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { createStripeCheckoutSession } from '@/utils/stripe/api';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Pricing & Plans | getcertificate.today',
  description: 'Upgrade your learning with unlimited certificates and deep-syllabus assessments',
};

export default async function Subscribe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const checkoutSessionSecret = await createStripeCheckoutSession(user!.email!);

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

        <div className="mx-auto mt-10 w-full max-w-[1200px] rounded-2xl border border-sandline bg-paper p-6 shadow-figma-hero sm:p-10">
          <StripePricingTable checkoutSessionSecret={checkoutSessionSecret} />
        </div>
      </div>
    </div>
  );
}
