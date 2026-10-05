'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Ban, Trash2 } from 'lucide-react';
import {
  deleteCredential,
  revokeCredential,
  type AdminCredentialActionState,
} from '@/app/admin/credentials/actions';

const idleState: AdminCredentialActionState = { message: '' };

function ActionSubmitButton({
  pendingLabel,
  className,
  children,
}: {
  pendingLabel: string;
  className: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

const btnBase =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream';

/**
 * Row/detail action cluster for /admin/credentials: Revoke (only while the
 * credential is active) and Delete, both two-step. Revoke flips `status`; delete
 * removes the record. The server actions re-check authorization and the
 * confirmation, so these buttons are convenience, never the security gate.
 */
export default function CredentialActions({
  credentialId,
  holderName,
  status,
  returnTo,
  compact = false,
}: {
  credentialId: string;
  holderName: string;
  status: 'active' | 'revoked';
  /** Where a successful delete redirects back to (the list that rendered this row). */
  returnTo?: string;
  /** Compact variant for table rows (icon-only, labels via aria-label). */
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState<'none' | 'revoke' | 'delete'>('none');
  // Which action ran most recently - so the right state's feedback is shown.
  const [lastAction, setLastAction] = useState<'revoke' | 'delete'>('revoke');
  const [revokeState, revokeAction] = useActionState(revokeCredential, idleState);
  const [deleteState, deleteAction] = useActionState(deleteCredential, idleState);

  // Only surface the message from whichever action ran most recently so a
  // stale success never shadows a later failure (and vice versa).
  const activeState =
    confirming === 'delete'
      ? deleteState
      : confirming === 'revoke'
        ? revokeState
        : lastAction === 'delete'
          ? deleteState
          : revokeState;
  const message = activeState.message;
  const isActive = status === 'active';

  if (confirming !== 'none') {
    const isDelete = confirming === 'delete';
    return (
      <div
        role="group"
        aria-label={isDelete ? 'Confirm credential deletion' : 'Confirm credential revocation'}
        className="flex w-full min-w-[240px] max-w-[340px] flex-col gap-2 rounded-xl border border-sandline bg-paper p-3"
      >
        <p className="text-xs leading-[1.6] text-clay">
          {isDelete ? (
            <>
              Permanently delete the certificate for{' '}
              <span className="font-bold text-ink">{holderName}</span>? Its public certificate and
              verification pages will stop resolving. This cannot be undone.
            </>
          ) : (
            <>
              Revoke the certificate for <span className="font-bold text-ink">{holderName}</span>?
              The public record stays online but is marked revoked.
            </>
          )}
        </p>
        <form
          action={isDelete ? deleteAction : revokeAction}
          onSubmit={() => setLastAction(confirming)}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="credentialId" value={credentialId} />
          {/* Where delete redirects after success (re-validated server-side; ignored by revoke). */}
          <input type="hidden" name="returnTo" value={returnTo ?? ''} />
          {/* Server-side confirmation gate (app/admin/credentials/actions.ts). */}
          <input type="hidden" name="confirm" value="yes" />
          <ActionSubmitButton
            pendingLabel={isDelete ? 'Deleting…' : 'Revoking…'}
            className={`${btnBase} ${
              isDelete
                ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600'
                : 'bg-ink text-cream hover:bg-ink/90'
            }`}
          >
            {isDelete ? 'Yes, delete' : 'Yes, revoke'}
          </ActionSubmitButton>
          <button
            type="button"
            onClick={() => setConfirming('none')}
            className={`${btnBase} border border-sandline bg-paper text-ink hover:bg-ink/5`}
          >
            Cancel
          </button>
        </form>
        {message && (
          <p
            role={activeState.success ? 'status' : 'alert'}
            className={`text-xs font-medium ${
              activeState.success ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {isActive && (
          <button
            type="button"
            onClick={() => setConfirming('revoke')}
            className={`${btnBase} border border-sandline bg-paper text-ink hover:bg-ink/5`}
            aria-label={compact ? `Revoke ${holderName}` : undefined}
          >
            <Ban aria-hidden="true" className="h-3.5 w-3.5" />
            {compact ? '' : 'Revoke'}
          </button>
        )}

        <button
          type="button"
          onClick={() => setConfirming('delete')}
          className={`${btnBase} border border-red-600/50 bg-paper text-red-600 hover:bg-red-50 focus-visible:ring-red-600`}
          aria-label={compact ? `Delete ${holderName}` : undefined}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          {compact ? '' : 'Delete'}
        </button>
      </div>
      {message && (
        <p
          role={activeState.success ? 'status' : 'alert'}
          className={`max-w-[260px] text-xs font-medium sm:text-right ${
            activeState.success ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
