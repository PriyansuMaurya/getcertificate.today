import { create } from 'qrcode';

/**
 * Canvas renderer for the certificate document - a 1:1 TypeScript port of the
 * original Certificate Generator canvas (1536x1024 design coordinates, fonts
 * and layout measured from that design). Pure drawing code: no DOM state, no
 * React - the client component owns loading/asset lifecycle.
 *
 * Font families are passed in (not hardcoded) because next/font registers
 * faces under hashed names exposed through CSS variables; the client resolves
 * them once and threads them through every draw call.
 */

export const CERT_W = 1536;
export const CERT_H = 1024;

const INK = '#17130f';
const SOFT = '#3a342d';
const BRONZE = '148,128,111';

/** Default strings the original design was measured against. */
const DEF = {
  name: 'Priyanshu Maurya',
  course: 'Kubernetes Fundamentals',
  date: '18 SEP 2026',
  link: 'getcertificate.today/c/8F21K9P4',
  motto: 'Learn Today. Go further.',
};

export interface CertificateContent {
  name: string;
  course: string;
  /** Pre-formatted date, e.g. "18 SEP 2026". */
  dateText: string;
  /** Full URL the QR code points at. */
  url: string;
  /** Display URL shown under the QR (protocol stripped). */
  linkText: string;
  /** Signature script line. */
  motto: string;
  /** Show the "g" watermark. */
  watermark: boolean;
}

export interface CertificateFonts {
  display: string;
  text: string;
  sans: string;
  script: string;
}

export interface CertificateImages {
  paper: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  wm: HTMLImageElement | null;
}

type Ctx = CanvasRenderingContext2D;

let scratchCtx: Ctx | null = null;
function scratch(): Ctx {
  if (!scratchCtx) {
    scratchCtx = document.createElement('canvas').getContext('2d');
  }
  if (!scratchCtx) throw new Error('2d canvas context unavailable');
  return scratchCtx;
}

/* ---------- measuring helpers ---------- */
function wid(font: string, t: string): number {
  const s = scratch();
  s.font = font;
  return s.measureText(t).width;
}
function charsW(font: string, t: string): number {
  let sum = 0;
  for (let i = 0; i < t.length; i++) sum += wid(font, t[i]);
  return sum;
}
function sizeByCap(fam: string, wt: number, cap: number): number {
  const s = scratch();
  s.font = `${wt} 100px ${fam}`;
  const a = s.measureText('H').actualBoundingBoxAscent || 70;
  return (100 * cap) / a;
}
function sizeByWidth(fam: string, wt: number, text: string, w: number): number {
  return (100 * w) / wid(`${wt} 100px ${fam}`, text);
}

/** Tracked text drawn glyph by glyph; returns total width. */
function tracked(
  c: Ctx,
  t: string,
  x: number,
  y: number,
  font: string,
  track: number,
  align: 'left' | 'center'
): number {
  const ws: number[] = [];
  let tot = 0;
  for (let i = 0; i < t.length; i++) {
    ws.push(wid(font, t[i]));
    tot += ws[i];
  }
  tot += track * Math.max(0, t.length - 1);
  let px = align === 'center' ? x - tot / 2 : x;
  c.font = font;
  c.textAlign = 'left';
  for (let i = 0; i < t.length; i++) {
    c.fillText(t[i], px, y);
    px += ws[i] + track;
  }
  return tot;
}
/** Label: font size from cap height, tracking from target width. */
function label(
  c: Ctx,
  t: string,
  x: number,
  y: number,
  cap: number,
  w: number,
  wt: number,
  fonts: CertificateFonts,
  color?: string
): void {
  const s = sizeByCap(fonts.sans, wt, cap);
  const font = `${wt} ${s}px ${fonts.sans}`;
  const tr = (w - charsW(font, t)) / (t.length - 1);
  c.fillStyle = color || SOFT;
  tracked(c, t, x, y, font, tr, 'left');
}
/** Heading along a circular arc. */
function arc(
  c: Ctx,
  t: string,
  fam: string,
  cap: number,
  arcLen: number,
  rBase: number,
  cx: number,
  cy: number
): void {
  const s = sizeByCap(fam, 400, cap);
  const font = `400 ${s}px ${fam}`;
  const ws: number[] = [];
  let sum = 0;
  for (let i = 0; i < t.length; i++) {
    ws.push(wid(font, t[i]));
    sum += ws[i];
  }
  const tr = (arcLen - sum) / (t.length - 1);
  let pos = 0;
  c.font = font;
  c.textAlign = 'center';
  c.fillStyle = INK;
  press(c, true);
  for (let i = 0; i < t.length; i++) {
    const mid = pos + ws[i] / 2;
    const th = (mid - arcLen / 2) / (rBase + cap / 2);
    c.save();
    c.translate(cx + rBase * Math.sin(th), cy - rBase * Math.cos(th));
    c.rotate(th);
    c.fillText(t[i], 0, 0);
    c.restore();
    pos += ws[i] + tr;
  }
  press(c, false);
}
function rule(c: Ctx, x0: number, x1: number, y: number, orn?: boolean): void {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  const b = `rgba(${BRONZE},`;
  g.addColorStop(0, `${b}0)`);
  g.addColorStop(0.2, `${b}.95)`);
  g.addColorStop(0.8, `${b}.95)`);
  g.addColorStop(1, `${b}0)`);
  c.strokeStyle = g;
  c.lineWidth = 1.4;
  c.beginPath();
  const m = (x0 + x1) / 2;
  if (orn) {
    c.moveTo(x0, y);
    c.lineTo(m - 11, y);
    c.moveTo(m + 11, y);
    c.lineTo(x1, y);
  } else {
    c.moveTo(x0, y);
    c.lineTo(x1, y);
  }
  c.stroke();
  if (orn) {
    c.fillStyle = `rgb(${BRONZE})`;
    c.beginPath();
    c.moveTo(m, y - 4.5);
    c.lineTo(m + 4.5, y);
    c.lineTo(m, y + 4.5);
    c.lineTo(m - 4.5, y);
    c.closePath();
    c.fill();
  }
}
/** Letterpress: soft light edge under dark ink. */
function press(c: Ctx, on: boolean): void {
  c.shadowColor = on ? 'rgba(255,255,255,.85)' : 'transparent';
  c.shadowOffsetX = 0;
  c.shadowOffsetY = on ? 1.3 : 0;
  c.shadowBlur = on ? 0.4 : 0;
}

