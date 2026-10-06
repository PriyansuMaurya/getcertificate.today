// Certificate-specific Open Graph image (LinkedIn link preview). File-based
// metadata convention: this route overrides the openGraph.images fallback in
// generateMetadata, so scrapers see THIS certificate - paper texture, holder
// name, course, score, validity state and a scannable verify QR - instead of
// the generic hero.png. Server-rendered (ImageResponse): the canvas renderer
// in lib/certificate-draw.ts is client-only, so this reproduces the design's
// key content in satori JSX at LinkedIn's 1.91:1 size.
//
// The card IS the certificate document, so it is gated: only the holder (or an
// admin) gets the personalised card; everyone else - including every anonymous
// social scraper - gets a neutral brand card (see viewerMayViewCertificate).
//
// Structure: all I/O (DB, fonts, assets, QR) happens in gather() behind a
// try/catch; JSX construction happens strictly outside it (React lint rule:
// errors thrown while constructing JSX would not be caught by that catch).
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db } from '@/utils/db/db';
import { credentialsTable } from '@/utils/db/schema';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/utils/auth';
import { verifyCredentialHash } from '@/utils/credentials';
import { getSettings } from '@/utils/settings';
import { formatCertDate } from '@/lib/certificate-draw';

export const runtime = 'nodejs';
// Status can flip (revocation) after first render - never serve a cached card.
// `revalidate = 0` is the documented metadata-file way to opt out of caching
// (`dynamic` is not part of the opengraph-image export contract).
export const revalidate = 0;
export const alt = 'Certificate of completion from getcertificate.today';
export const size = { width: 1200, height: 627 };
export const contentType = 'image/png';

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

/** Truncate at a word boundary (same behaviour as the page's clamp). */
function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' };

// Brand fonts (DM Serif Display + DM Sans) from Google Fonts, fetched once per
// process. Failure degrades to satori's built-in font rather than breaking the
// preview. All @font-face downloads run in parallel.
//
// The User-Agent matters: satori cannot parse woff2 (it throws "Unsupported
// OpenType signature wOF2", which 500s the route), and Google's CSS API
// negotiates the font format by UA sniffing. A legacy UA makes it serve TTF,
// which satori accepts; if the response still contains .woff2 URLs, we drop
// the faces and fall back to the built-in font instead of crashing.
let fontsPromise: Promise<OgFont[]> | null = null;
function loadFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      try {
        // Minimal legacy UA: verified to make Google's CSS API serve TTF
        // (Chrome/6-style UAs get .woff, IE UAs get .eot - neither parses).
        const UA = 'Mozilla/5.0 (Windows NT 6.1)';
        const css = await fetch(
          'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;700&display=swap',
          { headers: { 'User-Agent': UA } }
        ).then((r) => r.text());
        // satori cannot render woff/eot/woff2 - bail out (and use no custom
        // fonts) rather than hand it something unparseable. Reset the cache so
        // a transient/odd response is retried on the next request.
        if (!css.includes('.ttf') || css.includes('.woff')) {
          fontsPromise = null;
          return [];
        }

        type Face = { name: string; url: string; weight: 400 | 700 };
        const entries: Face[] = [];
        const seen = new Set<string>();
        const re = /@font-face\s*{([^}]+)}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(css)) !== null) {
          const body = m[1];
          const name = /font-family:\s*['"]?([^;'"]+)/.exec(body)?.[1]?.trim();
          const weight = Number(/font-weight:\s*(\d+)/.exec(body)?.[1] ?? '400');
          const url = /url\(([^)]+)\)/.exec(body)?.[1]?.replace(/['"]/g, '');
          const range = /unicode-range:\s*([^;]+)/.exec(body)?.[1] ?? '';
          if (!name || !url) continue;
          // Only hand satori TrueType; any other format degrades to no fonts.
          if (!url.endsWith('.ttf')) {
            fontsPromise = null;
            return [];
          }
          // Latin subset only (the certificate is English).
          if (range && !range.includes('U+0000-00FF')) continue;
          const w = weight === 700 ? 700 : 400;
          if (seen.has(`${name}:${w}`)) continue;
          seen.add(`${name}:${w}`);
          entries.push({ name, url, weight: w });
        }

        const faces = await Promise.all(
          entries.map(async (f) => ({
            name: f.name,
            weight: f.weight,
            style: 'normal' as const,
            data: await fetch(f.url).then((r) => r.arrayBuffer()),
          }))
        );
        // An empty result (transient network failure or a format satori can't
        // parse) must not be cached for the process lifetime - let the next
        // request retry.
        if (faces.length === 0) fontsPromise = null;
        return faces;
      } catch (err) {
        console.error('[og] font load failed:', err instanceof Error ? err.message : 'unknown');
        // Don't cache a failed attempt - retry on the next request.
        fontsPromise = null;
        return [];
      }
    })();
  }
  return fontsPromise;
}

