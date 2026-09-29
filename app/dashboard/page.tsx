import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';
import {
  ArrowRightIcon,
  BrainIcon,
  ShieldIcon,
  ChartColumnIcon,
  SparklesIcon,
  CheckIcon,
} from '@/components/icons';

export default async function Dashboard() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect('/login');
  }

  const profileRows = await db
    .select({
      username: usersTable.username,
      first_name: usersTable.first_name,
      last_name: usersTable.last_name,
      plan: usersTable.plan,
    })
    .from(usersTable)
    .where(eq(usersTable.id, data.user.id));

  const profile = profileRows[0];
  const displayName =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : (profile?.username ?? data.user.email);
  const isSubscribed = Boolean(profile && profile.plan && profile.plan !== 'none');

  return (
    <main className="min-h-[calc(100vh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 md:py-14 xl:px-20">
        {/* Top Header */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">
            Learner Workspace
          </p>
          <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">
            Welcome back, {displayName}
          </h1>
          <p className="text-base text-clay">
            Track your YouTube learning, test your comprehension, and earn verified credentials.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-4 rounded-2xl border border-sandline bg-paper p-6 shadow-figma-hero sm:p-8">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-clay">Verified Credentials</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linen text-ink">
                <ShieldIcon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="font-fraunces text-4xl font-black text-ink">0</p>
              <p className="mt-1 text-xs text-clay">Pass an assessment (80%+) to earn your first</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-sandline bg-paper p-6 shadow-figma-hero sm:p-8">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-clay">Hours Studied</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linen text-ink">
                <ChartColumnIcon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="font-fraunces text-4xl font-black text-ink">0.0h</p>
              <p className="mt-1 text-xs text-clay">YouTube tutorial watch time recorded</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-sandline bg-paper p-6 shadow-figma-hero sm:col-span-2 sm:p-8 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-clay">Account Plan</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linen text-ink">
                <SparklesIcon className="h-5 w-5 text-sand" />
              </div>
            </div>
            <div>
              <p className="font-fraunces text-3xl font-black text-ink">
                {isSubscribed ? 'Professional' : 'Free Explorer'}
              </p>
              <p className="mt-1 text-xs text-clay">
                {isSubscribed
                  ? 'Unlimited certifications & deep syllabus'
                  : '1 Certificate / mo included'}
              </p>
            </div>
          </div>
        </div>

        {/* Video Learning Action Card */}
        <div className="mt-10 rounded-2xl border border-sandline bg-paper p-8 shadow-figma-hero sm:p-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linen text-ink">
                <BrainIcon className="h-5 w-5" />
              </div>
              <h2 className="font-fraunces text-2xl font-bold text-ink sm:text-3xl">
                Add a YouTube Course
              </h2>
            </div>
            <p className="mt-3 text-sm text-clay sm:text-base">
              Drop any tutorial series, lecture, or educational playlist URL. We track your viewing
              milestones and formulate customized, syllabus-grounded assessments.
            </p>

            <form
              onSubmit={undefined}
              className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=... or playlist"
                className="h-12 flex-1 rounded-lg border border-sandline bg-cream px-4 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
                disabled
              />
              <button
                type="button"
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream opacity-90 transition-colors hover:bg-ink/90 sm:w-auto"
              >
                <span>Add Video</span>
                <ArrowRightIcon className="h-4 w-4 shrink-0" />
              </button>
            </form>
            <p className="mt-2 text-xs text-clay">
              Course ingestion engine will launch in the next release phase.
            </p>
          </div>
        </div>

        {/* Upgrade Card (if on Free plan) */}
        {!isSubscribed && (
          <div className="mt-10 rounded-2xl bg-ink p-8 text-cream shadow-figma-pro sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-2xl flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-sand px-3 py-1 text-[11px] font-bold text-ink">
                    POPULAR
                  </span>
                  <h3 className="font-fraunces text-2xl font-bold text-cream sm:text-3xl">
                    Upgrade to Professional
                  </h3>
                </div>
                <p className="text-sm text-sand sm:text-base">
                  Unlock unlimited certificates, deep-syllabus AI assessments, and instant LinkedIn
                  export badges for $12 / month.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-cream sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 shrink-0 text-sand" />
                    <span>Unlimited credentials</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 shrink-0 text-sand" />
                    <span>Deep-syllabus assessments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 shrink-0 text-sand" />
                    <span>Ad-free learning player</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 shrink-0 text-sand" />
                    <span>Resume &amp; LinkedIn export</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <Link
                  href="/subscribe"
                  className="flex h-12 items-center justify-center gap-2 rounded-lg bg-sand px-8 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-sand/90"
                >
                  <span>Go Pro ($12/mo)</span>
                  <ArrowRightIcon className="h-4 w-4 shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
