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
    heading: 'What we collect',
    body: [
      'Account data: email address, name, and date of birth you provide at sign-up, plus the public profile fields shared by Google or GitHub when you use social sign-in.',
      'Learning data: videos you add, watch progress, assessment attempts, and credentials you earn.',
      'Payment data: subscriptions are processed by Stripe. We store only Stripe customer and subscription identifiers - never card numbers.',
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
      'Supabase (database, authentication), Stripe (payments), and our AI provider (assessment generation from video transcripts you choose to study).',
      'Each provider processes data only to deliver its service to us, under its own privacy policy.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'On request, we delete your account and its profile and learning records from our database.',
      'Questions or data requests: contact maurya.builds+getcertificate@gmail.com.',
    ],
  },
  {
    heading: 'Cookies',
    body: [
      'We use strictly necessary cookies for sign-in sessions. No third-party advertising or tracking cookies.',
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
        <div className="mt-12 flex gap-4">
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
