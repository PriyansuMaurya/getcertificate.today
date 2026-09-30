import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { credentialsTable } from '@/utils/db/schema';
import RevokeCredentialButton from '@/components/certificates/RevokeCredentialButton';
import { ArrowRight, BadgeCheck, ExternalLink, QrCode } from 'lucide-react';

export const metadata = {
  title: 'Certificates | getcertificate.today',
  description: 'Your earned, verifiable credentials.',
};

export default async function CertificatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const credentials = await db
    .select({
      id: credentialsTable.id,
      item_title: credentialsTable.item_title,
      score: credentialsTable.score,
      status: credentialsTable.status,
      passed_at: credentialsTable.passed_at,
      learning_item_id: credentialsTable.learning_item_id,
    })
    .from(credentialsTable)
    .where(eq(credentialsTable.user_id, user.id))
    .orderBy(desc(credentialsTable.passed_at));

  return (
    <main className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Credentials</p>
          <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Certificates</h1>
          <p className="text-sm text-clay sm:text-base">
            Every credential carries a unique ID, an integrity hash, and a public verification link
            anyone can check.
          </p>
        </div>

        <section aria-label="Earned credentials" className="mt-8">
          {credentials.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sandline bg-paper px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-linen text-ink">
                <BadgeCheck aria-hidden="true" className="h-6 w-6" />
              </span>
              <h2 className="font-fraunces text-xl font-bold text-ink">No certificates yet</h2>
              <p className="max-w-md text-sm text-clay">
                Watch a course to 80%, pass the AI assessment, and your first credential will appear
                here.
              </p>
              <Link
                href="/dashboard/learning"
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
              >
                Start learning
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {credentials.map((cred) => (
                <li
                  key={cred.id}
                  className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-fraunces text-lg font-bold text-ink">
                          {cred.item_title}
                        </h2>
                        <span
                          className={
                            cred.status === 'active'
                              ? 'rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold text-cream'
                              : 'rounded-full border border-sandline bg-cream px-2.5 py-0.5 text-[11px] font-bold text-clay'
                          }
                        >
                          {cred.status === 'active' ? 'Valid' : 'Revoked'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-clay">
                        Score {cred.score}% · Issued{' '}
                        {cred.passed_at.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}{' '}
                        · ID {cred.id.slice(0, 8)}…
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/certificates/${cred.id}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
                      >
                        View certificate
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                      <a
                        href={`/verify/${cred.id}`}
                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-sandline px-4 text-sm font-semibold text-clay transition-colors hover:border-ink hover:text-ink"
                      >
                        <QrCode aria-hidden="true" className="h-4 w-4" />
                        Verify
                        <ExternalLink aria-hidden="true" className="h-3 w-3" />
                      </a>
                      <RevokeCredentialButton
                        credentialId={cred.id}
                        active={cred.status === 'active'}
                      />
                    </div>
                  </div>

                  <Link
                    href={`/learn/${cred.learning_item_id}`}
                    className="mt-3 inline-block text-xs text-clay underline underline-offset-4 hover:text-ink"
                  >
                    Revisit the course
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
