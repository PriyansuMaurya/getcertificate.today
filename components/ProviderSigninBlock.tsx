import { FaGoogle, FaGithub } from 'react-icons/fa';
import { signInWithGithub, signInWithGoogle } from '@/app/auth/actions';

export default function ProviderSigninBlock() {
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
            aria-label="Sign in with Google"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sandline bg-cream text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            <FaGoogle className="h-4 w-4" />
            <span>Google</span>
          </button>
        </form>
      )}
      {isGithubEnabled && (
        <form action={signInWithGithub} className="basis-full">
          <button
            type="submit"
            aria-label="Sign in with GitHub"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sandline bg-cream text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            <FaGithub className="h-4 w-4" />
            <span>GitHub</span>
          </button>
        </form>
      )}
    </div>
  );
}
