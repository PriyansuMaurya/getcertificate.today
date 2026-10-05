import { safeNextPath } from '@/lib/safe-next';

// Deliberately NOT in a 'use server' file: exports of a server-actions module
// become publicly callable endpoints. This is a plain server-only helper used
// by the admin delete actions.

/**
 * Validates the `returnTo` a delete form round-trips back to the server.
 *
 * `returnTo` is set by the server when rendering the form, but a caller can
 * still tamper with the POST body, so it is re-checked here: it must be a
 * same-origin relative path (see safeNextPath) AND stay inside /admin/.
 * Anything else falls back to the caller's own list route - so a crafted value
 * can never bounce an operator off-site or onto an unrelated page.
 */
export function safeAdminReturnPath(raw: FormDataEntryValue | null, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const path = safeNextPath(raw);
  return path.startsWith('/admin/') ? path : fallback;
}

/**
 * Appends the one-shot `deleted=1` flag an admin list page reads to render its
 * success notice, preserving any existing query/filters on the path.
 */
export function withDeletedNotice(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}deleted=1`;
}
