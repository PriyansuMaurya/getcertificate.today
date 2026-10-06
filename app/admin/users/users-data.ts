import { count, desc, eq, ilike, or, sql, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { attemptsTable, credentialsTable, learningItemsTable, usersTable } from '@/utils/db/schema';
import { ilikeContains } from '@/utils/db/like';
import { planLabel } from '@/utils/plans';

// Deliberately NOT a 'use server' file: every export of a server-actions
// module becomes a publicly callable endpoint (same rule as
// app/auth/onboarding-status.ts). Server-only data loader for /admin/users.

export const USERS_PAGE_SIZE = 20;

export type AdminUserStatus = 'active' | 'suspended';

export type AdminUserRow = {
  id: string;
  displayName: string;
  email: string;
  planLabel: string;
  isAdmin: boolean;
  status: AdminUserStatus;
  joinedAt: Date | null;
  videosAdded: number;
  assessmentsTaken: number;
  credentialsEarned: number;
};

/** Server-side sort order for the users list (values used in the sort select). */
export type AdminUserSort = 'joined_desc' | 'joined_asc' | 'name_asc';

export const USER_SORTS: readonly AdminUserSort[] = ['joined_desc', 'joined_asc', 'name_asc'];

/** Coerces an untrusted `?sort=` value to a supported order (defaults newest). */
export function parseUserSort(value: string | undefined): AdminUserSort {
  return USER_SORTS.includes(value as AdminUserSort) ? (value as AdminUserSort) : 'joined_desc';
}

export type AdminUserList = {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
  sort: AdminUserSort;
};

/** ORDER BY for the users list; `name_asc` mirrors the displayed name. */
function userOrderBy(sort: AdminUserSort) {
  if (sort === 'joined_asc') {
    // Secondary id key keeps pagination stable when values tie.
    return [sql`${usersTable.terms_consented_at} asc nulls last`, usersTable.id];
  }
  if (sort === 'name_asc') {
    return [
      sql`lower(coalesce(nullif(trim(concat_ws(' ', ${usersTable.first_name}, ${usersTable.last_name})), ''), ${usersTable.username}, ${usersTable.name}, ${usersTable.email})) asc`,
      usersTable.id,
    ];
  }
  return [sql`${usersTable.terms_consented_at} desc nulls last`, usersTable.id];
}

/**
 * Searchable, paginated user list for /admin/users. Aggregates (videos,
 * attempts, credentials) are counted per page's user ids in three grouped
 * queries rather than join-fanning the list query, so counts stay correct
 * regardless of row multiplication.
 *
 * Search matches name / username / email case-insensitively. Any query
 * failure rejects so the route's error boundary can offer a retry.
 */
export async function getAdminUsers(
  query: string,
  page: number,
  sort: AdminUserSort
): Promise<AdminUserList> {
  const q = query.trim();
  // ILIKE wildcards in user input would otherwise act as globs; escape them.
  const pattern = ilikeContains(q);

  const searchFilter = q
    ? or(
        ilike(usersTable.email, pattern),
        ilike(usersTable.name, pattern),
        ilike(usersTable.username, pattern),
        ilike(sql`coalesce(${usersTable.first_name}, '')`, pattern),
        ilike(sql`coalesce(${usersTable.last_name}, '')`, pattern)
      )
    : undefined;
  const where = searchFilter ?? undefined;

  const total = await getTotal(where);
  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const users = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.first_name,
      lastName: usersTable.last_name,
      username: usersTable.username,
      name: usersTable.name,
      email: usersTable.email,
      plan: usersTable.plan,
      role: usersTable.role,
      suspendedAt: usersTable.suspended_at,
      joinedAt: usersTable.terms_consented_at,
    })
    .from(usersTable)
    .where(where)
    // drizzle-orm 0.45 has no descNullsLast export, so the SQL is inline.
    .orderBy(...userOrderBy(sort))
    .limit(USERS_PAGE_SIZE)
    .offset((safePage - 1) * USERS_PAGE_SIZE);

  const { videos, attempts, credentials } = await getAggregates(users.map((u) => u.id));

  const rows: AdminUserRow[] = users.map((u) => {
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return {
      id: u.id,
      displayName: full || u.username || u.name || u.email,
      email: u.email,
      planLabel: planLabel(u.plan),
      isAdmin: u.role === 'admin',
      status: u.suspendedAt ? 'suspended' : 'active',
      joinedAt: u.joinedAt,
      videosAdded: videos.get(u.id) ?? 0,
      assessmentsTaken: attempts.get(u.id) ?? 0,
      credentialsEarned: credentials.get(u.id) ?? 0,
    };
  });

  return { rows, total, page: safePage, pageCount, query: q, sort };
}

async function getTotal(where: SQL<unknown> | undefined): Promise<number> {
  const rows = await db.select({ value: count() }).from(usersTable).where(where);
  return Number(rows[0]?.value ?? 0);
}

