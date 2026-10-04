import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy | getcertificate.today',
  description: 'What cookies getcertificate.today uses and how to control them.',
  alternates: { canonical: '/cookie-policy' },
  openGraph: {
    type: 'website',
    siteName: 'getcertificate.today',
    title: 'Cookie Policy | getcertificate.today',
    description: 'What cookies getcertificate.today uses and how to control them.',
    url: '/cookie-policy',
    images: [{ url: '/figma/hero.png', width: 1536, height: 1024 }],
  },
};

type CookieRow = {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  type: string;
};

const COOKIES: CookieRow[] = [
  {
    name: 'sb-*-auth-token',
    provider: 'Supabase (first party)',
    purpose: 'Keeps you signed in securely between visits.',
    duration: 'Session, refreshed while you are signed in',
    type: 'Strictly necessary',
  },
  {
    name: 'onboarding_pending',
    provider: 'getcertificate.today (first party)',
    purpose:
      'Remembers that you are mid-signup so the site does not bounce you back to the dashboard.',
    duration: 'Session',
    type: 'Strictly necessary',
  },
  {
    name: 'cookie_consent',
    provider: 'getcertificate.today (first party)',
    purpose: 'Stores your cookie choice so we do not ask again.',
    duration: '180 days',
    type: 'Strictly necessary (functional)',
  },
  {
    name: '_ga, _ga_*',
    provider: 'Google Analytics (via Google Tag Manager)',
    purpose:
      'Anonymous usage statistics (which pages are visited). Only set if you accept analytics.',
    duration: 'Up to 2 years',
    type: 'Analytics (optional)',
  },
];

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'What cookies are',
    body: [
      'Cookies are small text files a website puts on your device. Some are required for the site to work; others are optional and used for measurement.',
    ],
  },
  {
    heading: 'How we use them',
    body: [
      'Strictly necessary cookies keep you signed in and remember your signup progress. These are always on because the service cannot work without them.',
      'Analytics cookies (Google Analytics, loaded through Google Tag Manager) help us understand which pages are useful. These are OFF until you accept them in the consent banner. If you decline, we never set them.',
      'We do not use advertising, retargeting, or cross-site tracking cookies, and we do not sell data derived from cookies.',
    ],
  },
  {
    heading: 'Vercel Analytics',
    body: [
      'We also use Vercel Analytics for privacy-friendly traffic counts. It is cookieless: it does not set cookies and does not track you across sites, so no consent is required.',
    ],
  },
  {
    heading: 'Changing your choice',
    body: [
      'To change your analytics choice, clear this site\u2019s cookies in your browser and reload any page - the consent banner will appear again. You can also block or delete cookies through your browser settings; blocking strictly necessary cookies will sign you out and break sign-in.',
    ],
  },
  {
    heading: 'Updates and contact',
    body: [
      'We will update this page if the cookies we use change. Last updated: October 2026.',
      'Questions: maurya.builds+getcertificate@gmail.com.',
    ],
  },
];

export default function CookiePolicyPage() {
  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="h-20 border-b border-sandline bg-cream">
        <div className="mx-auto flex h-full max-w-[1440px] items-center px-4 sm:px-6 xl:px-20">
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
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-4 py-16 sm:px-6">
        <p className="text-[13px] font-bold leading-[1.366] text-sand">Legal</p>
        <h1 className="mt-2 font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
          Cookie Policy
        </h1>
        <p className="mt-2 text-sm leading-[1.366] text-clay">Last updated: October 2026</p>

        <div className="mt-10 flex flex-col gap-8">
          <section className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <caption className="sr-only">Cookies used by getcertificate.today</caption>
              <thead>
                <tr className="border-b border-sandline">
                  <th scope="col" className="py-2 pr-4 font-bold text-ink">
                    Cookie
                  </th>
                  <th scope="col" className="py-2 pr-4 font-bold text-ink">
                    Provider
                  </th>
                  <th scope="col" className="py-2 pr-4 font-bold text-ink">
                    Purpose
                  </th>
                  <th scope="col" className="py-2 pr-4 font-bold text-ink">
                    Duration
                  </th>
                  <th scope="col" className="py-2 font-bold text-ink">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {COOKIES.map((c) => (
                  <tr key={c.name} className="border-b border-sandline/60 align-top">
                    <td className="py-3 pr-4 font-mono text-[13px] text-ink">{c.name}</td>
                    <td className="py-3 pr-4 text-clay">{c.provider}</td>
                    <td className="py-3 pr-4 text-clay">{c.purpose}</td>
                    <td className="py-3 pr-4 text-clay">{c.duration}</td>
                    <td className="py-3 text-clay">{c.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {SECTIONS.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="text-lg font-bold leading-[1.366] text-ink">{section.heading}</h2>
              {section.body.map((p) => (
                <p key={p} className="text-[15px] leading-[1.6] text-clay">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/privacy"
            className="text-[15px] font-semibold leading-[1.366] text-ink transition-colors hover:text-clay"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-[15px] font-semibold leading-[1.366] text-ink transition-colors hover:text-clay"
          >
            Terms of Service
          </Link>
          <Link
            href="/"
            className="text-[15px] font-semibold leading-[1.366] text-ink transition-colors hover:text-clay"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