function qrRows(text: string): boolean[][] | null {
  try {
    const qr = create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const rows: boolean[][] = [];
    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let k = 0; k < size; k++) row.push(qr.modules.get(r, k) === 1);
      rows.push(row);
    }
    return rows;
  } catch {
    return null;
  }
}

/** Format a yyyy-mm-dd string as "18 SEP 2026". */
export function formatCertDate(v: string): string {
  if (!v) return '';
  const p = v.split('-');
  if (p.length < 3) return v;
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  return `${Number(p[2])} ${months[Number(p[1]) - 1]} ${p[0]}`;
}

/**
 * Draw the certificate into `c` (already scaled via setTransform; draw in
 * 1536x1024 design coordinates).
 */
export function drawCertificate(
  c: Ctx,
  state: CertificateContent,
  images: CertificateImages,
  fonts: CertificateFonts
): void {
  const W = CERT_W;
  const H = CERT_H;
  const { paper, logo, wm } = images;
  let w: number;

  if (paper && paper.naturalWidth) c.drawImage(paper, 0, 0, W, H);
  else {
    c.fillStyle = '#e8e4dd';
    c.fillRect(0, 0, W, H);
  }
  const lg = c.createRadialGradient(W * 0.5, H * 0.46, H * 0.12, W * 0.5, H * 0.5, W * 0.64);
  lg.addColorStop(0, 'rgba(255,254,250,.30)');
  lg.addColorStop(1, 'rgba(150,128,100,.11)');
  c.fillStyle = lg;
  c.fillRect(0, 0, W, H);
  if (state.watermark && wm && wm.naturalWidth) {
    c.globalAlpha = 0.36;
    c.drawImage(wm, 1171, 298, 347, 458);
    c.globalAlpha = 1;
  }
  if (logo && logo.naturalWidth) {
    c.drawImage(logo, 94, 96, 246, (246 * logo.naturalHeight) / logo.naturalWidth);
  }

  /* top-right tagline */
  const s = sizeByCap(fonts.sans, 400, 11.5);
  const font = `400 ${s}px ${fonts.sans}`;
  const tt = (103 - charsW(font, 'CERTIFY')) / 6;
  c.fillStyle = SOFT;
  (['LEARN', 'CERTIFY', 'GROW', 'TODAY'] as const).forEach((t, i) => {
    tracked(c, t, 1329, [95, 126, 157, 187][i], font, tt, 'left');
  });
  rule(c, 1328, 1413, 223.5);

  /* arched heading */
  arc(c, 'CERTIFICATE', fonts.display, 59, 662, 770.5, 770, 993);
  arc(c, 'OF COMPLETION', fonts.display, 27, 489, 713, 770, 993);
  rule(c, 652, 882, 338.5, true);

  label(c, 'THIS CERTIFIES THAT', 598, 391, 11.5, 338, 300, fonts);

  /* recipient name */
  let nSize = sizeByWidth(fonts.display, 400, DEF.name, 689);
  w = wid(`400 ${nSize}px ${fonts.display}`, state.name || ' ');
  if (w > 1000) nSize *= 1000 / w;
  c.font = `400 ${nSize}px ${fonts.display}`;
  c.textAlign = 'center';
  c.fillStyle = INK;
  press(c, true);
  c.fillText(state.name || '', 769, 512);
  press(c, false);

  label(c, 'HAS COMPLETED', 643, 580, 11, 249, 300, fonts);

  /* course */
  let cSize = sizeByWidth(fonts.text, 400, DEF.course, 646);
  w = wid(`400 ${cSize}px ${fonts.text}`, state.course || ' ');
  if (w > 1100) cSize *= 1100 / w;
  c.font = `400 ${cSize}px ${fonts.text}`;
  c.textAlign = 'center';
  c.fillStyle = INK;
  press(c, true);
  c.fillText(state.course || '', 768, 665);
  press(c, false);
  rule(c, 537, 996, 721.5, true);

  /* footer left */
  label(c, 'ISSUED ON', 91, 888, 10, 104, 300, fonts);
  let dSize = sizeByCap(fonts.text, 400, 21);
  let dFont = `400 ${dSize}px ${fonts.text}`;
  const dTr = (168 - charsW(dFont, DEF.date)) / (DEF.date.length - 1);
  const dText = state.dateText || '';
  w = charsW(dFont, dText) + dTr * Math.max(0, dText.length - 1);
  if (w > 300) {
    dSize *= 300 / w;
    dFont = `400 ${dSize}px ${fonts.text}`;
  }
  c.fillStyle = INK;
  tracked(c, dText, 91, 930, dFont, dTr, 'left');

  /* signature script */
  let sSize = sizeByWidth(fonts.script, 400, DEF.motto, 358);
  const mot = state.motto || '';
  w = wid(`400 ${sSize}px ${fonts.script}`, mot || ' ');
  if (w > 440) sSize *= 440 / w;
  c.save();
  c.translate(649, 903);
  c.rotate((-5 * Math.PI) / 180);
  c.font = `400 ${sSize}px ${fonts.script}`;
  c.textAlign = 'center';
  c.fillStyle = INK;
  c.fillText(mot, 0, 12);
  c.restore();

  /* QR + verify */
  const rows = state.url && state.url.trim() ? qrRows(state.url) : null;
  if (rows) {
    const n = rows.length;
    const cell = 85 / n;
    c.fillStyle = INK;
    for (let r = 0; r < n; r++) {
      for (let k = 0; k < n; k++) {
        if (rows[r][k]) {
          c.fillRect(1033 + k * cell - 0.2, 862 + r * cell - 0.2, cell + 0.4, cell + 0.4);
        }
      }
    }
  }
  label(c, 'VERIFY CERTIFICATE', 1147, 893, 10, 197, 300, fonts);
  let lSize = sizeByWidth(fonts.sans, 400, DEF.link, 309);
  const lt = state.linkText || '';
  w = wid(`400 ${lSize}px ${fonts.sans}`, lt || ' ');
  if (w > 340) lSize *= 340 / w;
  c.font = `400 ${lSize}px ${fonts.sans}`;
  c.textAlign = 'left';
  c.fillStyle = INK;
  c.fillText(lt, 1148, 922);
}

