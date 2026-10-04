import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | getcertificate.today',
  description: 'How getcertificate.today collects, uses, and protects your data.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'website',
    siteName: 'getcertificate.today',
    title: 'Privacy Policy | getcertificate.today',
    description: 'How getcertificate.today collects, uses, and protects your data.',
    url: '/privacy',
    images: [{ url: '/figma/hero.png', width: 1536, height: 1024 }],
  },
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'Who we are',
    body: [
      'getcertificate.today is the data controller for the personal data described below. Contact for privacy questions and data requests: maurya.builds+getcertificate@gmail.com.',
    ],
  },
  {
    heading: 'What we collect, and why',
    body: [
      'Email address - to create your account, sign you in, and send transactional messages (password resets, receipts). Without it we cannot run your account (contractual necessity).',
      'Name (and your chosen username, first/last name, date of birth) - to create your account, print certificates in your name, pre-fill your profile, and verify you meet our minimum age of 13 (contractual necessity; age check is a legal requirement).',
      'Social sign-in profile fields (public name/email from Google or GitHub) - the same account purposes, when you choose social sign-in instead of a password.',
      'Learning data: videos you add, watch progress, assessment attempts, and credentials you earn - to run the learning player, unlock assessments, and issue your certificates (contractual necessity).',
      'Payment data: subscriptions are processed by Stripe. We store only Stripe customer and subscription identifiers - never card numbers - so we can show your plan and manage billing (contractual necessity).',
      'Usage analytics (page views, approximate location from IP): only if you consent to analytics cookies, to understand which pages are useful (consent; withdrawable at any time via the cookie settings described in our Cookie Policy).',
      'Transcripts of the public YouTube videos you choose to study - to generate your assessment questions (contractual necessity).',
    ],
  },
  {
    heading: 'How we use it',
    body: [
      'To run your account: sign you in, track progress, generate AI assessments, and issue certificates.',
      'To improve the product: aggregated, non-identifying usage trends.',
      'We do not sell your personal data and we do not use it for advertising.',
    ],
  },
  {
    heading: 'Who processes it',
    body: [
      'Supabase (database, authentication), Stripe (payments), our AI provider (assessment generation from video transcripts you choose to study), TranscriptAPI (fetching public video transcripts), Vercel (hosting and cookieless analytics), and Google Analytics (only if you consent).',
      'Each provider processes data only to deliver its service to us, under its own privacy policy.',
      'This site uses YouTube embeds. YouTube video content belongs to its creators; we do not control it. Learn more about Google and YouTube data handling in Google\u2019s privacy policy at policies.google.com/privacy.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Access: email us and we will tell you what personal data we hold about you.',
      'Correction: most profile details (name, username) can be edited directly in dashboard settings; for anything else, email us.',
      'Deletion: use \u201cDelete my account\u201d in dashboard settings to remove your profile, learning records, attempts, and credentials immediately and sign you out. Settings deletion cannot remove the login record itself - email us and we will remove that too, or do the whole deletion for you.',
      'Portability and withdrawal of consent: email us. Withdrawing analytics consent just means clearing the cookie choice (see our Cookie Policy).',
      'Questions or data requests: contact maurya.builds+getcertificate@gmail.com. We respond within 30 days.',
    ],
  },
  {
    heading: 'Cookies',
    body: [
      'We use strictly necessary cookies for sign-in sessions, plus optional analytics cookies that load only if you accept them. Full details, including how to change your choice, are in our Cookie Policy.',
    ],
  },
  {
    heading: 'Data retention',
    body: [
      'We keep account and learning data until you delete your account (see Your rights). Payment records are retained as long as Stripe and tax law require. Server logs are rotated on a rolling basis.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'The service is not directed at children under 13, and we do not knowingly collect data from them. Accounts require a date of birth proving you are at least 13.',
    ],
  },
];

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm leading-[1.366] text-clay">Last updated: October 2026</p>
        <div className="mt-10 flex flex-col gap-8">
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
            href="/terms"
            className="text-[15px] font-semibold leading-[1.366] text-ink transition-colors hover:text-clay"
          >
            Terms of Service
          </Link>
          <Link
            href="/cookie-policy"
            className="text-[15px] font-semibold leading-[1.366] text-ink transition-colors hover:text-clay"
          >
            Cookie Policy
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
