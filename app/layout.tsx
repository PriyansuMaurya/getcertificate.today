import type { Metadata } from 'next';
import { Manrope, Fraunces } from 'next/font/google';
import { Suspense } from 'react';
import { AnalyticsComponents } from '@/components/analytics';
import './globals.css';

// Fonts imported from the Figma design (getcertificate.today, landing-page 6:9)
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  variable: '--font-fraunces',
});

const SITE_URL = 'https://getcertificate.today';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'getcertificate.today - Turn YouTube learning into verifiable credentials',
  description:
    'Paste any YouTube video. Watch it in the learning player, pass an AI-generated assessment, and earn a shareable verified certificate. Learn Today. Go Further.',
  // Canonical is set per page, NOT here: a layout-level `alternates` leaks
  // `canonical: '/'` onto every child page that omits its own. Social defaults
  // below are safe to inherit except `url`, which would mislabel every child
  // page as the homepage - so og:url is set per page instead.
  openGraph: {
    type: 'website',
    siteName: 'getcertificate.today',
    title: 'getcertificate.today - Turn YouTube learning into verifiable credentials',
    description:
      'Paste any YouTube video. Watch it in the learning player, pass an AI-generated assessment, and earn a shareable verified certificate.',
    images: [
      {
        url: '/figma/hero.png',
        width: 1536,
        height: 1024,
        alt: 'getcertificate.today product preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'getcertificate.today - Turn YouTube learning into verifiable credentials',
    description:
      'Paste any YouTube video, pass an AI-generated assessment, and earn a shareable verified certificate.',
    images: ['/figma/hero.png'],
  },
};

// Organization + WebSite JSON-LD (entity clarity for Google and AI search).
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'getcertificate.today',
      url: SITE_URL,
      logo: `${SITE_URL}/figma/logo.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'getcertificate.today',
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="en">
      <body className={`${manrope.variable} ${fraunces.variable} font-manrope antialiased`}>
        {/* Google Tag Manager noscript fallback (the GoogleTagManager component
            only injects the head script). Renders nothing when unset. */}
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // Escape '<' so no static value can ever close the script element.
            __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c'),
          }}
        />
        {children}
        <Suspense>
          <AnalyticsComponents />
        </Suspense>
      </body>
    </html>
  );
}
