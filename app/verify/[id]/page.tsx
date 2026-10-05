import Link from 'next/link';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { credentialsTable } from '@/utils/db/schema';
import { verifyCredentialHash } from '@/utils/credentials';
import { getSettings } from '@/utils/settings';
import { BadgeCheck, ShieldCheck, ShieldX, SearchX } from 'lucide-react';

// Metadata is generated per credential in generateMetadata below.

// Verification must reflect live revocation/hash state - never cached.
export const dynamic = 'force-dynamic';

/** Truncate at a word boundary and append an ellipsis when over `max` chars. */
function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

// Holder/course-specific social card for shared verification links. Not-found
// states are noindexed (soft-404 URLs); found states stay indexable so an
// employer searching the holder/course can reach the verification.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const rows = await db.select().from(credentialsTable).where(eq(credentialsTable.id, id));
  const cred = rows[0];

  if (!cred) {
    return {
      title: 'Credential not found | getcertificate.today',
      description: 'No credential with this ID exists.',
      alternates: { canonical: `/verify/${id}` },
      robots: { index: false },
    };
  }

  // Compose with clamps: holder_name/item_title are user-controlled and can
  // overflow SERP limits, and a revoked credential must not advertise as valid.
  const title = clamp(`Verify: ${cred.item_title} - ${cred.holder_name}`, 60);
  const description = clamp(
    cred.status === 'revoked'
      ? `Credential issued to ${cred.holder_name} for ${cred.item_title} - REVOKED and no longer valid.`
      : `Public verification of the credential issued to ${cred.holder_name} for ${cred.item_title} (${cred.score}% score) by getcertificate.today.`,
    160
  );
  return {
    title,
    description,
    alternates: { canonical: `/verify/${id}` },
    openGraph: {
      type: 'website',
      siteName: 'getcertificate.today',
      title,
      description,
      url: `/verify/${id}`,
      images: [
        {
          url: '/figma/hero.png',
          width: 1536,
          height: 1024,
          alt: 'getcertificate.today credential preview',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/figma/hero.png'],
    },
  };
}

/**
 * Public verification (FR-F1) - no account needed. Shows the minimal data set
 * (holder, course, score, date, ID, validity) and never any assessment
 * internals. Hash is recomputed server-side before declaring "valid".
 */
export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await db.select().from(credentialsTable).where(eq(credentialsTable.id, id));
  const cred = rows[0];

  // Live admin pass mark shown alongside the holder's score.
  const { passScore } = await getSettings();

  const notFoundState = !cred;
  const hashValid = cred ? verifyCredentialHash(cred) : false;
  const validity = notFoundState
    ? 'not-found'
    : !hashValid
      ? 'invalid'
      : cred.status === 'revoked'
        ? 'revoked'
        : 'valid';

  const statePresentation = {
    valid: {
      icon: ShieldCheck,
      heading: 'Credential is valid',
      detail: 'This credential exists, its integrity hash matches, and it has not been revoked.',
      badge: 'bg-ink text-cream',
      iconCls: 'text-ink',
    },
    revoked: {
      icon: ShieldX,
      heading: 'Credential has been revoked',
      detail:
        'This credential was issued but has since been revoked by its owner. It should not be trusted as current proof.',
      badge: 'bg-clay text-cream',
      iconCls: 'text-clay',
    },
    invalid: {
      icon: ShieldX,
      heading: 'Integrity check failed',
      detail:
        'A credential with this ID exists, but its stored data does not match its integrity hash. The record may have been altered - do not trust it.',
      badge: 'bg-red-700 text-white',
      iconCls: 'text-red-700',
    },
    'not-found': {
      icon: SearchX,
      heading: 'Credential not found',
      detail:
        'No credential with this ID exists. Check the link or QR code - credential IDs are case-sensitive.',
      badge: 'bg-linen text-clay',
      iconCls: 'text-clay',
    },
  }[validity];

  const StateIcon = statePresentation.icon;

  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-40 h-20 border-b border-sandline bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 xl:px-20">
          <Link href="/" className="text-sm font-bold text-ink">
            getcertificate.today
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sand">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Credential verification
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[640px] px-4 py-10 sm:px-6 sm:py-16">
        <section className="rounded-2xl border border-sandline bg-paper p-6 shadow-figma-hero sm:p-10">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream">
              <StateIcon aria-hidden="true" className={`h-7 w-7 ${statePresentation.iconCls}`} />
            </span>
            <span
              className={`mt-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${statePresentation.badge}`}
            >
              {validity === 'valid'
                ? 'Valid'
                : validity === 'revoked'
                  ? 'Revoked'
                  : validity === 'invalid'
                    ? 'Invalid'
                    : 'Not found'}
            </span>
            <h1 className="mt-3 font-fraunces text-2xl font-black text-ink sm:text-3xl">
              {statePresentation.heading}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-clay">{statePresentation.detail}</p>
          </div>

          {/* For a hash mismatch, show only the ID - repeating the claimed data
              would lend credibility to a tampered record. */}
          {cred && validity !== 'not-found' && validity !== 'invalid' && (
            <dl className="mt-8 flex flex-col gap-4 border-t border-sandline pt-6">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-sand">Holder</dt>
                <dd className="text-right text-sm font-semibold text-ink">{cred.holder_name}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-sand">Course</dt>
                <dd className="text-right text-sm font-semibold text-ink">{cred.item_title}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-sand">Score</dt>
                <dd className="text-right text-sm font-semibold text-ink">
                  {cred.score}% <span className="text-clay">(pass mark {passScore}%)</span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-sand">Issued</dt>
                <dd className="text-right text-sm font-semibold text-ink">
                  {cred.passed_at.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-sand">
                  Credential ID
                </dt>
                <dd className="break-all text-right font-mono text-xs text-ink">{cred.id}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-sand">Status</dt>
                <dd className="text-right text-sm font-semibold text-ink">
                  {cred.status === 'active' ? 'Active' : 'Revoked'}
                </dd>
              </div>
            </dl>
          )}

          {cred && validity === 'invalid' && (
            <div className="mt-8 border-t border-sandline pt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-sand">
                Credential ID (untrusted)
              </p>
              <p className="mt-1 break-all font-mono text-xs text-ink">{cred.id}</p>
            </div>
          )}

          {validity === 'not-found' && (
            <div className="mt-8 rounded-xl bg-cream p-5 text-center">
              <p className="flex items-center justify-center gap-2 text-sm text-clay">
                <BadgeCheck aria-hidden="true" className="h-4 w-4" />
                Looking for your own credentials?
              </p>
              <Link
                href="/dashboard/certificates"
                className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
              >
                Sign in to view certificates
              </Link>
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs leading-relaxed text-clay">
          This page shows only what is needed to verify a credential. Assessment questions and
          personal details beyond the holder name are never shown.
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          {cred && (
            <Link
              href={`/certificates/${cred.id}`}
              className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-clay"
            >
              View certificate
            </Link>
          )}
          <Link
            href="/"
            className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-clay"
          >
            About getcertificate.today
          </Link>
        </div>
      </div>
    </main>
  );
}
