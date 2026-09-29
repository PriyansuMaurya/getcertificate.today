import { FaGoogle, FaGithub } from 'react-icons/fa';
import { signInWithGithub, signInWithGoogle } from '@/app/auth/actions';

type ProviderSigninBlockProps = {
  actionLabel: 'Sign in' | 'Sign up';
};

export default function ProviderSigninBlock({ actionLabel }: ProviderSigninBlockProps) {
  const isGoogleEnabled = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID);
  const isGithubEnabled = Boolean(process.env.GITHUB_OAUTH_CLIENT_ID);

  if (!isGoogleEnabled && !isGithubEnabled) {
    return null;
  }

  return (
    <div className="flex flex-row gap-3">
      {isGoogleEnabled && (
        <form action={signInWithGoogle} className="basis-full">
          <button
            type="submit"
            aria-label={`${actionLabel} with Google`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sandline bg-cream text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            <FaGoogle className="h-4 w-4" />
            <span>{`${actionLabel} with Google`}</span>
          </button>
        </form>
      )}
      {isGithubEnabled && (
        <form action={signInWithGithub} className="basis-full">
          <button
            type="submit"
            aria-label={`${actionLabel} with GitHub`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sandline bg-cream text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            <FaGithub className="h-4 w-4" />
            <span>{`${actionLabel} with GitHub`}</span>
          </button>
        </form>
      )}
    </div>
  );
}
