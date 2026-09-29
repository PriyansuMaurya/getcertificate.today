import Link from 'next/link';
import Image from 'next/image';
import ResetPasswordForm from '@/components/ResetPasswordForm';

export const metadata = {
  title: 'Set New Password | getcertificate.today',
  description: 'Set a new password for your account',
};

export default function ResetPassword() {
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
            New password
          </h1>
          <p className="mt-2 text-sm text-clay">Enter your new password below</p>
        </div>

        <div className="mt-8">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
