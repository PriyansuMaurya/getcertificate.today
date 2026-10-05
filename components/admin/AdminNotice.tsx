import { CheckCircle2 } from 'lucide-react';

/**
 * One-shot success banner for admin list pages. Destructive row actions
 * (delete) redirect back to the list with `?deleted=1`; the row itself is gone,
 * so this is what confirms the action actually succeeded. Server component -
 * no client state needed, and it disappears as soon as the operator searches,
 * filters, or paginates (those rebuild the URL without the flag).
 */
export default function AdminNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mt-6 flex items-start gap-2.5 rounded-2xl border border-green-600/40 bg-green-50 p-4 text-sm font-semibold text-green-700"
    >
      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
