import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { BrainIcon, ShieldIcon, ChartColumnIcon, CheckIcon } from '@/components/icons';
import MobileNav from '@/components/MobileNav';
import { PLANS } from '@/components/SubscribePricingCards';

// Sections below implement the Figma landing-page frame 6:9 (getcertificate.today), except
// the navbar and hero, which follow the revamp-hero-section reference: borderless nav with
// centered links and a square "Create yours" CTA, editorial split hero with certificate showcase.
// Colors/typography reuse the Figma design tokens (tailwind.config.ts).

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Why certificates', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
];

const STEPS = [
  {
    num: '01',
    title: 'Paste YouTube Link',
    body: 'Spotted a tutorial worth finishing? Paste its URL into getcertificate.today.',
  },
  {
    num: '02',
    title: 'Watch & Learn',
    body: 'The split-screen player tracks your progress as you watch, so you can stop and resume at any time.',
  },
  {
    num: '03',
    title: 'Pass AI Assessment & Earn',
    body: 'At 80% watch time, an AI assessment generated from the video transcript unlocks. Score 70% or higher to earn your credential.',
  },
];

const FEATURES = [
  {
    icon: BrainIcon,
    title: 'AI-Powered Assessments',
    body: "We parse the video transcripts to generate questions specific to the creator's syllabus - answers are validated server-side, so they can't be peeked at early.",
  },
  {
    icon: ShieldIcon,
    title: 'Verifiable Public Records',
    body: 'Every minted certificate has a cryptographic hash and quick-verify QR code. Share the public verification link or post it to LinkedIn.',
  },
  {
    icon: ChartColumnIcon,
    title: 'Engagement Milestones',
    body: 'Assessments unlock only after you have watched 80% of the video, so the credential reflects real time spent with the material.',
  },
];

// Footer links point only at real destinations (sections, live pages, or
// generated legal pages) - no dead href="#" items.
const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Get Started',
    links: [
      { label: 'Sign In', href: '/login' },
      { label: 'Create Account', href: '/signup' },
      { label: 'Subscribe', href: '/subscribe' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookie-policy' },
    ],
  },
];

export const revalidate = 3600;

