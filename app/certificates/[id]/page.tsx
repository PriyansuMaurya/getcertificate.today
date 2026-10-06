import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { credentialsTable, usersTable } from '@/utils/db/schema';
import { createClient } from '@/utils/supabase/server';
import { verifyCredentialHash } from '@/utils/credentials';
import { getSettings } from '@/utils/settings';
import CertificateCanvas from '@/components/certificates/CertificateCanvas';
import CertificateQR, { buildCertificateQrSvg } from '@/components/certificates/CertificateQR';
import { formatCertDate, type CertificateContent } from '@/lib/certificate-draw';
import { BadgeCheck, QrCode } from 'lucide-react';

// Certificate pages must always reflect live status (e.g. revocation) - no
// static caching of DB reads.
export const dynamic = 'force-dynamic';

/** Truncate at a word boundary and append an ellipsis when over `max` chars. */
function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

// Holder/course-specific social card: this page is the artifact shared to
// LinkedIn, so the OG title/description must describe THIS certificate, not
// inherit the homepage card. The page body re-queries below (force-dynamic,
// so no stale-cache risk; the extra read is one indexed primary-key lookup).
// og:image itself is file-based: ./opengraph-image.tsx renders the actual
// certificate (file convention takes precedence over openGraph.images below,
// which remains only as a Twitter-card fallback).
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
      title: 'Certificate not found | getcertificate.today',
      description: 'This certificate could not be found.',
      alternates: { canonical: `/certificates/${id}` },
      robots: { index: false },
    };
  }

  // holder_name and item_title are user-controlled and unbounded - clamp the
  // composed strings so SERPs/social cards don't truncate mid-word.
  const title = clamp(`${cred.item_title} - ${cred.holder_name} | getcertificate.today`, 60);
  const description = clamp(
    cred.status === 'revoked'
      ? `Credential issued to ${cred.holder_name} for ${cred.item_title} (${cred.score}% score) - REVOKED and no longer valid.`
      : `${cred.holder_name} scored ${cred.score}% on the ${cred.item_title} assessment. Verifiable credential issued by getcertificate.today.`,
    160
  );
  // LinkedIn strips pre-filled share text, so the link preview card (og:title /
  // og:description) is the only place the first-person achievement copy shows.
  // Only a fully valid credential may claim completion - revoked or hash-invalid
  // cards fall back to the neutral title/description (same gate the share button
  // uses via `validity` in the page body).
  const shareable = cred.status !== 'revoked' && verifyCredentialHash(cred);
  const ogTitle = shareable
    ? clamp(`I have successfully completed ${cred.item_title} | getcertificate.today`, 70)
    : title;
  const ogDescription = shareable
    ? clamp(
        `I scored ${cred.score}% on the ${cred.item_title} assessment and earned a verifiable certificate from getcertificate.today.`,
        160
      )
    : description;
  return {
    title,
    description,
    alternates: { canonical: `/certificates/${id}` },
    openGraph: {
      type: 'article',
      siteName: 'getcertificate.today',
      title: ogTitle,
      description: ogDescription,
      url: `/certificates/${id}`,
      images: [
        {
          url: '/figma/hero.png',
          width: 1536,
          height: 1024,
          alt: 'getcertificate.today certificate preview',
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

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

/**
 * Public certificate presentation (FR-E3). The page itself is public - anyone
 * who holds the link can open it and read the verification summary - but the
 * certificate DOCUMENT (the canvas plus its Download/Share controls) is
 * private: only its holder, or an admin, may render it. Follows DESIGN.md §12:
 * brand tokens, full data set, monochrome QR with adjacent URL text, explicit
 * validity state, print-friendly (rules in globals.css `@media print`).
 */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Anonymous viewers are simply not the holder: the page never redirects, the
  // details panel below stays public (same trust model as the /verify page).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = await db.select().from(credentialsTable).where(eq(credentialsTable.id, id));
  const cred = rows[0];
  if (!cred) notFound();

  // Gate for the certificate document only: the holder always, admins (for
  // moderation) too. The role is read server-side from the DB on every render -
  // never trusted from anything the client sends.
  let canViewCertificate = Boolean(user && cred.user_id === user.id);
  if (user && !canViewCertificate) {
    const adminRows = await db
      .select({ role: usersTable.role, suspendedAt: usersTable.suspended_at })
      .from(usersTable)
      .where(eq(usersTable.id, user.id));
    canViewCertificate = adminRows[0]?.role === 'admin' && adminRows[0]?.suspendedAt === null;
  }

  // Live admin pass mark for the details panel.
  const { passScore } = await getSettings();

  // Recompute the integrity hash before rendering a "valid" state (RULES §18.2).
  const hashValid = verifyCredentialHash(cred);
  const validity: 'valid' | 'revoked' | 'invalid' = !hashValid
    ? 'invalid'
    : cred.status === 'revoked'
      ? 'revoked'
      : 'valid';

  const verifyUrl = `${PUBLIC_URL}/verify/${cred.id}`;
  const certificateUrl = `${PUBLIC_URL}/certificates/${cred.id}`;
  // Suggested LinkedIn post text - copied to the clipboard by the share button
  // (LinkedIn no longer accepts pre-filled commentary in share URLs). The URL is
  // deliberately omitted: LinkedIn's composer already injects it alongside the
  // preview card, so including it would show the link twice.
  const linkedinShareText = `I have successfully completed "${cred.item_title}" with a score of ${cred.score}% on getcertificate.today.`;
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

  // Exact canvas certificate content (FR-E3): the document itself is the
  // 1536x1024 canvas replica of the Certificate Generator design.
  const certificateContent: CertificateContent = {
    name: cred.holder_name,
    course: cred.item_title,
    dateText: formatCertDate(
      `${cred.passed_at.getFullYear()}-${String(cred.passed_at.getMonth() + 1).padStart(2, '0')}-${String(cred.passed_at.getDate()).padStart(2, '0')}`
    ),
    url: verifyUrl,
    linkText: verifyUrl.replace(/^https?:\/\//i, ''),
    motto: 'Learn Today. Go further.',
    watermark: true,
  };

  return (
    <main className="min-h-screen bg-cream text-ink print:bg-white">
      {/* Minimal top bar - stripped when printing. */}
      <header
        data-print-hide
        className="sticky top-0 z-40 h-20 border-b border-sandline bg-cream/95 backdrop-blur print:hidden"
      >
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 xl:px-20">
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/figma/logo-no-tagline.svg"
              alt="getcertificate.today logo"
              width={1339}
              height={767}
              priority
              unoptimized
              className="h-8 w-auto sm:h-10"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/verify/${cred.id}`}
              className="text-sm font-semibold text-ink underline underline-offset-4"
            >
              Verify online
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 print:max-w-none print:p-0">
        {/* Validity state (screen only - PDF exports carry it as a watermark) */}
        <div data-print-hide className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${validityBanner.cls}`}
          >
            {validityBanner.text}
          </span>
          <p className="flex items-center gap-1.5 text-xs text-clay">
            <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Integrity hash: <span className="font-mono">{cred.hash.slice(0, 26)}…</span>
          </p>
        </div>

        {/* Certificate document: exact canvas replica of the generator design.
            Rendered only for the holder/admin - the public gets the details
            panel below instead (the document itself is the private part). */}
        <article className="print:w-full">
          {canViewCertificate && (
            <CertificateCanvas
              content={certificateContent}
              validityLabel={validityBanner.text}
              validityVariant={validity}
              shareUrl={validity === 'valid' ? certificateUrl : undefined}
              shareText={validity === 'valid' ? linkedinShareText : undefined}
            />
          )}

          <h1 className="sr-only">
            Certificate of completion for {cred.holder_name} - {cred.item_title}
          </h1>
        </article>

        {/* Credential details + verification (screen only, stripped when printing) */}
        <section
          data-print-hide
          className="mt-8 rounded-2xl border border-sandline bg-paper p-6 shadow-figma-pro sm:p-8"
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sand">Score</p>
              <p className="mt-1 font-fraunces text-3xl font-black text-ink">{cred.score}%</p>
              <p className="text-xs text-clay">{passScore}% required</p>
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

          {/* Vector QR + selectable URL (accessibility: the canvas QR has no
              text equivalent; this also stays sharp if printed separately). */}
          <div className="mt-6 flex flex-col items-start gap-5 border-t border-sandline pt-6 sm:flex-row sm:items-center">
            {qrSvg && <CertificateQR svg={qrSvg} url={verifyUrl} />}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <QrCode aria-hidden="true" className="h-4 w-4" />
                Scan to verify
              </p>
              <p className="mt-1 text-xs text-clay">
                The QR and link open the public verification page:
              </p>
              <a
                href={verifyUrl}
                className="mt-1 break-all text-sm text-ink underline underline-offset-4"
              >
                {verifyUrl}
              </a>
            </div>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-clay">
            Issued by getcertificate.today - turning YouTube video minutes into verifiable
            professional credentials. This certificate attests to an assessed result on the named
            content; it is not an accredited academic qualification.
          </p>
        </section>

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
