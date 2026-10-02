import { FaGithub } from 'react-icons/fa';
import { signInWithGithub } from '@/app/auth/actions';
import GoogleSigninButton from '@/components/GoogleSigninButton';

type ProviderSigninBlockProps = {
  actionLabel: 'Sign in' | 'Sign up';
};

export default function ProviderSigninBlock({ actionLabel }: ProviderSigninBlockProps) {
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const isGithubEnabled = Boolean(process.env.GITHUB_OAUTH_CLIENT_ID);

  if (!googleClientId && !isGithubEnabled) {
    return null;
  }

  return (
    <div className="flex flex-row gap-3">
      {googleClientId && <GoogleSigninButton actionLabel={actionLabel} clientId={googleClientId} />}
      {isGithubEnabled && (
        <form action={signInWithGithub} className="basis-full">
          <button
            type="submit"
            aria-label={`${actionLabel} with GitHub`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sandline bg-cream text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            <FaGithub aria-hidden="true" className="h-4 w-4" />
            <span>{`${actionLabel} with GitHub`}</span>
          </button>
        </form>
      )}
    </div>
  );
}
