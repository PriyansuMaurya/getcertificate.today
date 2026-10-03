import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | getcertificate.today',
  description: 'The terms that govern your use of getcertificate.today.',
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'Your account',
    body: [
      'You must be at least 13 years old to use getcertificate.today. You are responsible for keeping your sign-in credentials secure and for all activity under your account.',
    ],
  },
  {
    heading: 'Subscriptions and billing',
    body: [
      'Paid plans are billed monthly through Stripe and renew automatically until you cancel. Cancel anytime from dashboard settings; access continues until the end of the paid period.',
      'Not happy with a charge? Email us within 14 days and we will refund it.',
    ],
  },
  {
    heading: 'Certificates and honest use',
    body: [
      'Certificates represent that you completed our AI assessment over the referenced material. You agree not to game assessments or misrepresent credentials you earn.',
      'We may revoke a certificate obtained through fraud or misuse.',
    ],
  },
  {
    heading: 'Content and third-party material',
    body: [
      "YouTube videos remain the property of their creators. We embed them under YouTube's terms; we do not claim ownership of third-party content.",
      'You retain ownership of what you create in the platform. You grant us only the license needed to operate the service.',
    ],
  },
  {
    heading: 'Disclaimer',
    body: [
      'The service is provided "as is" without warranties of any kind. We do not guarantee employment outcomes from holding a certificate. To the maximum extent permitted by law, our liability is limited to the amount you paid us in the last 12 months.',
    ],
  },
  {
    heading: 'Changes and contact',
    body: [
      'We will note material changes to these terms on this page. Continued use after changes means acceptance.',
      'Questions: maurya.builds+support@gmail.com.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="h-20 border-b border-sandline bg-cream">
        <div className="mx-auto flex h-full max-w-[1440px] items-center px-4 sm:px-6 xl:px-20">
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/figma/logo.png"
              alt="getcertificate.today logo"
              width={180}
              height={40}
              priority
              className="h-8 w-auto sm:h-10"
            />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-4 py-16 sm:px-6">
        <p className="text-[13px] font-bold leading-[1.366] text-sand">Legal</p>
        <h1 className="mt-2 font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
          Terms of Service
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
            href="/privacy"
            className="text-[15px] font-semibold leading-[1.366] text-ink transition-colors hover:text-clay"
          >
            Privacy Policy
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
