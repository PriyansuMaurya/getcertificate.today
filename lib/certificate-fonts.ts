import { DM_Sans, DM_Serif_Display, DM_Serif_Text, Mrs_Saint_Delafield } from 'next/font/google';

/**
 * Type families for the canvas certificate document (see lib/certificate-draw.ts).
 * Self-hosted via next/font so the certificate renders without any external
 * font requests, matching the original Certificate Generator design.
 */

export const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cert-dm-serif-display',
});

export const dmSerifText = DM_Serif_Text({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cert-dm-serif-text',
});

export const dmSans = DM_Sans({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cert-dm-sans',
});

export const mrsSaintDelafield = Mrs_Saint_Delafield({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cert-mrs-saint-delafield',
});

/**
 * Class string that exposes the four font CSS variables. Apply to any ancestor
 * of the certificate canvas - resolveCertificateFonts() reads the variables
 * back via getComputedStyle to build the canvas `font` strings.
 */
export const certificateFontClass = [
  dmSerifDisplay.variable,
  dmSerifText.variable,
  dmSans.variable,
  mrsSaintDelafield.variable,
].join(' ');
