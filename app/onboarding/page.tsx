import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/server';
import { hasCompletedOnboarding } from '@/app/auth/actions';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';
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
            defaultUsername={profile?.username ?? undefined}
            defaultFirstName={profile?.first_name ?? undefined}
            defaultLastName={profile?.last_name ?? undefined}
            defaultDob={
              profile?.dob ? new Date(profile.dob).toISOString().split('T')[0] : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
