import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRightIcon,
  SparklesIcon,
  BrainIcon,
  ShieldIcon,
  ChartColumnIcon,
  CheckIcon,
} from '@/components/icons';
import MobileNav from '@/components/MobileNav';
import { PLANS } from '@/components/SubscribePricingCards';

// Implemented 1:1 from the Figma design (getcertificate.today, landing-page frame 6:9, 1440x4477).
// All colors, typography, spacing, radii, borders, shadows and assets are taken from the
// Figma node tree - the design is the visual source of truth.

const NAV_LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
];

const STEPS = [
  {
    num: '01',
    title: 'Paste YouTube Link',
    body: 'Found an incredible tutorial series or lecture? Just drop the URL into getcertificate.today.',
  },
  {
    num: '02',
    title: 'Watch & Learn',
    body: 'Our system tracks your viewing progress within the customized split-screen player to ensure you grasp the material.',
  },
  {
    num: '03',
    title: 'Pass AI Assessment & Earn',
    body: 'Once you cross 80% completion, unlock a highly tailored dynamic assessment to prove your competence and mint your credential.',
  },
];

const FEATURES = [
  {
    icon: BrainIcon,
    title: 'AI-Powered Assessments',
    body: "We parse the video transcripts to generate highly relevant, non-cheatable questions specific to the creator's syllabus.",
  },
  {
    icon: ShieldIcon,
    title: 'Verifiable Public Records',
    body: 'Every minted certificate has a cryptographic hash and quick-verify QR code. Link it directly to your LinkedIn profile.',
  },
  {
    icon: ChartColumnIcon,
    title: 'Engagement Milestones',
    body: 'Progress tracking ensures learners actually spend the time mastering chapters before attempting the exam.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      '“I learned Kubernetes entirely through YouTube, but recruiters needed proof. getcertificate.today was the bridge. Secured my Devops engineer role within weeks.”',
    name: 'Priyanshu Maurya',
    role: 'DevOps Engineer',
  },
  {
    quote:
      '“An absolute game-changer. I now turn all standard React crash courses into certified achievements. Our team uses it to track internal developer training.”',
    name: 'Sarah Chen',
    role: 'VP of Engineering',
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
    ],
  },
];

export const revalidate = 3600;

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
      {/* ============ Navbar (Figma: 1440x80 incl. 1px inside bottom border) ============ */}
      <header className="relative h-20 border-b border-sandline bg-cream">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 xl:px-20">
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
          <nav className="hidden items-center gap-8 lg:flex xl:gap-10">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-[15px] font-semibold leading-[1.366] text-ink transition-colors hover:text-clay"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <Link
              href="/login"
              className="text-[15px] font-semibold leading-[1.366] text-ink transition-colors hover:text-clay"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="flex h-12 items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-cream transition-colors hover:bg-ink/90"
            >
              Get Started
            </Link>
          </div>
          <MobileNav />
        </div>
      </header>

      <main id="main-content">
        {/* ============ Hero (Figma: pad 96/80, gap 64; left col 642px, gaps 32/16) ============ */}
        <section className="bg-cream">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 px-4 py-16 sm:px-6 md:gap-16 md:py-[97px] lg:flex-row xl:px-20">
            <div className="flex flex-1 flex-col gap-8 lg:flex-[1.12_1_0%]">
              <div className="flex flex-col gap-4">
                <h1 className="text-balance font-fraunces text-[40px] font-black leading-[1.233] text-ink sm:text-[48px] md:text-[56px] lg:text-[64px]">
                  Turn your YouTube learning into verifiable credentials.
                </h1>
                <p className="text-base leading-[1.366] text-clay sm:text-lg sm:leading-[1.366]">
                  Describe a field of study. Watch educational videos on YouTube. Pass AI-generated
                  assessments tailored to the content, and earn official shareable certificates.
                  Learn Today. Go Further.
                </p>
              </div>
              <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                <Link
                  href="/signup"
                  className="flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-cream transition-colors hover:bg-ink/90"
                >
                  Get Started Free
                  <ArrowRightIcon className="h-4 w-4 shrink-0" />
                </Link>
                <Link
                  href="#pricing"
                  className="flex h-12 w-full items-center justify-center rounded-lg border-[1.5px] border-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-ink transition-colors hover:bg-ink/5 sm:w-auto"
                >
                  Explore Credentials
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <SparklesIcon className="h-5 w-5 shrink-0 text-sand" />
                <p className="text-sm font-semibold leading-[1.366] text-clay">
                  No credit card required. 1 Cert/month free forever.
                </p>
              </div>
            </div>
            {/* Figma: 574x407 rectangle, image fill scale=STRETCH, r8, shadow 0 2 8 #6B6059@5% */}
            <div className="relative aspect-[574/407] w-full max-w-[574px] lg:flex-[1_1_0%]">
              <Image
                src="/figma/hero.png"
                alt="getcertificate.today product preview"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 574px"
                className="rounded-lg object-fill shadow-figma-hero"
              />
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
                <p className="text-[13px] font-bold leading-[1.366] text-sand">
                  Guaranteed Authenticity
                </p>
                <h2 className="font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
                  Engineered for credible learning.
                </h2>
                <p className="text-base leading-[1.366] text-clay">
                  YouTube contains the world&apos;s finest educational library. We build the
                  infrastructure to convert those video minutes into certified value recognized by
                  employers worldwide.
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
        </section>

        {/* ============ Testimonials (Figma: bg #FAF8F5, pad 120/80, gap 64; cards r16, pad 40, gap 32) ============ */}
        <section className="bg-paper">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-16 md:py-[118.5px] xl:px-20">
            <div className="flex flex-col items-center gap-4">
              <p className="text-[13px] font-bold leading-[1.366] text-sand">Success Stories</p>
              <h2 className="text-center font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
                Validated by self-taught achievers.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col gap-8 rounded-2xl border border-sandline bg-cream p-10"
                >
                  <p className="font-fraunces text-lg leading-[1.233] text-ink">{t.quote}</p>
                  <div className="flex flex-col gap-1">
                    <p className="text-[15px] font-bold leading-[1.366] text-ink">{t.name}</p>
                    <p className="text-[13px] leading-[1.366] text-clay">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ Pricing (Figma: bg #F5F0EB, pad 120/80, gap 64; cards r16, pad 48, gap 32) ============ */}
        <section id="pricing" className="bg-cream">
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
                      : 'max-w-[400px] border border-sandline bg-paper',
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
              Unlock real value from the tutorials you&apos;re already watching. Take the first
              step.
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
                src="/figma/logo.png"
                alt="getcertificate.today logo"
                width={180}
                height={40}
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
              Verifiable credentialing platform built for self-directed builders.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
