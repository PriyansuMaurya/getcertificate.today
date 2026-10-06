import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { BrainIcon, ShieldIcon, ChartColumnIcon, CheckIcon } from '@/components/icons';
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
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-4 py-5 sm:px-6 xl:px-20">
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
              className="h-10 w-auto sm:h-12"
            />
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-8 text-[15px] font-medium text-ink/75 md:flex xl:gap-10"
          >
            {NAV_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-sand hover:text-ink"
            >
              Earn yours
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />{' '}
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ============ Hero (editorial split: 43% copy / 57% certificate,
            vertically centered in the viewport, certificate as the primary
            visual proof with a restrained offset backing layer) ============ */}
        <section className="bg-cream">
          <div className="mx-auto flex max-w-[1440px] items-center px-4 pb-14 pt-4 sm:px-6 lg:min-h-[calc(100dvh-7rem)] lg:pb-24 xl:px-20">
            <div className="grid w-full items-center gap-8 lg:grid-cols-[43fr_57fr] lg:gap-12 xl:gap-10">
              <div className="relative z-10 min-w-0">
                <div className="mb-[31px] inline-flex items-center gap-2.5 rounded-full bg-[#fbecd9] px-4 py-2.5 text-sm font-bold text-clay">
                  <span aria-hidden="true" className="text-clay">
                    ✦
                  </span>
                  From YouTube to Verifiable Credentials
                </div>
                {/* Fraunces black carries the headline; the italic "proof." lands
                    on its own line at lg+ so the serif turn feels deliberate. */}
                {/* Fraunces black carries the headline; explicit breaks at lg+
                    set a 3-line editorial stack with "proof." on its own line. */}
                <h1 className="max-w-[15ch] text-balance font-fraunces text-[clamp(2.5rem,4.6vw,4.5rem)] font-black leading-[0.98] tracking-[-0.03em] text-ink">
                  Turn what you
                  <br className="hidden md:inline" /> learn into
                  <br className="hidden md:inline" />{' '}
                  {/* background-clip:text paints only inside the element box, so
                      the italic overhang past the last glyph renders transparent.
                      0.2em covers Fraunces italic overhang at the clamp() max size;
                      clone gives every wrapped line its own padded background box. */}
                  <em
                    className="bg-clip-text pr-[0.2em] font-normal italic text-transparent [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
                    style={{
                      backgroundImage:
                        'linear-gradient(95deg, #cfa578 0%, #b68a5e 45%, #9a6c45 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    verifiable credentials.
                  </em>
                </h1>
                <p className="mt-6 max-w-[46ch] text-base leading-7 text-ink/70 sm:text-lg sm:leading-8">
                  Learn from any YouTube video or playlist, take an AI assessment, and earn a
                  shareable certificate.
                </p>
                <div className="mt-8">
                  <Link
                    href="/signup"
                    className="group inline-flex items-center gap-3 bg-ink px-6 py-4 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
                  >
                    Earn your first credential
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"
                    />
                  </Link>
                </div>
              </div>

              {/* Certificate: offset linen backing + restrained elevation keeps the
                  cream/certificate separation without heavy effects. */}
              {/* Certificate stays strictly inside the container padding: no negative
                  margins; the backing layer's 16px offset fits within the page gutter. */}
              <div className="relative min-w-0">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 translate-x-3 translate-y-3 bg-linen sm:translate-x-4 sm:translate-y-4"
                />
                <Image
                  src="/figma/certificate-hero-sm.jpg"
                  alt="Example getcertificate.today certificate of completion"
                  width={1520}
                  height={1013}
                  priority
                  sizes="(max-width: 1024px) 100vw, 760px"
                  className="relative block h-auto w-full max-w-full border border-sandline shadow-[0_4px_12px_rgba(26,26,26,0.10),0_32px_64px_-16px_rgba(26,26,26,0.30)]"
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
