'use client';

import { logout } from '@/app/auth/actions';
import { useFormStatus } from 'react-dom';

function SignOutPending() {
  const { pending } = useFormStatus();
  return pending ? 'Signing out…' : 'Sign out';
}

export default function SettingsSignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-lg border border-ink px-6 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-cream"
      >
        <SignOutPending />
      </button>
    </form>
  );
}
