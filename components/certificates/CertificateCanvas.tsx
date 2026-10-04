'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileImage, Loader2, Printer } from 'lucide-react';
import { certificateFontClass } from '@/lib/certificate-fonts';
import {
  CERT_H,
  CERT_W,
  drawValidityWatermark,
  renderCertificate,
  type CertificateContent,
  type CertificateFonts,
  type CertificateImages,
} from '@/lib/certificate-draw';

type AssetKey = 'paper' | 'logo' | 'wm';
const ASSETS: Record<AssetKey, string> = {
  paper: '/cert/paper.jpg',
  logo: '/cert/logo.png',
  wm: '/cert/watermark.png',
};

async function loadImages(): Promise<CertificateImages> {
  const load = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  const [paper, logo, wm] = await Promise.all([
    load(ASSETS.paper),
    load(ASSETS.logo),
    load(ASSETS.wm),
  ]);
  return { paper, logo, wm };
}

/**
 * next/font registers faces under hashed family names exposed through the
 * --font-cert-* CSS variables; canvas `font` strings must use those exact
 * names or the certificate silently falls back to system fonts.
 */
function resolveFonts(el: HTMLElement): CertificateFonts {
  const cs = getComputedStyle(el);
  const first = (name: string, fallback: string) => {
    const raw = cs.getPropertyValue(name).split(',')[0].trim();
    if (!raw) return fallback;
    const unquoted = raw.replace(/^['"]|['"]$/g, '');
    return unquoted ? `"${unquoted}"` : fallback;
  };
  return {
    display: first('--font-cert-dm-serif-display', '"DM Serif Display",Georgia,serif'),
    text: first('--font-cert-dm-serif-text', '"DM Serif Text",Georgia,serif'),
    sans: first('--font-cert-dm-sans', '"DM Sans",system-ui,sans-serif'),
    script: first(
      '--font-cert-mrs-saint-delafield',
      '"Mrs Saint Delafield","Snell Roundhand",cursive'
    ),
  };
}

async function ensureFontsReady(fonts: CertificateFonts): Promise<void> {
  if (!document.fonts || !document.fonts.ready) return;
  try {
    // DM Sans ships 300/400/500; the serif + script families only ship 400.
    const specs = [
      `300 100px ${fonts.sans}`,
      `400 100px ${fonts.sans}`,
      `500 100px ${fonts.sans}`,
      `400 100px ${fonts.display}`,
      `400 100px ${fonts.text}`,
      `400 100px ${fonts.script}`,
    ];
    await Promise.all(specs.map((s) => document.fonts.load(s, 'Aa1')));
    await document.fonts.ready;
  } catch {
    /* font loading is best-effort */
  }
}

function fileBase(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w\- ]+/g, '')
      .replace(/\s+/g, '-') || 'certificate'
  );
}

function saveBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function CertificateCanvas({
  content,
  validityLabel,
  validityVariant,
}: {
  content: CertificateContent;
  /** e.g. "Valid credential" - stamped as a watermark on PDF exports only. */
  validityLabel: string;
  validityVariant: 'valid' | 'revoked' | 'invalid';
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<CertificateImages | null>(null);
  const fontsRef = useRef<CertificateFonts | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null);
  const [status, setStatus] = useState('');

  // Resolve hashed font family names, load fonts + images, then draw preview.
  // Re-runs when content changes (cached assets, so redraws stay cheap).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const fonts = resolveFonts(wrap);
      fontsRef.current = fonts;
      await ensureFontsReady(fonts);
      const images = await loadImages();
      if (cancelled) return;
      imagesRef.current = images;
      const view = viewRef.current;
      if (view) {
        const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        renderCertificate(view, content, images, fonts, scale);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [content]);

  /** High-res offscreen render at 2x design scale (3072x2048). */
  const renderExport = useCallback(
    (withWatermark: boolean) => {
      const images = imagesRef.current;
      const fonts = fontsRef.current;
      if (!images || !fonts) throw new Error('certificate assets not loaded');
      const off = document.createElement('canvas');
      renderCertificate(off, content, images, fonts, 2);
      if (withWatermark) {
        const c = off.getContext('2d');
        if (c) {
          c.setTransform(2, 0, 0, 2, 0, 0);
          drawValidityWatermark(c, validityLabel, validityVariant, fonts);
        }
      }
      return off;
    },
    [content, validityLabel, validityVariant]
  );

  const onPdf = useCallback(async () => {
    setBusy('pdf');
    setStatus('Preparing PDF…');
    try {
      const fonts = fontsRef.current;
      if (fonts) await ensureFontsReady(fonts);
      const off = renderExport(true); // watermark badge on PDF only
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [CERT_W, CERT_H],
        hotfixes: ['px_scaling'],
      });
      const dataUrl = off.toDataURL('image/jpeg', 0.95);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, CERT_W, CERT_H);
      const blob = pdf.output('blob');
      saveBlob(blob, `${fileBase(content.name)}-certificate.pdf`);
      setStatus('PDF ready.');
    } catch {
      setStatus('Could not create the PDF. Try again.');
    }
    setBusy(null);
  }, [content.name, renderExport]);

  const onPng = useCallback(async () => {
    setBusy('png');
    setStatus('Preparing PNG…');
    try {
      const fonts = fontsRef.current;
      if (fonts) await ensureFontsReady(fonts);
      const off = renderExport(false); // clean certificate for PNG
      const blob: Blob | null = await new Promise((resolve) =>
        off.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) throw new Error('png encode failed');
      saveBlob(blob, `${fileBase(content.name)}-certificate.png`);
      setStatus('PNG ready.');
    } catch {
      setStatus('Could not create the PNG. Try again.');
    }
    setBusy(null);
  }, [content.name, renderExport]);

  const btn =
    'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-colors disabled:opacity-50';
  const btnPrimary = `${btn} bg-ink text-cream hover:bg-ink/90`;
  const btnAlt = `${btn} border border-ink text-ink hover:bg-ink hover:text-cream`;

  return (
    <div ref={wrapRef} className={certificateFontClass}>
      <canvas
        ref={viewRef}
        width={CERT_W}
        height={CERT_H}
        role="img"
        aria-label={`Certificate of completion for ${content.name}`}
        className="block w-full rounded-[3px] bg-[#e8e4dd] shadow-figma-pro"
        style={{ aspectRatio: '3 / 2', height: 'auto' }}
        data-print-certificate
      />

      <div data-print-hide className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!ready}
          className={btnPrimary}
        >
          <Printer aria-hidden="true" className="h-4 w-4" />
          Print
        </button>
        <button type="button" onClick={onPdf} disabled={!ready || busy !== null} className={btnAlt}>
          {busy === 'pdf' ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Download aria-hidden="true" className="h-4 w-4" />
          )}
          Download PDF
        </button>
        <button type="button" onClick={onPng} disabled={!ready || busy !== null} className={btnAlt}>
          {busy === 'png' ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <FileImage aria-hidden="true" className="h-4 w-4" />
          )}
          Download PNG
        </button>
        <span role="status" aria-live="polite" className="min-h-5 text-sm text-clay">
          {status}
        </span>
      </div>
    </div>
  );
}
