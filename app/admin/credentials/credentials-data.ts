import { asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { credentialsTable, usersTable } from '@/utils/db/schema';
import { ilikeContains } from '@/utils/db/like';

// Deliberately NOT a 'use server' file: every export of a server-actions
// module becomes a publicly callable endpoint (same rule as
// app/auth/onboarding-status.ts). Server-only data loader for
// /admin/credentials.

export const CREDENTIALS_PAGE_SIZE = 20;

/** credentials.status is constrained to these two values (schema + CHECK). */
export type CredentialStatus = 'active' | 'revoked';
export type CredentialStatusFilter = 'all' | 'active' | 'revoked';
export type CredentialSort = 'newest' | 'oldest';

export const CREDENTIAL_STATUS_FILTERS: readonly CredentialStatusFilter[] = [
  'all',
  'active',
  'revoked',
];
export const CREDENTIAL_SORTS: readonly CredentialSort[] = ['newest', 'oldest'];

export function parseCredentialStatus(value: string | undefined): CredentialStatusFilter {
  return CREDENTIAL_STATUS_FILTERS.includes(value as CredentialStatusFilter)
    ? (value as CredentialStatusFilter)
    : 'all';
}

export function parseCredentialSort(value: string | undefined): CredentialSort {
  return CREDENTIAL_SORTS.includes(value as CredentialSort) ? (value as CredentialSort) : 'newest';
}

export type AdminCredentialRow = {
  id: string;
  userId: string;
  /** Name recorded on the credential when it was issued. */
  holderName: string;
  /** Live account name/email, which may differ from the holder name. */
  userDisplayName: string;
  userEmail: string;
  itemTitle: string;
  score: number;
  status: CredentialStatus;
  issuedAt: Date;
};

export type AdminCredentialList = {
  rows: AdminCredentialRow[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
  status: CredentialStatusFilter;
  sort: CredentialSort;
};

/**
 * Searchable, filterable, sortable, paginated credential list. Search matches
 * the credential id, the recorded holder name, the course title, or the live
 * account (name / username / email). Status filters on credentials.status, and
 * everything runs in SQL so pagination stays correct without loading the whole
 * table into the page.
 *
 * A credential row always joins its owner, so the count query joins too (the
 * search filter references users_table).
 */
export async function getAdminCredentials(
  query: string,
  page: number,
  status: CredentialStatusFilter,
  sort: CredentialSort
): Promise<AdminCredentialList> {
  const q = query.trim();
  // ILIKE wildcards in user input would otherwise act as globs; escape them.
  const pattern = ilikeContains(q);

  const searchFilter = q
    ? or(
        ilike(credentialsTable.id, pattern),
        ilike(credentialsTable.holder_name, pattern),
        ilike(credentialsTable.item_title, pattern),
        ilike(usersTable.name, pattern),
        ilike(usersTable.username, pattern),
        ilike(usersTable.email, pattern)
      )
    : undefined;
  const statusFilter = status === 'all' ? undefined : eq(credentialsTable.status, status);
  const conditions = [searchFilter, statusFilter].filter(Boolean) as SQL<unknown>[];
  const where = conditions.length > 0 ? sql.join(conditions, sql` and `) : undefined;

  const totalRows = await db
    .select({ value: count() })
    .from(credentialsTable)
    .innerJoin(usersTable, eq(credentialsTable.user_id, usersTable.id))
    .where(where);
  const total = Number(totalRows[0]?.value ?? 0);

  const pageCount = Math.max(1, Math.ceil(total / CREDENTIALS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const rows = await db
    .select({
      id: credentialsTable.id,
      userId: credentialsTable.user_id,
      holderName: credentialsTable.holder_name,
      itemTitle: credentialsTable.item_title,
      score: credentialsTable.score,
      status: credentialsTable.status,
      issuedAt: credentialsTable.passed_at,
      firstName: usersTable.first_name,
      lastName: usersTable.last_name,
      username: usersTable.username,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(credentialsTable)
    .innerJoin(usersTable, eq(credentialsTable.user_id, usersTable.id))
    .where(where)
    // Secondary id key keeps pagination stable when timestamps tie.
    .orderBy(
      sort === 'oldest' ? asc(credentialsTable.passed_at) : desc(credentialsTable.passed_at),
      credentialsTable.id
    )
    .limit(CREDENTIALS_PAGE_SIZE)
    .offset((safePage - 1) * CREDENTIALS_PAGE_SIZE);

  const items: AdminCredentialRow[] = rows.map((c) => {
    const full = [c.firstName, c.lastName].filter(Boolean).join(' ');
    return {
      id: c.id,
      userId: c.userId,
      holderName: c.holderName,
      userDisplayName: full || c.username || c.name || c.email,
      userEmail: c.email,
      itemTitle: c.itemTitle,
      score: c.score,
      status: c.status === 'revoked' ? 'revoked' : 'active',
      issuedAt: c.issuedAt,
    };
  });

  return { rows: items, total, page: safePage, pageCount, query: q, status, sort };
}
