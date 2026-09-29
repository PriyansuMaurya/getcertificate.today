import Link from 'next/link';
import Image from 'next/image';
import { CheckIcon, ArrowRightIcon } from '@/components/icons';

export const metadata = {
  title: 'Subscription Confirmed | getcertificate.today',
  description: 'Your subscription is now active',
};

export default function SubscribeSuccess() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-[440px] rounded-2xl border border-sandline bg-paper p-8 shadow-figma-hero sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Image
              src="/figma/logo.png"
              alt="getcertificate.today"
              width={180}
              height={40}
              priority
              className="h-9 w-auto sm:h-10"
            />
          </Link>
          <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-sand/20 text-sand">
            <CheckIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-fraunces text-2xl font-bold leading-tight text-ink sm:text-3xl">
            Welcome to Professional!
          </h1>
          <p className="mt-2 text-sm text-clay">
            Thank you for subscribing. Your account is upgraded with unlimited certifications and
            deep-syllabus features.
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90"
          >
            <span>Go to Dashboard</span>
            <ArrowRightIcon className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}
