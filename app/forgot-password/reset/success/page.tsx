import Link from 'next/link';
import Image from 'next/image';
import { CheckIcon } from '@/components/icons';

export const metadata = {
  title: 'Password Reset Complete | getcertificate.today',
  description: 'Your password has been successfully updated',
};

export default function ResetPasswordSuccess() {
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
            Password updated!
          </h1>
          <p className="mt-2 text-sm text-clay">
            Your password has been successfully reset. You can now sign in with your new
            credentials.
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90"
          >
            Sign in now
          </Link>
        </div>
      </div>
    </div>
  );
}
