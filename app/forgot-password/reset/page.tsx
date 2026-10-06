import Link from 'next/link';
import Image from 'next/image';
import ResetPasswordForm from '@/components/ResetPasswordForm';

export const metadata = {
  title: 'Set New Password | getcertificate.today',
  description: 'Set a new password for your account',
};

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error } = await searchParams;
  // A recovery link lands here with a one-time `code` (PKCE). Supabase omits the
  // code and/or adds an `error` when the link has already been used or expired,
  // so rendering the form in that case would let a dead link look alive.
  const hasUsableCode = Boolean(code) && !error;

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
          <h1 className="mt-6 font-fraunces text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {hasUsableCode ? 'New password' : 'Link expired'}
          </h1>
          <p className="mt-2 text-sm text-clay">
            {hasUsableCode
              ? 'Enter your new password below'
              : 'This password reset link has already been used or has expired.'}
          </p>
        </div>

        <div className="mt-8">
          {hasUsableCode ? (
            <ResetPasswordForm />
          ) : (
            <Link
              href="/forgot-password"
              className="flex h-12 w-full items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90"
            >
              Request a new link
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