// Static public assets -> base64 data URIs, read once per process (the file
// route is force-dynamic, so caching avoids re-reading on every scrape).
const assetCache = new Map<string, Promise<string | null>>();
function assetUri(file: string, mime: string): Promise<string | null> {
  const key = `${file}:${mime}`;
  let cached = assetCache.get(key);
  if (!cached) {
    cached = readFile(path.join(process.cwd(), 'public', file))
      .then((buf) => `data:image/${mime};base64,${buf.toString('base64')}`)
      .catch(() => null);
    assetCache.set(key, cached);
  }
  return cached;
}

type CardData =
  // `reason` is the neutral message the fallback card shows; "not found" and
  // "restricted" are the two ways a credential yields no certificate card.
  | { found: false; reason: string }
  | {
      found: true;
      name: string;
      course: string;
      score: number;
      dateText: string;
      certUrl: string;
      status: { text: string; bg: string; fg: string };
      qr: string | null;
      paper: string | null;
      logo: string | null;
      fonts: OgFont[];
    };

/**
 * True only when the signed-in viewer is the credential's holder or an admin.
 *
 * The certificate document is private (see app/certificates/[id]/page.tsx), and
 * this card IS that document - so it must not be handed to the public. Social
 * scrapers (LinkedIn et al.) request it unauthenticated and therefore always
 * get the neutral fallback card. A malformed/absent session reads as anonymous
 * (never as an error) so a bad cookie can't break the preview.
 */
async function viewerMayViewCertificate(holderId: string): Promise<boolean> {
  const supabase = await createClient();
  const user = await supabase.auth
    .getUser()
    .then(({ data }) => data.user)
    .catch(() => null);
  if (!user) return false;
  if (user.id === holderId) return true;

  return isAdminUser(user.id);
}

/** All I/O for the card - the only part allowed inside a try/catch. */
async function gather(id: string): Promise<CardData> {
  const rows = await db.select().from(credentialsTable).where(eq(credentialsTable.id, id));
  const cred = rows[0];
  if (!cred) return { found: false, reason: 'Certificate not found' };

  // Gate before any certificate data is assembled: the public gets a neutral
  // brand card, never the document.
  if (!(await viewerMayViewCertificate(cred.user_id))) {
    return { found: false, reason: 'Certificate of completion' };
  }

  const hashValid = verifyCredentialHash(cred);
  const validity: 'valid' | 'revoked' | 'invalid' = !hashValid
    ? 'invalid'
    : cred.status === 'revoked'
      ? 'revoked'
      : 'valid';

  const verifyUrl = `${PUBLIC_URL}/verify/${cred.id}`;
  const [paper, logo, fonts, qr] = await Promise.all([
    assetUri('cert/paper.jpg', 'jpeg'),
    assetUri('cert/logo.png', 'png'),
    loadFonts(),
    QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 260,
      errorCorrectionLevel: 'M',
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    }).catch(() => null),
  ]);

  const status =
    validity === 'valid'
      ? { text: 'VALID CREDENTIAL', bg: '#1A1A1A', fg: '#F5F0EB' }
      : validity === 'revoked'
        ? { text: 'REVOKED CREDENTIAL', bg: '#6B6059', fg: '#F5F0EB' }
        : { text: 'INTEGRITY CHECK FAILED', bg: '#DC2626', fg: '#FFFFFF' };

  return {
    found: true,
    name: clamp(cred.holder_name, 28),
    course: clamp(cred.item_title, 55),
    score: cred.score,
    dateText: formatCertDate(
      `${cred.passed_at.getFullYear()}-${String(cred.passed_at.getMonth() + 1).padStart(2, '0')}-${String(cred.passed_at.getDate()).padStart(2, '0')}`
    ),
    certUrl: `${PUBLIC_URL.replace(/^https?:\/\//, '')}/certificates/${cred.id}`,
    status,
    qr,
    paper,
    logo,
    fonts,
  };
}

