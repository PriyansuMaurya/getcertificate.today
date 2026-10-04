import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/server';
import { hasCompletedOnboarding } from '@/app/auth/onboarding-status';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';
import { deriveProfileDefaults, pickAvailableUsername } from '@/app/auth/user-bootstrap';
import OnboardingForm from '@/components/OnboardingForm';

export const metadata = {
  title: 'Complete Your Profile | getcertificate.today',
  description: 'Set up your username and personal details for your certificates',
};

export default async function Onboarding() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (await hasCompletedOnboarding(user.id)) {
    redirect('/dashboard');
  }

  const existing = await db
    .select({
      username: usersTable.username,
      first_name: usersTable.first_name,
      last_name: usersTable.last_name,
      dob: usersTable.dob,
    })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  const profile = existing[0];

  // No row yet (the user record is only created when onboarding completes):
  // derive pre-fill defaults from the auth record's provider metadata instead
  // - first/last name from Google/GitHub (or the sign-up name), and a unique
  // username candidate so the form still arrives mostly filled in.
  let defaultUsername = profile?.username ?? undefined;
  let defaultFirstName = profile?.first_name ?? undefined;
  let defaultLastName = profile?.last_name ?? undefined;
  if (!profile) {
    const defaults = deriveProfileDefaults(user);
    defaultFirstName = defaults.firstName;
    defaultLastName = defaults.lastName;
    defaultUsername = (await pickAvailableUsername(defaults.username ?? null)) ?? undefined;
  }
  const defaultDob = profile?.dob ? new Date(profile.dob).toISOString().split('T')[0] : undefined;

  // Password signups already agreed at /signup (timestamp stored in auth
  // metadata); OAuth users have never seen a consent checkbox - show it here
  // so every account records terms acceptance exactly once.
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const showConsent = !(
    typeof metadata?.terms_consented_at === 'string' && metadata.terms_consented_at
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-[480px] rounded-2xl border border-sandline bg-paper p-8 shadow-figma-hero sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Image
              src="/figma/logo.png"
              alt="getcertificate.today"
              width={180}
              height={40}
              priority
              className="h-9 w-auto sm:h-10"
            />
          </Link>
          <h1 className="mt-6 font-fraunces text-2xl font-bold leading-tight text-ink sm:text-3xl">
            Complete your profile
          </h1>
          <p className="mt-2 text-sm text-clay">
            Enter your details as they should appear on your verified certificates
          </p>
        </div>

        <div className="mt-8">
          <OnboardingForm
            defaultUsername={defaultUsername}
            defaultFirstName={defaultFirstName}
            defaultLastName={defaultLastName}
            defaultDob={defaultDob}
            showConsent={showConsent}
          />
        </div>

        {/* Exit hatch: the pending-onboarding cookie keeps the middleware from
            bouncing / back into /dashboard (which redirects straight back
            here), so this link now actually escapes the form. */}
        <p className="mt-6 text-center text-sm text-clay">
          Not ready yet?{' '}
          <Link
            href="/"
            className="font-semibold text-ink underline underline-offset-4 hover:text-clay"
          >
            Browse the site first
          </Link>{' '}
          - you can finish your profile anytime.
        </p>
      </div>
    </div>
  );
}
