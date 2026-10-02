import Link from 'next/link';
import Image from 'next/image';
import SignupForm from '@/components/SignupForm';
import ProviderSigninBlock from '@/components/ProviderSigninBlock';

export const metadata = {
  title: 'Create Account | getcertificate.today',
  description: 'Create your getcertificate.today account',
};

export default function Signup() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-[480px] rounded-2xl border border-sandline bg-paper p-8 shadow-figma-hero sm:p-12 lg:min-h-[787px] lg:p-[47px]">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Image
              src="/figma/logo.png"
              alt="getcertificate.today"
              width={180}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <h1 className="mt-6 font-fraunces text-2xl font-bold leading-tight text-ink sm:text-3xl">
            Create your account
          </h1>
        </div>

        <div className="mt-8 grid gap-5">
          <SignupForm />

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-sandline" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-paper px-3 font-semibold text-clay">Or register with</span>
            </div>
          </div>

          <ProviderSigninBlock actionLabel="Sign up" />
        </div>

        <div className="mt-8 flex flex-col gap-2.5 text-center text-sm">
          <p className="text-clay">
            Already have an account?{' '}
            <Link
              className="font-semibold text-ink underline underline-offset-4 hover:text-clay"
              href="/login"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
