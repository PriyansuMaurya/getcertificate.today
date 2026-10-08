import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { attemptsTable, credentialsTable, learningItemsTable, usersTable } from '@/utils/db/schema';
import { hasCredentialQuotaRemaining, isAdminAccount, monthWindowStart } from '@/utils/credentials';
import { monthlyCertificateLimit, planLabel } from '@/utils/plans';
import { getReferralCreditBalance } from '@/utils/referrals';
import { getSettings } from '@/utils/settings';
import { requireActiveUser } from '@/utils/auth';
import MintCredentialButton from '@/components/learn/MintCredentialButton';
import { ArrowRight, BadgeCheck, RotateCcw } from 'lucide-react';

export const metadata = {
  title: 'Assessment result | getcertificate.today',
  description: 'Your score and the credential you earned.',
};

export default async function AssessmentResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { id } = await params;
  const { attempt: attemptId } = await searchParams;

  // Sign-in + admin-suspension gate.
  const user = await requireActiveUser();
  if (!attemptId) redirect(`/learn/${id}`);

  const attemptRows = await db
    .select()
    .from(attemptsTable)
    .where(and(eq(attemptsTable.id, attemptId), eq(attemptsTable.user_id, user.id)));
  const attempt = attemptRows[0];
  if (!attempt || attempt.learning_item_id !== id) notFound();

  const [itemRows, credentialRows, profileRows] = await Promise.all([
    db.select().from(learningItemsTable).where(eq(learningItemsTable.id, id)),
    db
      .select()
      .from(credentialsTable)
      .where(and(eq(credentialsTable.user_id, user.id), eq(credentialsTable.learning_item_id, id))),
    db.select().from(usersTable).where(eq(usersTable.id, user.id)),
  ]);
  const item = itemRows[0];
  const credential = credentialRows[0];
  const profile = profileRows[0];

  // Live admin settings: pass mark for the score card and the free quota limit.
  const { passScore, freeCredentialsPerMonth } = await getSettings();

  // Earned referral credits extend the free-tier allowance (0 for paid tiers,
  // which use their own fixed limits). Best-effort lookup.
  let referralCredits = 0;
  try {
    referralCredits = await getReferralCreditBalance(user.id);
  } catch (err) {
    console.error(
      '[referral] credit balance lookup failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
  }

  // Quota state for passing attempts with no credential yet.
  let quotaBlocked = false;
  if (attempt.passed && !credential) {
    const credsThisMonth = await db
      .select({ id: credentialsTable.id })
      .from(credentialsTable)
      .where(
        and(
          eq(credentialsTable.user_id, user.id),
          gte(credentialsTable.passed_at, monthWindowStart())
        )
      );
    // Admins are exempt from the free quota (unlimited), so they never see the
    // upgrade prompt - mirrors the enforcement in app/learn/actions.ts using the
    // shared admin rule (requireActiveUser already gated suspended accounts).
    quotaBlocked = !hasCredentialQuotaRemaining(
      credsThisMonth.length,
      profile?.plan ?? 'none',
      freeCredentialsPerMonth,
      isAdminAccount(profile?.role, profile?.suspended_at),
      referralCredits
    );
  }

  // Plan-aware copy for the quota-blocked state (Free / Starter / Pro).
  const planName = planLabel(profile?.plan);
  const monthlyLimit = monthlyCertificateLimit(
    profile?.plan,
    freeCredentialsPerMonth,
    referralCredits
  );

  const passed = attempt.passed;

  return (
    <main className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-sandline bg-paper p-6 text-center sm:p-10">
          <span
            className={
              passed
                ? 'mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream'
                : 'mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-linen text-clay'
            }
          >
            <BadgeCheck aria-hidden="true" className="h-7 w-7" />
          </span>

          <p className="mt-5 text-[13px] font-bold uppercase tracking-wider text-sand">
            {passed ? 'Assessment passed' : 'Not quite there yet'}
          </p>
          <h1 className="mt-2 font-fraunces text-3xl font-black text-ink sm:text-4xl">
            {item?.title ?? 'Your assessment'}
          </h1>

          <div className="mt-6 flex items-center justify-center gap-8">
            <div>
              <p className="font-fraunces text-5xl font-black text-ink">{attempt.score}%</p>
              <p className="mt-1 text-xs text-clay">Your score</p>
            </div>
            <div className="h-14 w-px bg-sandline" aria-hidden="true" />
            <div>
              <p className="font-fraunces text-5xl font-black text-ink">{passScore}%</p>
              <p className="mt-1 text-xs text-clay">Pass mark</p>
            </div>
          </div>

          <p className="mt-6 text-sm text-clay">
            {passed
              ? 'Passed. Your answers were scored on the server and saved.'
              : 'Review the course and try again - your progress is saved and the assessment stays unlocked.'}
          </p>

          {/* Credential outcome */}
          <div className="mt-8">
            {passed && credential && (
              <Link
                href={`/certificates/${credential.id}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-7 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
              >
                View your certificate
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            )}

            {passed && !credential && !quotaBlocked && (
              <MintCredentialButton attemptId={attempt.id} />
            )}

            {passed && !credential && quotaBlocked && (
              <div className="rounded-xl border border-sandline bg-cream p-5 text-left">
                <p className="text-sm font-semibold text-ink">Passed - credential pending quota</p>
                <p className="mt-1.5 text-sm text-clay">
                  You have used your {planName} plan allowance of {monthlyLimit}{' '}
                  {monthlyLimit === 1 ? 'certificate' : 'certificates'} this month. Upgrade your
                  plan to mint this credential now, or wait until next month.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/subscribe"
                    className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
                  >
                    Upgrade plan
                  </Link>
                  <MintCredentialButton attemptId={attempt.id} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-sandline pt-6">
            <Link
              href={`/learn/${id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4 hover:text-clay"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Review course
            </Link>
            <Link
              href="/dashboard/certificates"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4 hover:text-clay"
            >
              <BadgeCheck aria-hidden="true" className="h-4 w-4" />
              All certificates
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
