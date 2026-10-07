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
  // NOTE: intentionally no <noscript> GTM iframe here. The old fallback
  // loaded Google Tag Manager for no-JS visitors without consent, which
  // contradicts the cookie banner (analytics is opt-in until accepted -
  // see components/analytics/ConsentGate.tsx and /cookie-policy). GTM now
  // loads only through that consent gate.
  return (
    // `suppressHydrationWarning` belongs on <html> specifically because of the
    // marker script below: it adds a `js` class to this element before React
    // hydrates, so the DOM has an attribute the server render did not and React
    // reports a hydration mismatch on it. That is the documented remedy for a
    // pre-paint script that mutates <html> (the same reason next-themes asks for
    // this attribute). The suppression is scoped to this element's own
    // attributes, so everything below it is still diffed and reported normally.
    // Two consequences worth knowing: a future `className` on <html> would be
    // silently swallowed here, and this warning is development-only, so a broken
    // assumption below would go unnoticed in production.
    //
    // The assumption that matters: React leaves the `js` class in place, because
    // hydration compares the props it rendered rather than pruning attributes it
    // never rendered. If a future React release reconciled the root element's
    // attributes instead, the class would be dropped, `.js .reveal` would stop
    // matching, and every scroll reveal would quietly become a no-op (animating an
    // already-visible element). Nothing static can assert that, so it is named
    // here to make a future break diagnosable.
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${fraunces.variable} font-manrope antialiased`}>
        {/* Marks the document as script-capable at parse time, which is what lets
            the scroll-reveal pre-state be gated on it (`.js .reveal` in
            globals.css). Without this the reveal would have to hide its content in
            the server HTML, so a visitor without JavaScript - or a crawler that
            does not execute scripts - would get blank sections. First child of
            body, and not async/defer: a parser-inserted inline script executes at
            its own DOM position, so this runs before anything below it is painted.
            (That is ordering of the served HTML, not a React guarantee.) */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
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
