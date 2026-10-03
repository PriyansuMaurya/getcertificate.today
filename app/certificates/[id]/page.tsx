import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { credentialsTable } from '@/utils/db/schema';
import { verifyCredentialHash, PASS_SCORE } from '@/utils/credentials';
import CertificateQR, { buildCertificateQrSvg } from '@/components/certificates/CertificateQR';
import PrintCertificateButton from '@/components/certificates/PrintCertificateButton';
import { BadgeCheck, QrCode } from 'lucide-react';

// Certificate pages must always reflect live status (e.g. revocation) - no
// static caching of DB reads.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Certificate | getcertificate.today',
  description: 'A verifiable credential issued by getcertificate.today.',
};

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

/**
 * Public certificate presentation (FR-E3). No auth required - this page is the
 * artifact shared with employers. Follows DESIGN.md §12: brand tokens, full
 * data set, monochrome QR with adjacent URL text, explicit validity state,
 * print-friendly (rules in globals.css `@media print`).
 */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await db.select().from(credentialsTable).where(eq(credentialsTable.id, id));
  const cred = rows[0];
  if (!cred) notFound();

  // Recompute the integrity hash before rendering a "valid" state (RULES §18.2).
  const hashValid = verifyCredentialHash(cred);
  const validity: 'valid' | 'revoked' | 'invalid' = !hashValid
    ? 'invalid'
    : cred.status === 'revoked'
      ? 'revoked'
      : 'valid';

  const verifyUrl = `${PUBLIC_URL}/verify/${cred.id}`;
  const qrSvg = await buildCertificateQrSvg(verifyUrl);
  const issued = cred.passed_at.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const validityBanner =
    validity === 'valid'
      ? { text: 'Valid credential', cls: 'bg-ink text-cream' }
      : validity === 'revoked'
        ? { text: 'Revoked credential', cls: 'bg-clay text-cream' }
        : { text: 'Integrity check failed', cls: 'bg-red-700 text-white' };

  return (
    <main className="min-h-screen bg-cream text-ink print:bg-white">
      {/* Minimal top bar - stripped when printing. */}
      <header
        data-print-hide
        className="sticky top-0 z-40 h-20 border-b border-sandline bg-cream/95 backdrop-blur print:hidden"
      >
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 xl:px-20">
          <Link href="/" className="text-sm font-bold text-ink">
            getcertificate.today
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/verify/${cred.id}`}
              className="text-sm font-semibold text-ink underline underline-offset-4"
            >
              Verify online
            </Link>
            <PrintCertificateButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 print:max-w-none print:p-0">
        {/* Certificate document */}
        <article className="relative rounded-2xl border border-sandline bg-paper p-6 shadow-figma-pro sm:p-12 print:border-0 print:shadow-none">
          <span
            className={`absolute right-6 top-6 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider print:right-10 print:top-10 ${validityBanner.cls}`}
          >
            {validityBanner.text}
          </span>

          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">
            Certificate of Achievement
          </p>

          <p className="mt-6 text-sm text-clay">This is to certify that</p>
          <h1 className="mt-1 font-fraunces text-4xl font-black leading-tight text-ink sm:text-5xl">
            {cred.holder_name}
          </h1>

          <p className="mt-6 max-w-[640px] text-base leading-relaxed text-clay">
            has successfully completed the learning course
          </p>
          <h2 className="mt-1 font-fraunces text-2xl font-bold text-ink sm:text-3xl">
            {cred.item_title}
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-sandline pt-6 sm:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sand">Score</p>
              <p className="mt-1 font-fraunces text-3xl font-black text-ink">{cred.score}%</p>
              <p className="text-xs text-clay">{PASS_SCORE}% required</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sand">Issued</p>
              <p className="mt-1 text-sm font-semibold text-ink">{issued}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wider text-sand">Credential ID</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-ink">{cred.id}</p>
            </div>
          </div>

          {/* QR + adjacent selectable URL (DESIGN §12.3 accessibility) */}
          <div className="mt-8 flex flex-col items-start gap-5 border-t border-sandline pt-6 sm:flex-row sm:items-center">
            {qrSvg && <CertificateQR svg={qrSvg} url={verifyUrl} />}
            <div className="min-w-0">
              {qrSvg && (
                <>
                  <p className="flex items-center gap-2 text-sm font-bold text-ink">
                    <QrCode aria-hidden="true" className="h-4 w-4" />
                    Scan to verify
                  </p>
                  <p className="mt-1 text-xs text-clay">
                    The QR and link open the public verification page:
                  </p>
                </>
              )}
              {!qrSvg && <p className="text-xs text-clay">Open the public verification page:</p>}
              <a
                href={verifyUrl}
                className="mt-1 break-all text-sm text-ink underline underline-offset-4"
              >
                {verifyUrl}
              </a>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-clay">
                <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                Integrity hash: <span className="font-mono">{cred.hash.slice(0, 26)}…</span>
              </p>
            </div>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-clay">
            Issued by getcertificate.today - turning YouTube video minutes into verifiable
            professional credentials. This certificate attests to an assessed result on the named
            content; it is not an accredited academic qualification.
          </p>
        </article>

        <div
          data-print-hide
          className="mt-6 flex flex-wrap items-center justify-center gap-4 print:hidden"
        >
          <Link
            href={`/verify/${cred.id}`}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
          >
            Open verification page
          </Link>
          <Link
            href="/dashboard/certificates"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-ink px-6 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            Back to certificates
          </Link>
        </div>
      </div>
    </main>
  );
}