/** Render the certificate into a canvas at `scale` (design px * scale). */
export function renderCertificate(
  canvas: HTMLCanvasElement,
  state: CertificateContent,
  images: CertificateImages,
  fonts: CertificateFonts,
  scale: number
): void {
  canvas.width = CERT_W * scale;
  canvas.height = CERT_H * scale;
  const c = canvas.getContext('2d');
  if (!c) return;
  c.setTransform(scale, 0, 0, scale, 0, 0);
  c.textBaseline = 'alphabetic';
  drawCertificate(c, state, images, fonts);
}

/**
 * PDF-only watermark: the validity badge stamped at top center, matching the
 * on-page validity banner styling (ink pill / clay pill / red pill).
 */
export function drawValidityWatermark(
  c: Ctx,
  text: string,
  variant: 'valid' | 'revoked' | 'invalid',
  fonts: CertificateFonts
): void {
  const font = `500 34px ${fonts.sans}`;
  const track = 5;
  const upper = text.toUpperCase();
  let tw = 0;
  for (let i = 0; i < upper.length; i++) tw += wid(font, upper[i]);
  tw += track * Math.max(0, upper.length - 1);

  const padX = 44;
  const h = 76;
  const boxW = tw + padX * 2;
  const x = (CERT_W - boxW) / 2;
  const y = 48;

  const bg =
    variant === 'valid'
      ? 'rgba(23,19,15,0.86)'
      : variant === 'revoked'
        ? 'rgba(107,96,89,0.88)'
        : 'rgba(220,38,38,0.88)';

  c.save();
  c.globalAlpha = 0.9;
  c.fillStyle = bg;
  c.beginPath();
  const r = h / 2;
  c.moveTo(x + r, y);
  c.arcTo(x + boxW, y, x + boxW, y + h, r);
  c.arcTo(x + boxW, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + boxW, y, r);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.55)';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#fff';
  tracked(c, upper, CERT_W / 2, y + h / 2 + 12, font, track, 'center');
  c.restore();
}
