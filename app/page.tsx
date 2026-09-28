import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  SparklesIcon,
  BrainIcon,
  ShieldIcon,
  ChartColumnIcon,
  CheckIcon,
} from "@/components/icons";
import MobileNav from "@/components/MobileNav";

// Implemented 1:1 from the Figma design (getcertificate.today, landing-page frame 6:9, 1440x4477).
// All colors, typography, spacing, radii, borders, shadows and assets are taken from the
// Figma node tree — the design is the visual source of truth.

const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

const STEPS = [
  {
    num: "01",
    title: "Paste YouTube Link",
    body: "Found an incredible tutorial series or lecture? Just drop the URL into getcertificate.today.",
  },
  {
    num: "02",
    title: "Watch & Learn",
    body: "Our system tracks your viewing progress within the customized split-screen player to ensure you grasp the material.",
  },
  {
    num: "03",
    title: "Pass AI Assessment & Earn",
    body: "Once you cross 80% completion, unlock a highly tailored dynamic assessment to prove your competence and mint your credential.",
  },
];

const FEATURES = [
  {
    icon: BrainIcon,
    title: "AI-Powered Assessments",
    body: "We parse the video transcripts to generate highly relevant, non-cheatable questions specific to the creator's syllabus.",
  },
  {
    icon: ShieldIcon,
    title: "Verifiable Public Records",
    body: "Every minted certificate has a cryptographic hash and quick-verify QR code. Link it directly to your LinkedIn profile.",
  },
  {
    icon: ChartColumnIcon,
    title: "Engagement Milestones",
    body: "Progress tracking ensures learners actually spend the time mastering chapters before attempting the exam.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      '"I learned Kubernetes entirely through YouTube, but recruiters needed proof. getcertificate.today was the bridge. Secured my Devops engineer role within weeks."',
    name: "Priyanshu Maurya",
    role: "DevOps Engineer",
  },
  {
    quote:
      '"An absolute game-changer. I now turn all standard React crash courses into certified achievements. Our team uses it to track internal developer training."',
    name: "Sarah Chen",
    role: "VP of Engineering",
  },
];

const FREE_FEATURES = [
  "1 Certified Credential / mo",
  "Basic AI Assessments",
  "Chrome Extension integration",
  "Standard public verification page",
];

const PRO_FEATURES = [
  "Unlimited credentials",
  "Deep-syllabus AI assessments",
  "Ad-free custom learning player",
  "Priority 24/7 Verification assistance",
  "PDF/LinkedIn resume generator export",
];

const FOOTER_COLUMNS = ["Product", "Company", "Legal"];
const FOOTER_LINKS = ["Overview", "Features", "Security"];

