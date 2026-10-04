import Link from 'next/link';
import Image from 'next/image';
import { CheckIcon } from '@/components/icons';

export const metadata = {
  title: 'Reset Request Sent | getcertificate.today',
  description: 'Check your email for reset instructions',
};

export default function ForgotPasswordSuccess() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-[420px] rounded-2xl border border-sandline bg-paper p-8 shadow-figma-hero sm:p-10">
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
          <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-sand/20 text-sand">
            <CheckIcon className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-fraunces text-2xl font-bold leading-tight text-ink sm:text-3xl">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-clay">
            We sent password reset instructions to your email address.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90"
          >
            Return to Sign in
          </Link>
          <Link
            href="/"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-sandline bg-cream px-6 py-3.5 text-[15px] font-bold text-ink transition-colors hover:border-ink"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
