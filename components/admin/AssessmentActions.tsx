'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Eye, RefreshCw, Trash2 } from 'lucide-react';
import {
  deleteAssessment,
  regenerateAssessment,
  type AdminAssessmentActionState,
} from '@/app/admin/assessments/actions';

const idleState: AdminAssessmentActionState = { message: '' };

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
 * Row/detail action cluster for /admin/assessments: View (link), Regenerate
 * (two-step confirm; reuses the production transcript + LLM pipeline), and
 * Delete (two-step confirm, server-blocked when certificates exist). The
 * server actions re-check authorization - these buttons are convenience,
 * never the security gate.
 */
export default function AssessmentActions({
  assessmentId,
  courseTitle,
  returnTo,
  compact = false,
}: {
  assessmentId: string;
  courseTitle: string;
  /** Where a successful delete redirects back to (the list/detail that rendered this row). */
  returnTo?: string;
  /** Compact variant for table rows (icon-only, labels via aria-label). */
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState<'none' | 'regenerate' | 'delete'>('none');
  // Which action ran most recent - picks which state's message is shown.
  const [lastAction, setLastAction] = useState<'regenerate' | 'delete'>('regenerate');
  const [regenState, regenAction] = useActionState(regenerateAssessment, idleState);
  const [deleteState, deleteAction] = useActionState(deleteAssessment, idleState);

  // Only surface the message from whichever action ran most recently so a
  // stale success never shadows a later failure (and vice versa).
  const activeState =
    confirming === 'delete'
      ? deleteState
      : confirming === 'regenerate'
        ? regenState
        : lastAction === 'delete'
          ? deleteState
          : regenState;
  const message = activeState.message;

  if (confirming !== 'none') {
    const isRegen = confirming === 'regenerate';
    return (
      <div
        role="group"
        aria-label={isRegen ? 'Confirm assessment regeneration' : 'Confirm assessment deletion'}
        className="flex w-full min-w-[260px] max-w-[340px] flex-col gap-2 rounded-xl border border-sandline bg-paper p-3"
      >
        <p className="text-xs leading-[1.6] text-clay">
          {isRegen ? (
            <>
              Regenerate every question for{' '}
              <span className="font-bold text-ink">{courseTitle}</span> from its transcript? The
              current questions are replaced. Blocked automatically if any learner has attempted it.
            </>
          ) : (
            <>
              Permanently delete <span className="font-bold text-ink">{courseTitle}</span> and all
              attempts on it? Blocked if any certificate is tied to those attempts. This cannot be
              undone.
            </>
          )}
        </p>{' '}
        <form
          action={isRegen ? regenAction : deleteAction}
          onSubmit={() => setLastAction(confirming)}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="assessmentId" value={assessmentId} />
          {/* Where delete redirects after success (re-validated server-side; ignored by regenerate). */}
          <input type="hidden" name="returnTo" value={returnTo ?? ''} />
          {/* Server-side confirmation gate (app/admin/assessments/actions.ts). */}
          <input type="hidden" name="confirm" value="yes" />
          <ActionSubmitButton
            pendingLabel={isRegen ? 'Regenerating…' : 'Deleting…'}
            className={`${btnBase} ${
              isRegen
                ? 'bg-ink text-cream hover:bg-ink/90'
                : 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600'
            }`}
          >
            {isRegen ? 'Yes, regenerate' : 'Yes, delete'}
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
        <Link
          href={`/admin/assessments/${assessmentId}`}
          className={`${btnBase} border border-sandline bg-paper text-ink hover:bg-ink/5`}
          aria-label={compact ? `View ${courseTitle}` : undefined}
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          {compact ? null : 'View'}
        </Link>

        <button
          type="button"
          onClick={() => setConfirming('regenerate')}
          className={`${btnBase} border border-sandline bg-paper text-ink hover:bg-ink/5`}
          aria-label={compact ? `Regenerate ${courseTitle}` : undefined}
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
          {compact ? null : 'Regenerate'}
        </button>

        <button
          type="button"
          onClick={() => setConfirming('delete')}
          className={`${btnBase} border border-red-600/50 bg-paper text-red-600 hover:bg-red-50 focus-visible:ring-red-600`}
          aria-label={compact ? `Delete ${courseTitle}` : undefined}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          {compact ? null : 'Delete'}
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