function fontOpts(fonts: OgFont[]) {
  return fonts.length ? { fonts } : {};
}

function FallbackCard({ reason, fonts }: { reason: string; fonts: OgFont[] }) {
  // Never request a family that isn't in the fonts array - satori throws on
  // unresolvable font families (this card is itself the safety net).
  const serif = fonts.length > 0 ? 'DM Serif Display' : undefined;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#F5F0EB',
        gap: 28,
      }}
    >
      <div style={{ display: 'flex', fontSize: 44, color: '#1A1A1A', fontFamily: serif }}>
        {reason}
      </div>
      <div style={{ display: 'flex', fontSize: 24, color: '#6B6059' }}>getcertificate.today</div>
    </div>
  );
}

function CertificateCard({
  data,
  passScore,
}: {
  data: Extract<CardData, { found: true }>;
  passScore: number;
}) {
  const hasFonts = data.fonts.length > 0;
  const serif = hasFonts ? 'DM Serif Display' : undefined;
  const sans = hasFonts ? 'DM Sans' : undefined;
  const bold = hasFonts ? 700 : 400;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#E8E4DD',
      }}
    >
      {/* Paper texture + warm wash, mirroring the certificate canvas. */}
      {data.paper && (
        // next/image is not usable inside ImageResponse (satori needs raw src).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.paper}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'flex',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(255,254,250,0.24)',
          display: 'flex',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          position: 'relative',
          width: '100%',
          height: '100%',
          padding: '48px 56px',
        }}
      >
        {/* Left: brand + achievement */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 740,
            height: '100%',
            paddingRight: 44,
            borderRightWidth: 1,
            borderRightStyle: 'solid',
            borderRightColor: 'rgba(148,128,111,0.55)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- raw img required by ImageResponse
              <img src={data.logo} alt="" width={106} height={60} style={{ display: 'flex' }} />
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: 32,
                width: 700,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 16,
                  fontWeight: bold,
                  letterSpacing: 4,
                  color: '#6B6059',
                  fontFamily: sans,
                }}
              >
                CERTIFICATE OF COMPLETION
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 58,
                  color: '#1A1A1A',
                  marginTop: 14,
                  fontFamily: serif,
                }}
              >
                {data.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  width: 420,
                  height: 2,
                  backgroundColor: 'rgba(148,128,111,0.9)',
                  marginTop: 18,
                  marginBottom: 18,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  fontSize: 14,
                  fontWeight: bold,
                  letterSpacing: 3.5,
                  color: '#6B6059',
                  fontFamily: sans,
                }}
              >
                HAS COMPLETED
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 34,
                  color: '#1A1A1A',
                  marginTop: 8,
                  fontFamily: serif,
                }}
              >
                {data.course}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 13,
                  fontWeight: bold,
                  letterSpacing: 3,
                  color: '#B5A08E',
                  fontFamily: sans,
                }}
              >
                ISSUED ON
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 20,
                  color: '#1A1A1A',
                  marginLeft: 14,
                  fontFamily: serif,
                }}
              >
                {data.dateText}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 21,
                color: '#6B6059',
                marginTop: 12,
                fontFamily: sans,
              }}
            >
              {data.certUrl}
            </div>
          </div>
        </div>

        {/* Right: validity, score, verify QR */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '100%',
            paddingLeft: 44,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              borderRadius: 999,
              padding: '11px 24px',
              backgroundColor: data.status.bg,
              color: data.status.fg,
              fontSize: 15,
              fontWeight: bold,
              letterSpacing: 3,
              fontFamily: sans,
            }}
          >
            {data.status.text}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 148,
                height: 148,
                borderRadius: 999,
                borderWidth: 3,
                borderStyle: 'solid',
                borderColor: 'rgba(148,128,111,0.9)',
                backgroundColor: 'rgba(255,255,255,0.55)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 46,
                  color: '#1A1A1A',
                  fontFamily: serif,
                }}
              >
                {data.score}%
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 12,
                  fontWeight: bold,
                  letterSpacing: 2.5,
                  color: '#6B6059',
                  marginTop: 2,
                  fontFamily: sans,
                }}
              >
                SCORE
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 12,
                color: '#6B6059',
                marginTop: 10,
                fontFamily: sans,
              }}
            >
              {passScore}% required to pass
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {data.qr && (
              // Padding/border on the wrapper div, not the img - satori's img
              // box model ignores/mishandles padding.
              <div
                style={{
                  display: 'flex',
                  borderRadius: 8,
                  padding: 8,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#E3DCD5',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- raw img required by ImageResponse */}
                <img src={data.qr} alt="" width={140} height={140} style={{ display: 'flex' }} />
              </div>
            )}
            <div
              style={{
                display: 'flex',
                fontSize: 13,
                fontWeight: bold,
                letterSpacing: 3,
                color: '#6B6059',
                marginTop: 12,
                fontFamily: sans,
              }}
            >
              SCAN TO VERIFY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Stage 1: I/O only (inside try/catch). JSX is never constructed in here -
  // react-hooks/error-boundaries: JSX built inside a try/catch isn't protected
  // by it anyway.
  let card: Extract<CardData, { found: true }> | null = null;
  let failureReason: string | null = null;
  // Live admin pass mark; defaults to the historical value if settings are
  // unreadable so the card still renders.
  let passScore = 70;
  try {
    const [data, settings] = await Promise.all([gather(id), getSettings()]);
    if (data.found) {
      card = data;
      passScore = settings.passScore;
    } else {
      failureReason = data.reason;
    }
  } catch (err) {
    console.error('[og] certificate image failed:', err instanceof Error ? err.message : err);
    failureReason = 'Certificate preview unavailable';
  }

  // Stage 2: all JSX is built outside try/catch (by the components below).
  const fonts = card ? card.fonts : await loadFonts();
  const element = card ? (
    <CertificateCard data={card} passScore={passScore} />
  ) : (
    <FallbackCard reason={failureReason ?? 'Certificate preview unavailable'} fonts={fonts} />
  );
  const opts = { ...size, ...fontOpts(fonts) };
  // Pre-built safety-net element so the catch below never constructs JSX.
  const safety = <FallbackCard reason="Certificate preview unavailable" fonts={fonts} />;

  // Stage 3: ImageResponse's constructor runs satori rendering and can throw
  // (unresolvable font family, style edge cases) - catch that and degrade to
  // the minimal card instead of killing the route.
  try {
    return new ImageResponse(element, opts);
  } catch (err) {
    console.error('[og] render failed:', err instanceof Error ? err.message : err);
    return new ImageResponse(safety, { ...size, ...fontOpts(fonts) });
  }
}