async function getAggregates(userIds: string[]): Promise<{
  videos: Map<string, number>;
  attempts: Map<string, number>;
  credentials: Map<string, number>;
}> {
  if (userIds.length === 0) {
    return { videos: new Map(), attempts: new Map(), credentials: new Map() };
  }

  const [videoRows, attemptRows, credentialRows] = await Promise.all([
    db
      .select({ userId: learningItemsTable.user_id, value: count() })
      .from(learningItemsTable)
      .where(inArray(learningItemsTable.user_id, userIds))
      .groupBy(learningItemsTable.user_id),
    db
      .select({ userId: attemptsTable.user_id, value: count() })
      .from(attemptsTable)
      .where(inArray(attemptsTable.user_id, userIds))
      .groupBy(attemptsTable.user_id),
    db
      .select({ userId: credentialsTable.user_id, value: count() })
      .from(credentialsTable)
      .where(inArray(credentialsTable.user_id, userIds))
      .groupBy(credentialsTable.user_id),
  ]);

  const toMap = (rows: { userId: string; value: unknown }[]) =>
    new Map(rows.map((r) => [r.userId, Number(r.value)]));

  return {
    videos: toMap(videoRows),
    attempts: toMap(attemptRows),
    credentials: toMap(credentialRows),
  };
}

/** Detail loader for /admin/users/[id]: profile + activity summary. */
export type AdminUserDetail = {
  id: string;
  displayName: string;
  fullName: string;
  email: string;
  username: string | null;
  planLabel: string;
  isAdmin: boolean;
  status: AdminUserStatus;
  joinedAt: Date | null;
  dob: string | null;
  stats: {
    videosAdded: number;
    assessmentsTaken: number;
    attemptsPassed: number;
    credentialsEarned: number;
  };
  recentItems: { id: string; title: string; kind: string; addedAt: Date }[];
  recentAttempts: {
    id: string;
    itemTitle: string;
    score: number;
    passed: boolean;
    at: Date;
  }[];
  recentCredentials: {
    id: string;
    itemTitle: string;
    score: number;
    status: string;
    at: Date;
  }[];
};

export async function getAdminUserDetail(id: string): Promise<AdminUserDetail | null> {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
  const user = users[0];
  if (!user) return null;

  const [videoCount, attemptStats, credentialCount, recentItems, recentAttempts, recentCreds] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(learningItemsTable)
        .where(eq(learningItemsTable.user_id, id)),
      db
        .select({
          total: count(),
          passed: sql<number>`count(*) FILTER (WHERE ${attemptsTable.passed})`,
        })
        .from(attemptsTable)
        .where(eq(attemptsTable.user_id, id)),
      db.select({ value: count() }).from(credentialsTable).where(eq(credentialsTable.user_id, id)),
      db
        .select({
          id: learningItemsTable.id,
          title: learningItemsTable.title,
          kind: learningItemsTable.kind,
          addedAt: learningItemsTable.created_at,
        })
        .from(learningItemsTable)
        .where(eq(learningItemsTable.user_id, id))
        .orderBy(desc(learningItemsTable.created_at))
        .limit(5),
      db
        .select({
          id: attemptsTable.id,
          score: attemptsTable.score,
          passed: attemptsTable.passed,
          at: attemptsTable.created_at,
          itemTitle: learningItemsTable.title,
        })
        .from(attemptsTable)
        .innerJoin(learningItemsTable, eq(attemptsTable.learning_item_id, learningItemsTable.id))
        .where(eq(attemptsTable.user_id, id))
        .orderBy(desc(attemptsTable.created_at))
        .limit(5),
      db
        .select({
          id: credentialsTable.id,
          score: credentialsTable.score,
          status: credentialsTable.status,
          at: credentialsTable.passed_at,
          itemTitle: credentialsTable.item_title,
        })
        .from(credentialsTable)
        .where(eq(credentialsTable.user_id, id))
        .orderBy(desc(credentialsTable.passed_at))
        .limit(5),
    ]);

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');

  return {
    id: user.id,
    displayName: fullName || user.username || user.name || user.email,
    fullName: fullName || user.name,
    email: user.email,
    username: user.username,
    planLabel: planLabel(user.plan),
    isAdmin: user.role === 'admin',
    status: user.suspended_at ? 'suspended' : 'active',
    joinedAt: user.terms_consented_at,
    dob: user.dob,
    stats: {
      videosAdded: Number(videoCount[0]?.value ?? 0),
      assessmentsTaken: Number(attemptStats[0]?.total ?? 0),
      attemptsPassed: Number(attemptStats[0]?.passed ?? 0),
      credentialsEarned: Number(credentialCount[0]?.value ?? 0),
    },
    recentItems: recentItems.map((i) => ({
      id: i.id,
      title: i.title ?? 'Untitled course',
      kind: i.kind,
      addedAt: i.addedAt,
    })),
    recentAttempts: recentAttempts.map((a) => ({
      id: a.id,
      itemTitle: a.itemTitle ?? 'Untitled course',
      score: a.score,
      passed: a.passed,
      at: a.at,
    })),
    recentCredentials: recentCreds.map((c) => ({
      id: c.id,
      itemTitle: c.itemTitle,
      score: c.score,
      status: c.status,
      at: c.at,
    })),
  };
}
