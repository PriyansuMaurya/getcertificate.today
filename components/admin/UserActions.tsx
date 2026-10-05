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
      className={`${className} disabled:opacity-50`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

const btnBase =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors';

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
  compact = false,
}: {
  userId: string;
  email: string;
  isSuspended: boolean;
  /** Compact variant for table rows (icons only, labels via aria-label). */
  compact?: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [suspendState, suspendAction] = useActionState(suspendUser, idleState);
  const [unsuspendState, unsuspendAction] = useActionState(unsuspendUser, idleState);
  const [deleteState, deleteAction] = useActionState(deleteUser, idleState);

  const restoreState = isSuspended ? unsuspendState : suspendState;
  const restoreAction = isSuspended ? unsuspendAction : suspendAction;
  const message = deleteState.message || restoreState.message;

  if (confirmingDelete) {
    return (
      <div className="flex w-full min-w-[240px] flex-col gap-2 rounded-xl border border-red-600/40 bg-red-50 p-3">
        <p className="text-xs leading-[1.6] text-red-700">
          Permanently delete <span className="font-bold">{email}</span> and all of their courses,
          attempts, and certificates? This cannot be undone.
        </p>
        <form action={deleteAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          {/* Server-side confirmation gate (app/admin/users/actions.ts). */}
          <input type="hidden" name="confirm" value="yes" />
          <ActionSubmitButton
            pendingLabel="Deleting…"
            className={`${btnBase} bg-red-600 text-white hover:bg-red-700`}
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
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/admin/users/${userId}`}
          className={`${btnBase} border border-sandline bg-paper text-ink hover:bg-ink/5`}
          aria-label={compact ? `View ${email}` : undefined}
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          {compact ? '' : 'View'}
        </Link>

        <form action={restoreAction}>
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
          className={`${btnBase} border border-red-600/50 bg-paper text-red-600 hover:bg-red-50`}
          aria-label={compact ? `Delete ${email}` : undefined}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          {compact ? '' : 'Delete'}
        </button>
      </div>
      {message && (
        <p role="status" className="max-w-[260px] text-right text-xs font-medium text-clay">
          {message}
        </p>
      )}
    </div>
  );
}