// Title/description are inherited from the root layout; only the self-
// referencing canonical is page-specific.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  // Full object: page-level openGraph replaces the layout's wholesale
  // (Next.js merges metadata fields shallowly), so restate image/siteName.
  openGraph: {
    type: 'website',
    siteName: 'getcertificate.today',
    title: 'getcertificate.today - Turn YouTube learning into verifiable credentials',
    description:
      'Paste any YouTube video. Watch it in the learning player, pass an AI-generated assessment, and earn a shareable verified certificate.',
    url: '/',
    images: [
      {
        url: '/figma/certificate-hero-sm.jpg',
        width: 1520,
        height: 1013,
        alt: 'Example getcertificate.today certificate of completion',
      },
    ],
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-cream text-ink">
      {/* Skip link for keyboard/screen-reader users (targets <main> below). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-cream focus:shadow-figma-pro"
      >
        Skip to main content
      </a>
      {/* ============ Navbar (revamped: borderless, centered links, square "Create yours" CTA) ============ */}
      <header className="relative bg-cream">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-4 py-6 sm:px-6 xl:px-20">
          <Link
            href="/"
            className="flex shrink-0 items-center"
            aria-label="getcertificate.today home"
          >
            <Image
              src="/figma/logo-no-tagline.svg"
              alt="getcertificate.today logo"
              width={1339}
              height={767}
              priority
              unoptimized
              className="h-9 w-auto sm:h-11"
            />
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-10 text-sm text-clay md:flex"
          >
            {NAV_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-sand hover:text-ink"
            >
              Create yours
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
            <MobileNav />
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ============ Hero (revamped: editorial split, oversized serif headline,
            certificate showcase with offset accent shadow) ============ */}
        <section className="bg-cream">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:pb-24 lg:pt-24 xl:px-20">
            <div className="relative z-10 min-w-0 max-w-2xl">
              <p className="mb-8 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.28em] text-sand">
                <span aria-hidden="true" className="h-px w-12 bg-sand" />
                Learn. Certify. Grow.
              </p>
              {/* Line breaks match the reference placement (Your / next skill /
                  deserves / proof.) from lg up; below lg the headline wraps
                  naturally so narrow screens stay fluid. */}
              <h1 className="max-w-2xl text-balance font-fraunces text-[clamp(3.8rem,7vw,8.4rem)] font-black leading-[0.84] tracking-[-0.075em] text-ink">
                Your
                <br className="hidden lg:inline" /> next skill
                <br className="hidden lg:inline" /> deserves
                <br className="hidden lg:inline" />{' '}
                <em className="font-normal text-clay">proof.</em>
              </h1>
              <p className="mt-9 max-w-lg text-lg leading-8 text-clay">
                Turn the things you learn online into credentials that feel as real as the work
                behind them.
              </p>
              <div className="mt-10">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-4 bg-ink px-6 py-4 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
                >
                  Make a certificate
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"
                  />
                </Link>
              </div>
            </div>

            <div className="relative lg:pt-8">
              <div className="relative">
                <Image
                  src="/figma/certificate-hero-sm.jpg"
                  alt="Example getcertificate.today certificate of completion"
                  width={1520}
                  height={1013}
                  priority
                  sizes="(max-width: 1024px) 100vw, 710px"
                  className="block h-auto w-full shadow-[18px_22px_0_rgba(181,160,142,0.35)]"
                />
              </div>
            </div>
          </div>
        </section>
        {/* ============ HowItWorks (Figma: bg #FAF8F5, pad 120/80, gap 80; cards r12, pad 32, gap 24) ============ */}
        <section id="how-it-works" className="bg-paper">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-20 md:py-[118px] xl:px-20">
            <div className="flex flex-col items-center gap-4">
              <p className="text-[13px] font-bold leading-[1.366] text-sand">The Process</p>
              <h2 className="text-center font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
                Three steps to proof of skill.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {STEPS.map((s) => (
                <div
                  key={s.num}
                  className="flex flex-col gap-6 rounded-xl border border-sandline bg-cream p-8"
                >
                  <span className="font-fraunces text-[32px] font-normal leading-[1.233] text-sand">
                    {s.num}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-bold leading-[1.366] text-ink">{s.title}</h3>
                    <p className="text-[15px] leading-[1.366] text-clay">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* ============ Features (Figma: bg #F5F0EB, pad 120/80, gap 80) ============ */}
        <section id="features" className="bg-cream">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-20 md:py-[119.5px] xl:px-20">
            {/* Split intro: left copy 608px + empty right frame 608x100 (Figma keeps the right side empty) */}
            <div className="flex flex-col items-start gap-10 md:gap-16 lg:flex-row lg:items-center">
              <div className="flex flex-1 flex-col gap-6">
                {' '}
                <p className="text-[13px] font-bold leading-[1.366] text-sand">What you get</p>
                <h2 className="font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
                  Credentials anyone can verify.
                </h2>
                <p className="text-base leading-[1.366] text-clay">
                  YouTube holds most of the world&apos;s best how-to content. We turn the minutes
                  you actually watch into certificates with a public verification link.
                </p>
              </div>
              <div className="hidden flex-1 lg:block" />
            </div>
            {/* Three feature columns (Figma: 48px icon tiles r8 bg #EAE3DC, gap 16/8) */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex flex-col gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-linen">
                    <f.icon className="h-6 w-6 text-ink" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-bold leading-[1.366] text-ink">{f.title}</h3>
                    <p className="text-[15px] leading-[1.366] text-clay">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>{' '}
        {/* ============ Pricing (Figma: bg #F5F0EB, pad 120/80, gap 64; cards r16, pad 48, gap 32).
            Section flipped to bg-paper after the testimonials section was
            removed: features (bg-cream) and pricing were adjacent cream
            bands, so pricing takes paper and its cards take cream to keep
            the alternation and card contrast (same recipe as How It Works). */}
        <section id="pricing" className="bg-paper">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-16 md:py-[119.75px] xl:px-20">
            <div className="flex flex-col items-center gap-4">
              <p className="text-[13px] font-bold leading-[1.366] text-sand">Pricing Plans</p>
              <h2 className="text-center font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
                Simple, honest tiers.
              </h2>
            </div>
            {/* Tiers shared with /subscribe (PLANS in SubscribePricingCards). Card shell
                keeps the Figma landing styles: paper card, ink card for the popular tier. */}
            <div className="flex flex-col items-center gap-6 md:gap-8 lg:flex-row lg:items-start lg:justify-center">
              {PLANS.map((plan) => (
                <div
                  key={plan.key}
                  className={[
                    'flex w-full flex-col gap-8 rounded-2xl p-6 sm:p-8 md:p-12',
                    plan.popular
                      ? 'max-w-[420px] bg-ink shadow-figma-pro'
                      : 'max-w-[400px] border border-sandline bg-cream',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3
                        className={[
                          'text-lg font-bold leading-[1.366]',
                          plan.popular ? 'text-cream' : 'text-ink',
                        ].join(' ')}
                      >
                        {plan.name}
                      </h3>
                      {plan.popular && (
                        <span className="rounded-full bg-sand px-3 py-1 text-[11px] font-bold leading-[1.366] text-ink">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p
                      className={[
                        'text-sm leading-[1.366]',
                        plan.popular ? 'text-sand' : 'text-clay',
                      ].join(' ')}
                    >
                      {plan.tagline}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={[
                        'font-fraunces text-[48px] font-black leading-[1.233]',
                        plan.popular ? 'text-cream' : 'text-ink',
                      ].join(' ')}
                    >
                      ${plan.price}
                    </span>
                    <span
                      className={[
                        'text-[15px] leading-[1.366]',
                        plan.popular ? 'text-sand' : 'text-clay',
                      ].join(' ')}
                    >
                      / month
                    </span>
                  </div>
                  <ul className="flex flex-col gap-4">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-3">
                        <CheckIcon className="h-4 w-4 shrink-0 text-sand" />
                        <span
                          className={[
                            'text-sm leading-[1.366]',
                            plan.popular ? 'text-cream' : 'text-ink',
                          ].join(' ')}
                        >
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/subscribe"
                    className={[
                      'flex h-12 items-center justify-center rounded-lg px-6 py-3.5 text-[15px] font-bold leading-[1.366] transition-colors',
                      plan.popular
                        ? 'bg-sand text-cream hover:bg-sand/90'
                        : 'border-[1.5px] border-ink text-ink hover:bg-ink/5',
                    ].join(' ')}
                  >
                    Get Started
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* ============ CTA (Figma: bg #FAF8F5, border top+bottom #E3DCD5, pad 120/80, gap 32) ============ */}
        <section className="border-y border-sandline bg-paper">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 px-4 py-16 sm:px-6 md:gap-8 md:py-[119.25px] xl:px-20">
            <h2 className="text-center font-fraunces text-[36px] font-black leading-[1.233] text-ink sm:text-[40px] md:text-[48px]">
              Ready to certify your curiosity?
            </h2>
            <p className="max-w-[600px] text-center text-base leading-[1.366] text-clay sm:text-lg sm:leading-[1.366]">
              You already watch the tutorials. Pass the assessment and get the certificate to show
              for it.
            </p>
            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/signup"
                className="flex h-12 w-full items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-cream transition-colors hover:bg-ink/90 sm:w-auto"
              >
                Get Started Free
              </Link>
              <Link
                href="#pricing"
                className="flex h-12 w-full items-center justify-center rounded-lg border-[1.5px] border-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-ink transition-colors hover:bg-ink/5 sm:w-auto"
              >
                Compare Plans
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ============ Footer (Figma: bg #F5F0EB, pad 80/80, gap 48; divider row border-t) ============ */}
      <footer className="bg-cream">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-12 md:py-20 xl:px-20">
          <div className="flex flex-col gap-10 md:gap-12 lg:flex-row lg:justify-between">
            <div className="flex w-full max-w-[300px] flex-col gap-4">
              <Image
                src="/figma/logo-no-tagline.svg"
                alt="getcertificate.today logo"
                width={1339}
                height={767}
                unoptimized
                className="h-10 w-auto"
              />
              <p className="text-sm leading-[1.366] text-clay">
                Turning YouTube video minutes into verifiable professional credentials. Learn Today.
                Go Further.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-8 sm:gap-x-16 md:gap-x-20">
              {FOOTER_COLUMNS.map((col) => (
                <div key={col.title} className="flex flex-col gap-4">
                  <p className="text-sm font-bold leading-[1.366] text-ink">{col.title}</p>
                  {col.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="text-[13px] leading-[1.366] text-clay transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-sandline pt-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p className="text-[13px] leading-[1.366] text-clay">
              © 2026 getcertificate.today. All rights reserved.
            </p>
            <p className="text-[13px] leading-[1.366] text-clay">
              Every certificate comes with its own public verification link.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
