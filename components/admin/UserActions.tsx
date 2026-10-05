'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Eye, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import {
  deleteUser,
  suspendUser,
  unsuspendUser,
  type AdminUserActionState,
} from '@/app/admin/users/actions';

const idleState: AdminUserActionState = { message: '' };

function ActionSubmitButton({
  pendingLabel,
  className,
  ariaLabel,
  children,
}: {
  pendingLabel: string;
  className: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={ariaLabel}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

const btnBase =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream';

/**
 * Row/detail action cluster for /admin/users: View (link), Suspend or
 * Unsuspend (immediate, reversible), and Delete (two-step confirmation with
 * explicit copy, mirroring DeleteAccountButton). The server actions re-check
 * authorization - these buttons are convenience, never the security gate.
 */
export default function UserActions({
  userId,
  email,
  isSuspended,
  returnTo,
  compact = false,
}: {
  userId: string;
  email: string;
  isSuspended: boolean;
  /** Where a successful delete redirects back to (the list/detail that rendered this row). */
  returnTo?: string;
  /** Compact variant for table rows (icons only, labels via aria-label). */
  compact?: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Which action ran most recent - so the right state's feedback is shown (a
  // stale success never shadows a later failure, and vice versa). Keyed by the
  // exact action, NOT the current isSuspended flag: a successful suspend or
  // unsuspend revalidates and flips isSuspended, which would otherwise swap in
  // the other action's still-empty state and hide the confirmation.
  const [lastAction, setLastAction] = useState<'suspend' | 'unsuspend' | 'delete'>(
    isSuspended ? 'unsuspend' : 'suspend'
  );
  const [suspendState, suspendAction] = useActionState(suspendUser, idleState);
  const [unsuspendState, unsuspendAction] = useActionState(unsuspendUser, idleState);
  const [deleteState, deleteAction] = useActionState(deleteUser, idleState);

  const restoreAction = isSuspended ? unsuspendAction : suspendAction;
  // Only surface the message from whichever action ran most recently so a stale
  // success never shadows a later failure (and vice versa).
  const activeState =
    lastAction === 'delete'
      ? deleteState
      : lastAction === 'suspend'
        ? suspendState
        : unsuspendState;
  const message = activeState.message;

  if (confirmingDelete) {
    return (
      <div
        role="group"
        aria-label="Confirm account deletion"
        className="flex w-full min-w-[240px] max-w-[340px] flex-col gap-2 rounded-xl border border-red-600/40 bg-red-50 p-3"
      >
        <p className="text-xs leading-[1.6] text-red-700">
          Permanently delete <span className="font-bold">{email}</span> and all of their courses,
          attempts, and certificates? This cannot be undone.
        </p>
        <form
          action={deleteAction}
          onSubmit={() => setLastAction('delete')}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="userId" value={userId} />
          {/* Where the action redirects after a successful delete (re-validated server-side). */}
          <input type="hidden" name="returnTo" value={returnTo ?? ''} />
          {/* Server-side confirmation gate (app/admin/users/actions.ts). */}
          <input type="hidden" name="confirm" value="yes" />
          <ActionSubmitButton
            pendingLabel="Deleting…"
            className={`${btnBase} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600`}
          >
            Yes, delete everything
          </ActionSubmitButton>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className={`${btnBase} border border-sandline bg-paper text-ink hover:bg-ink/5`}
          >
            Cancel
          </button>
        </form>
        {deleteState.message && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {deleteState.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Link
          href={`/admin/users/${userId}`}
          className={`${btnBase} border border-sandline bg-paper text-ink hover:bg-ink/5`}
          aria-label={compact ? `View ${email}` : undefined}
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          {compact ? '' : 'View'}
        </Link>

        <form
          action={restoreAction}
          onSubmit={() => setLastAction(isSuspended ? 'unsuspend' : 'suspend')}
        >
          <input type="hidden" name="userId" value={userId} />
          <ActionSubmitButton
            pendingLabel={isSuspended ? 'Restoring…' : 'Suspending…'}
            ariaLabel={
              compact ? (isSuspended ? `Unsuspend ${email}` : `Suspend ${email}`) : undefined
            }
            className={`${btnBase} border border-sandline bg-paper text-ink hover:bg-ink/5`}
          >
            {isSuspended ? (
              <PlayCircle aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <PauseCircle aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {compact ? '' : isSuspended ? 'Unsuspend' : 'Suspend'}
          </ActionSubmitButton>
        </form>

        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className={`${btnBase} border border-red-600/50 bg-paper text-red-600 hover:bg-red-50 focus-visible:ring-red-600`}
          aria-label={compact ? `Delete ${email}` : undefined}
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