export const revalidate = 3600;

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-cream text-ink">
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
          <nav className="hidden items-center gap-10 xl:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-[15px] font-semibold leading-[1.366] text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-4 xl:flex">
            <Link
              href="/login"
              className="text-[15px] font-semibold leading-[1.366] text-ink"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="flex h-12 items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-cream"
            >
              Get Started
            </Link>
          </div>
          <MobileNav />
        </div>
      </header>

      {/* ============ Hero (Figma: pad 96/80, gap 64; left col 642px, gaps 32/16) ============ */}
      <section className="bg-cream">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 px-4 py-16 sm:px-6 md:gap-16 md:py-24 xl:px-20 lg:flex-row">
          <div className="flex flex-1 flex-col gap-8 lg:flex-[1.12_1_0%]">
            <div className="flex flex-col gap-4">
              <h1 className="font-fraunces text-[40px] font-black leading-[1.233] text-ink sm:text-[48px] md:text-[56px] lg:text-[64px]">
                Turn your YouTube learning into verifiable credentials.
              </h1>
              <p className="text-base leading-[1.366] text-clay sm:text-lg">
                Describe a field of study. Watch educational videos on YouTube.
                Pass AI-generated assessments tailored to the content, and earn
                official shareable certificates. Learn Today. Go Further.
              </p>
            </div>
            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/signup"
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-cream"
              >
                Get Started Free
                <ArrowRightIcon className="h-4 w-4 shrink-0" />
              </Link>
              <Link
                href="#pricing"
                className="flex h-12 w-full items-center justify-center rounded-lg border-[1.5px] border-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-ink sm:w-auto"
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
          <div className="w-full max-w-[574px] lg:flex-[1_1_0%]">
            <Image
              src="/figma/hero.png"
              alt="getcertificate.today product preview"
              width={574}
              height={407}
              priority
              className="h-auto w-full rounded-lg shadow-figma-hero"
            />
          </div>
        </div>
      </section>

      {/* ============ HowItWorks (Figma: bg #FAF8F5, pad 120/80, gap 80; cards r12, pad 32, gap 24) ============ */}
      <section id="how-it-works" className="bg-paper">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-20 md:py-[120px] xl:px-20">
          <div className="flex flex-col items-center gap-4">
            <p className="text-[13px] font-bold leading-[1.366] text-sand">
              The Process
            </p>
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
                  <h3 className="text-lg font-bold leading-[1.366] text-ink">
                    {s.title}
                  </h3>
                  <p className="text-[15px] leading-[1.366] text-clay">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Features (Figma: bg #F5F0EB, pad 120/80, gap 80) ============ */}
      <section id="features" className="bg-cream">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-20 md:py-[120px] xl:px-20">
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
                YouTube contains the world&apos;s finest educational library. We
                build the infrastructure to convert those video minutes into
                certified value recognized by employers worldwide.
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
                  <h3 className="text-lg font-bold leading-[1.366] text-ink">
                    {f.title}
                  </h3>
                  <p className="text-[15px] leading-[1.366] text-clay">
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Testimonials (Figma: bg #FAF8F5, pad 120/80, gap 64; cards r16, pad 40, gap 32) ============ */}
      <section className="bg-paper">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-16 md:py-[120px] xl:px-20">
          <div className="flex flex-col items-center gap-4">
            <p className="text-[13px] font-bold leading-[1.366] text-sand">
              Success Stories
            </p>
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
                <p className="font-fraunces text-lg leading-[1.233] text-ink">
                  {t.quote}
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-bold leading-[1.366] text-ink">
                    {t.name}
                  </p>
                  <p className="text-[13px] leading-[1.366] text-clay">
                    {t.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Pricing (Figma: bg #F5F0EB, pad 120/80, gap 64; cards r16, pad 48, gap 32) ============ */}
      <section id="pricing" className="bg-cream">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 md:gap-16 md:py-[120px] xl:px-20">
          <div className="flex flex-col items-center gap-4">
            <p className="text-[13px] font-bold leading-[1.366] text-sand">
              Pricing Plans
            </p>
            <h2 className="text-center font-fraunces text-[32px] font-bold leading-[1.233] text-ink sm:text-[40px]">
              Simple, honest tiers.
            </h2>
          </div>
          {/* Figma: cards top-aligned (counter MIN), natural heights (475 / 510) */}
          <div className="flex flex-col items-center gap-6 md:gap-8 lg:flex-row lg:items-start lg:justify-center">
            {/* Free card (Figma: 400px wide, bg #FAF8F5, border #E3DCD5, r16, pad 48) */}
            <div className="flex w-full max-w-[400px] flex-col gap-8 rounded-2xl border border-sandline bg-paper p-6 sm:p-8 md:p-12">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-bold leading-[1.366] text-ink">
                  Free Explorer
                </h3>
                <p className="text-sm leading-[1.366] text-clay">
                  Begin validating your YouTube sessions.
                </p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-fraunces text-[48px] font-black leading-[1.233] text-ink">
                  $0
                </span>
                <span className="text-[15px] leading-[1.366] text-clay">
                  / month
                </span>
              </div>
              <ul className="flex flex-col gap-4">
                {FREE_FEATURES.map((feat) => (
                  <li key={feat} className="flex items-center gap-3">
                    <CheckIcon className="h-4 w-4 shrink-0 text-sand" />
                    <span className="text-sm leading-[1.366] text-ink">
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="flex h-12 items-center justify-center rounded-lg border-[1.5px] border-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-ink"
              >
                Get Started Free
              </Link>
            </div>
            {/* Pro card (Figma: 420px wide, bg #1A1A1A, r16, pad 48, shadow 0 8 24 #6B6059@8%) */}
            <div className="flex w-full max-w-[420px] flex-col gap-8 rounded-2xl bg-ink p-6 shadow-figma-pro sm:p-8 md:p-12">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold leading-[1.366] text-cream">
                    Professional
                  </h3>
                  <span className="rounded-full bg-sand px-3 py-1 text-[11px] font-bold leading-[1.366] text-ink">
                    POPULAR
                  </span>
                </div>
                <p className="text-sm leading-[1.366] text-sand">
                  For serious self-directed learners.
                </p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-fraunces text-[48px] font-black leading-[1.233] text-cream">
                  $12
                </span>
                <span className="text-[15px] leading-[1.366] text-sand">
                  / month
                </span>
              </div>
              <ul className="flex flex-col gap-4">
                {PRO_FEATURES.map((feat) => (
                  <li key={feat} className="flex items-center gap-3">
                    <CheckIcon className="h-4 w-4 shrink-0 text-sand" />
                    <span className="text-sm leading-[1.366] text-cream">
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="flex h-12 items-center justify-center rounded-lg bg-sand px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-cream"
              >
                Go Pro Today
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA (Figma: bg #FAF8F5, border top+bottom #E3DCD5, pad 120/80, gap 32) ============ */}
      <section className="border-y border-sandline bg-paper">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 px-4 py-16 sm:px-6 md:gap-8 md:py-[120px] xl:px-20">
          <h2 className="text-center font-fraunces text-[36px] font-black leading-[1.233] text-ink sm:text-[40px] md:text-[48px]">
            Ready to certify your curiosity?
          </h2>
          <p className="max-w-[600px] text-center text-base leading-[1.366] text-clay sm:text-lg">
            Unlock real value from the tutorials you&apos;re already watching.
            Take the first step.
          </p>
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/signup"
              className="flex h-12 w-full items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-cream sm:w-auto"
            >
              Get Started Free
            </Link>
            <Link
              href="#pricing"
              className="flex h-12 w-full items-center justify-center rounded-lg border-[1.5px] border-ink px-6 py-3.5 text-[15px] font-bold leading-[1.366] text-ink sm:w-auto"
            >
              Compare Plans
            </Link>
          </div>
        </div>
      </section>

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
                Turning YouTube video minutes into verifiable professional
                credentials. Learn Today. Go Further.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-8 sm:gap-x-16 md:gap-x-20">
              {FOOTER_COLUMNS.map((col) => (
                <div key={col} className="flex flex-col gap-4">
                  <p className="text-sm font-bold leading-[1.366] text-ink">
                    {col}
                  </p>
                  {FOOTER_LINKS.map((link) => (
                    <Link
                      key={link}
                      href="#"
                      className="text-[13px] leading-[1.366] text-clay"
                    >
                      {link}
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
              Verifiable credentialing platform built for self-directed
              builders.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
