'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { RotateCcw } from 'lucide-react';
import {
  reverseReferralRewardAction,
  type AdminReferralActionState,
} from '@/app/admin/referrals/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-600/30 bg-red-500/5 px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-50"
    >
      <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
      {pending ? 'Reversing…' : 'Reverse reward'}
    </button>
  );
}

/** Admin-only control: reverses one awarded referral credit (idempotent). */
export default function ReferralRewardActions({ referralId }: { referralId: string }) {
  const [state, action] = useActionState<AdminReferralActionState, FormData>(
    reverseReferralRewardAction,
    { message: '' }
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="referralId" value={referralId} />
      <SubmitButton />
      {state.message && (
        <span
          role={state.success ? 'status' : 'alert'}
          className={`text-xs font-medium ${state.success ? 'text-emerald-700' : 'text-red-700'}`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
