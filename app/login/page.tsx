import Link from 'next/link';
import Image from 'next/image';
import ProviderSigninBlock from '@/components/ProviderSigninBlock';
import LoginForm from '@/components/LoginForm';

export const metadata = {
  title: 'Sign In | getcertificate.today',
  description: 'Sign in to your getcertificate.today account',
  alternates: { canonical: '/login' },
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string; signOutFailed?: string }>;
}) {
  // Set by the Settings password-change action after it signs the user out
  // everywhere (scope 'global'). `signOutFailed` records that the server-side
  // revocation errored, so we warn instead of implying the account is fully clear.
  const { passwordChanged, signOutFailed } = await searchParams;
  const showPasswordChanged = passwordChanged === '1';
  const showSignOutWarning = showPasswordChanged && signOutFailed === '1';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-[480px] rounded-2xl border border-sandline bg-paper p-8 shadow-figma-hero sm:p-12 lg:min-h-[698px] lg:p-[47px]">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Image
              src="/figma/logo-no-tagline.svg"
              alt="getcertificate.today"
              width={1339}
              height={767}
              priority
              unoptimized
              className="h-10 w-auto"
            />
          </Link>
          <h1 className="mt-6 font-fraunces text-2xl font-bold leading-tight text-ink sm:text-3xl">
            Welcome back
          </h1>
        </div>

        <div className="mt-8 grid gap-5">
          {showPasswordChanged && (
            <p
              role="status"
              className="rounded-lg border border-green-600/20 bg-green-500/10 p-3 text-center text-sm font-medium text-green-800"
            >
              Your password has been updated. Sign in with your new password.
            </p>
          )}

          {showSignOutWarning && (
            <p
              role="alert"
              className="rounded-lg border border-amber-600/30 bg-amber-500/10 p-3 text-center text-sm font-medium text-amber-800"
            >
              We couldn&apos;t sign out all of your other devices. If you don&apos;t recognize this
              activity, contact support right away.
            </p>
          )}

          <LoginForm />

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-sandline" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-paper px-3 font-semibold text-clay">Or continue with</span>
            </div>
          </div>

          <ProviderSigninBlock actionLabel="Sign in" />
        </div>

        <div className="mt-8 flex flex-col gap-2.5 text-center text-sm">
          <Link className="text-clay transition-colors hover:text-ink" href="/forgot-password">
            Forgot password?
          </Link>
          <p className="text-clay">
            Don&apos;t have an account?{' '}
            <Link
              className="font-semibold text-ink underline underline-offset-4 hover:text-clay"
              href="/signup"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
