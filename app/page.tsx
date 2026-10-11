import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { BrainIcon, CheckIcon, ShieldIcon, ChartColumnIcon } from '@/components/icons';
import HeroCertificateStage from '@/components/landing/HeroCertificateStage';
import HeroLearningFlow from '@/components/landing/HeroLearningFlow';
import HeroStartForm from '@/components/landing/HeroStartForm';
import Reveal from '@/components/landing/Reveal';
import LandingPricingCards from '@/components/LandingPricingCards';

// The navbar and hero are a from-scratch centered SaaS composition on the Figma
// design tokens (tailwind.config.ts) plus one added accent, `terracotta`. The
// sections below the hero still implement the Figma landing-page frame 6:9,
// keeping its cream/paper bands and Fraunces + Manrope pairing.

// Every link resolves to a real section, page, or generated legal page - the
// navbar carries no dead hrefs.
const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'For Creators', href: '#for-creators' },
  { label: 'For Teams', href: '#for-teams' },
];

// Plain strings, not icon/label pairs: every item now wears the same cream
// check, so the icon carries no per-item meaning and pairing one with each
// entry would be decoration pretending to be information.
const HERO_BENEFITS = [
  'AI-powered assessments',
  'Shareable certificate',
  'Public verification page',
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

const AUDIENCES = [
  {
    id: 'for-creators',
    heading: 'For creators',
    body: 'Your tutorial already teaches someone something real. Finishing it with a certificate gives your viewers a reason to stay to the end - and a credential that names your course.',
    cta: { label: 'See how it works', href: '#how-it-works' },
  },
  {
    id: 'for-teams',
    heading: 'For teams',
    body: 'Point your team at the YouTube courses you already trust, and let each person finish with a certificate anyone can verify - no bespoke training platform required.',
    cta: { label: 'Compare plans', href: '#pricing' },
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

      {/* ============ Navbar ============
          A three-column grid, not justify-between: the middle column stays
          optically centered on the page no matter how wide the logo or the
          actions grow. Sticky and translucent so the pill CTA is always one
          click away while scrolling. */}
      <header className="sticky top-0 z-50 border-b border-sandline/80 bg-cream/85 backdrop-blur">
        {/* Two columns below lg, three at lg and up. The nav is `display:none`
            below lg, so with the three-column grid the actions would auto-place
            into the middle `auto` column instead of the right edge. These two
            breakpoints must stay in sync with the nav's
            `hidden ... lg:flex` - diverge and the third item wraps to a new row. */}
        <div className="mx-auto grid h-16 max-w-[1240px] grid-cols-[1fr_auto] items-center gap-2 px-5 sm:px-6 lg:h-[76px] lg:grid-cols-[1fr_auto_1fr] xl:px-8">
          <Link
            href="/"
            aria-label="getcertificate.today home"
            className="flex items-center justify-self-start"
          >
            <Image
              src="/figma/logo-no-tagline.svg"
              alt="getcertificate.today logo"
              width={1339}
              height={767}
              priority
              unoptimized
              className="h-8 w-auto lg:h-9"
            />
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center justify-center lg:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="rounded-full px-3.5 py-2 text-[15px] font-medium text-clay transition-colors hover:bg-linen/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream active:bg-linen xl:px-4"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-1.5 justify-self-end sm:gap-3">
            <Link
              href="/login"
              className="hidden rounded-full px-3 py-2 text-[15px] font-medium text-clay transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream active:text-ink sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-full bg-terracotta px-3.5 text-[13px] font-bold text-cream transition-[background-color,transform] duration-150 hover:bg-terracotta-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream active:scale-[0.98] sm:px-5 sm:text-sm"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ============ Hero ============
            One centered composition: badge, headline, description, link form,
            proof row, then the certificate stage - the centre card with four
            smaller copies fanned behind it. Motion is a single staggered load
            sequence (see globals.css), and the headline carries one drawn
            flourish: a video mark and a certificate seal joined by travelling
            arcs (HeroLearningFlow). */}
        <section className="relative overflow-hidden bg-cream">
          {/* min-height reserves 25rem of the viewport for the navbar (4.75rem)
              plus the head of the certificate stage below the fold, so the copy
              block centers itself in what is actually left over. Below lg the
              constant does not apply and the block is simply top-padded, which
              is what phones want anyway. */}
          <div className="mx-auto flex max-w-[1180px] flex-col items-center px-5 pt-14 text-center sm:pt-20 lg:min-h-[calc(100dvh-25rem)] lg:justify-center lg:pb-10 lg:pt-10">
            {/* Cream pill on a cream page, so the border is the only thing that
                makes it read as a pill. The default sandline hairline is only
                ~1.2:1 against cream and disappears; `sand` is ~2.2:1 - clearly
                visible, still restrained. It is a decorative boundary, not a
                3:1 control outline, which a non-operable badge does not need. */}
            <p className="hero-settle hero-settle-1 inline-flex items-center gap-2 rounded-full border border-sand bg-cream px-3.5 py-1.5 text-[13px] font-semibold text-terracotta">
              <span aria-hidden="true" className="leading-none">
                ✦
              </span>
              From YouTube to Verifiable Credentials
            </p>

            {/* The headline's own wrapper exists for the flow layer: the marks sit
                in the page gutter outside this box, so the box has to be the full
                column width rather than the headline's text width - otherwise the
                marks would land on the type. `hero-settle` stays on the h1 so the
                stagger order is unchanged, and the h1 is lifted above the arcs.
                The layer renders after the h1 on purpose: its flanking half is
                absolute and cannot disturb the flow, but its compact half is an
                ordinary row and has to sit under the headline on phones rather
                than above it. */}
            <div className="relative mt-7 w-full">
              {/* Manrope ExtraBold, not the Fraunces used everywhere else: the
                  hero reads as a modern sans statement, which also leaves the
                  serif to do its own work on the certificate below.
                  Two block spans rather than a <br>: the stack holds from ~560px
                  of viewport upward, and each line wraps below that.
                  The trailing space in the first span is load-bearing - strip it
                  and the DOM text silently reads "YouTubeinto" to assistive tech,
                  with nothing to catch it. */}
              <h1 className="hero-settle hero-settle-2 relative z-10 font-manrope text-[clamp(2.25rem,5.9vw,4.25rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-ink">
                <span className="block">Turn what you learn on YouTube </span>
                <span className="block">
                  into <span className="text-terracotta">verifiable certificates.</span>
                </span>
              </h1>

              <HeroLearningFlow />
            </div>

            <p className="hero-settle hero-settle-3 mt-5 max-w-[54ch] text-base leading-[1.6] text-clay sm:text-[17px]">
              Add a YouTube video or playlist, complete the learning, take an AI-generated
              assessment, and get a shareable certificate to prove your skills.
            </p>

            <div className="hero-settle hero-settle-4 mt-8 w-full max-w-[830px]">
              <HeroStartForm />
            </div>

            {/* Cream disc on a cream page, so the hairline is what makes it read
                as a disc at all - `sand` (~2.2:1) rather than the sandline
                hairline, which disappears. The check inside is terracotta. */}
            <ul className="hero-settle hero-settle-5 mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              {HERO_BENEFITS.map((label) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sand bg-cream">
                    <CheckIcon className="h-3 w-3 text-terracotta" />
                  </span>
                  <span className="text-[14px] text-clay">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Certificate stage: the hero's dominant bottom visual. */}
          <div className="mt-14 sm:mt-16 lg:mt-6">
            <HeroCertificateStage />
          </div>
        </section>

        {/* ============ HowItWorks (Figma: bg #FAF8F5, pad 120/80, gap 80; cards r12, pad 32, gap 24) ============ */}
        <section id="how-it-works" className="scroll-mt-24 bg-cream">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-20 md:py-[118px] xl:px-20">
            <Reveal className="flex flex-col items-center gap-4">
              <p className="text-[13px] font-bold leading-[1.366] text-sand">The Process</p>
              <h2 className="text-center font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
                Three steps to proof of skill.
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {STEPS.map((s, index) => (
                <Reveal
                  key={s.num}
                  delay={index * 0.06}
                  className="lift-card flex flex-col gap-6 rounded-xl border border-sandline bg-paper p-8"
                >
                  <span className="font-fraunces text-[32px] font-normal leading-[1.233] text-sand">
                    {s.num}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-bold leading-[1.366] text-ink">{s.title}</h3>
                    <p className="text-[15px] leading-[1.366] text-clay">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============ Features (Figma: bg #F5F0EB, pad 120/80, gap 80) ============ */}
        <section id="features" className="scroll-mt-24 bg-paper">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-20 md:py-[119.5px] xl:px-20">
            {/* Split intro: left copy 608px + empty right frame 608x100 (Figma keeps the right side empty) */}
            <Reveal className="flex flex-col items-start gap-10 md:gap-16 lg:flex-row lg:items-center">
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
            </Reveal>
            {/* Three feature columns (Figma: 48px icon tiles r8 bg #EAE3DC, gap 16/8).
                Revealed only: these columns have no card surface to lift, so a hover
                gesture here would move text for no information. */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {FEATURES.map((f, index) => (
                <Reveal key={f.title} delay={index * 0.06} className="flex flex-col gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-linen">
                    <f.icon className="h-6 w-6 text-ink" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-bold leading-[1.366] text-ink">{f.title}</h3>
                    <p className="text-[15px] leading-[1.366] text-clay">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============ Audiences ============
            Two hairline panels rather than two more full-band sections: the
            navbar needs a real destination for "For Creators" and "For Teams",
            and a paired band keeps that addition quiet instead of padding the
            page with two more 100px-padded blocks. */}
        <section className="bg-cream">
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-5 py-16 sm:px-6 md:gap-8 md:py-[104px] lg:grid-cols-2">
            {AUDIENCES.map((audience, index) => (
              <Reveal
                key={audience.id}
                id={audience.id}
                delay={index * 0.08}
                className="lift-card flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-sandline bg-paper p-8 sm:p-10"
              >
                <h2 className="font-fraunces text-[26px] font-bold leading-[1.2] text-ink sm:text-[30px]">
                  {audience.heading}
                </h2>
                <p className="text-[15px] leading-[1.7] text-clay">{audience.body}</p>
                <Link
                  href={audience.cta.href}
                  className="mt-1 inline-flex items-center gap-2 rounded text-[15px] font-bold text-terracotta transition-colors hover:text-terracotta-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:text-terracotta-deep"
                >
                  {audience.cta.label}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ============ Pricing (Figma: bg #F5F0EB, pad 120/80, gap 64; cards r16, pad 48, gap 32). ============ */}
        <section id="pricing" className="scroll-mt-24 bg-paper">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-16 md:py-[119.75px] xl:px-20">
            <Reveal className="flex flex-col items-center gap-4">
              <p className="text-[13px] font-bold leading-[1.366] text-sand">Pricing Plans</p>
              <h2 className="text-center font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
                Simple, honest tiers.
              </h2>
            </Reveal>
            <LandingPricingCards />
          </div>
        </section>

        {/* ============ CTA (Figma: bg #FAF8F5, border top+bottom #E3DCD5, pad 120/80, gap 32) ============ */}
        <section className="border-y border-sandline bg-cream">
          {/* The band's own column gap lives on the reveal wrapper below, so it is
              not repeated on this element with a single child to space. */}
          <div className="mx-auto flex max-w-[1440px] flex-col items-center px-4 py-16 sm:px-6 md:py-[119.25px] xl:px-20">
            <Reveal className="flex flex-col items-center gap-6 md:gap-8">
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
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-terracotta px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-cream transition-[background-color,transform] duration-150 hover:bg-terracotta-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream active:scale-[0.98] sm:w-auto"
                >
                  Get started free
                </Link>
                <Link
                  href="#pricing"
                  className="flex h-12 w-full items-center justify-center rounded-lg border-[1.5px] border-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-ink transition-[background-color,transform] duration-150 hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream active:scale-[0.98] sm:w-auto"
                >
                  Compare Plans
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ============ Footer (Figma: bg #F5F0EB, pad 80/80, gap 48; divider row border-t) ============ */}
      <footer className="bg-paper">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-12 md:py-20 xl:px-20">
          <div className="flex flex-col gap-10 md:gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
            <div className="flex w-full max-w-[320px] flex-col gap-4">
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
            {/* Grid, not a wrapping flex row: the three groups keep an even
                rhythm at every width instead of breaking 3 -> 2 -> 1 and
                drifting to the left edge. */}
            <div className="grid min-w-0 grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 sm:gap-x-12 lg:gap-x-16">
              {FOOTER_COLUMNS.map((col) => (
                <div key={col.title} className="flex flex-col gap-4">
                  <p className="text-sm font-bold leading-[1.366] text-ink">{col.title}</p>
                  {col.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="-my-2 py-2 text-[13px] leading-[1.366] text-clay transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:text-ink"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-sandline pt-6 text-center md:flex-row md:items-center md:justify-between md:gap-x-6 md:text-left">
            <p className="text-[13px] leading-[1.366] text-clay">
              © 2026 getcertificate.today. All rights reserved.
            </p>
            <p className="text-[13px] leading-[1.366] text-clay md:text-right">
              Every certificate comes with its own public verification link.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
