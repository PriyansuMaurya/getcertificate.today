// QR rendering for certificate/verification URLs (FR-E4). Uses the `qrcode`
// lib's SVG output - monochrome `ink` on `paper`, quiet zone preserved, per
// DESIGN.md §12.3. The SVG string is built server-side from a URL we construct
// (no user HTML), then rendered by the sync component below.
import QRCode from 'qrcode';

export async function buildCertificateQrSvg(url: string, size = 160): Promise<string | null> {
  try {
    return await QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      width: size,
      color: { dark: '#1A1A1A', light: '#FAF8F5' },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('[qr] render failed:', err instanceof Error ? err.message : 'unknown error');
    return null;
  }
}

export default function CertificateQR({ svg, url }: { svg: string; url: string }) {
  return (
    <div
      role="img"
      aria-label={`QR code linking to ${url}`}
      className="inline-block rounded-lg border border-sandline bg-paper p-2"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
