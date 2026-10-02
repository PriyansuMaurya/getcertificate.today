import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';
import { generateStripeBillingPortalLink, getStripePlan } from '@/utils/stripe/api';
import SettingsProfileForm from '@/components/settings/SettingsProfileForm';
import SettingsPasswordForm from '@/components/settings/SettingsPasswordForm';
import SettingsSignOutButton from '@/components/settings/SettingsSignOutButton';
import Link from 'next/link';
import { BadgeCheck, CreditCard, ShieldCheck, User } from 'lucide-react';

export const metadata = {
  title: 'Settings | getcertificate.today',
  description: 'Manage your profile, password, and subscription.',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rows = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const profile = rows[0];

  let planLabel = 'Free Explorer';
  let billingPortalURL: string | null = null;
  try {
    const plan = await getStripePlan(user.email!);
    planLabel = plan === 'none' || !plan ? 'Free Explorer' : plan;
  } catch {
    planLabel = 'Plan unavailable';
  }
  try {
    billingPortalURL = await generateStripeBillingPortalLink(user.email!);
  } catch {
    billingPortalURL = null;
  }

  const isSubscribed = Boolean(profile?.plan && profile.plan !== 'none');

  return (
    <main id="main-content" className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[840px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Account</p>
          <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Settings</h1>
          <p className="text-sm text-clay sm:text-base">
            Manage your profile, security, and subscription in one place.
          </p>
        </div>

        {/* Profile */}
        <section
          aria-labelledby="profile-heading"
          className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
              <User aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 id="profile-heading" className="font-fraunces text-xl font-bold text-ink">
                Profile
              </h2>
              <p className="text-sm text-clay">Your name and username across the platform.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="profile-email"
                className="text-xs font-bold uppercase tracking-wider text-clay"
              >
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={user.email ?? ''}
                readOnly
                disabled
                className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-clay placeholder:text-clay/60 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <p className="text-xs text-clay">Email cannot be changed here.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="profile-username"
                className="text-xs font-bold uppercase tracking-wider text-clay"
              >
                Username
              </label>
              <input
                id="profile-username"
                type="text"
                value={profile?.username ?? ''}
                readOnly
                disabled
                className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-clay placeholder:text-clay/60 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <p className="text-xs text-clay">
                Usernames are set during onboarding and used for your public profile.
              </p>
            </div>

            <SettingsProfileForm
              defaultFirstName={profile?.first_name ?? ''}
              defaultLastName={profile?.last_name ?? ''}
            />
          </div>
        </section>

        {/* Security */}
        <section
          aria-labelledby="security-heading"
          className="mt-6 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 id="security-heading" className="font-fraunces text-xl font-bold text-ink">
                Security
              </h2>
              <p className="text-sm text-clay">Change your password.</p>
            </div>
          </div>

          <div className="mt-5">
            <SettingsPasswordForm />
          </div>
        </section>

        {/* Billing */}
        <section
          aria-labelledby="billing-heading"
          className="mt-6 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
              <CreditCard aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="billing-heading" className="font-fraunces text-xl font-bold text-ink">
                Plan &amp; Billing
              </h2>
              <p className="text-sm text-clay">Your current plan and payment details.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sandline bg-cream px-3 py-1 text-xs font-bold text-ink">
                <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5 text-sand" />
                {planLabel}
              </span>
              {isSubscribed && <span className="text-xs text-clay">Professional subscriber</span>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {billingPortalURL ? (
                <a
                  href={billingPortalURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-ink px-5 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-cream"
                >
                  Manage billing
                </a>
              ) : (
                <span className="text-sm text-clay">Billing portal unavailable right now.</span>
              )}
              {!isSubscribed && (
                <Link
                  href="/subscribe"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
                >
                  Upgrade plan
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Session */}
        <section
          aria-labelledby="session-heading"
          className="mt-6 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="session-heading" className="font-fraunces text-xl font-bold text-ink">
                Session
              </h2>
              <p className="text-sm text-clay">Sign out of this device.</p>
            </div>
            <SettingsSignOutButton />
          </div>
        </section>
      </div>
    </main>
  );
}
