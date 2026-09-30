'use client';

import { useActionState, useState } from 'react';
import { revokeCredential, type CredentialActionState } from '@/app/dashboard/certificates/actions';
import { Ban } from 'lucide-react';

export default function RevokeCredentialButton({
  credentialId,
  active,
}: {
  credentialId: string;
  active: boolean;
}) {
  const initialState: CredentialActionState = { message: '' };
  const [formState, formAction] = useActionState(revokeCredential, initialState);
  const [confirming, setConfirming] = useState(false);

  if (!active) {
    return (
      <span className="inline-flex h-11 items-center justify-center rounded-lg border border-sandline px-4 text-sm font-semibold text-clay opacity-70">
        Revoked
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="credentialId" value={credentialId} />
      {confirming ? (
        <span className="inline-flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-700"
          >
            Confirm revoke
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex h-11 items-center rounded-lg border border-sandline px-4 text-sm font-semibold text-clay"
          >
            Keep active
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-sandline px-4 text-sm font-semibold text-clay transition-colors hover:border-red-300 hover:text-red-600"
        >
          <Ban aria-hidden="true" className="h-4 w-4" />
          Revoke
        </button>
      )}
      {formState.message && (
        <p
          role={formState.success ? 'status' : 'alert'}
          className={
            formState.success
              ? 'text-xs font-medium text-green-700'
              : 'text-xs font-medium text-red-600'
          }
        >
          {formState.message}
        </p>
      )}
    </form>
  );
}
