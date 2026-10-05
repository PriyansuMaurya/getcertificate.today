import { count, countDistinct, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import {
  assessmentsTable,
  attemptsTable,
  credentialsTable,
  learningItemsTable,
  usersTable,
} from '@/utils/db/schema';

// Deliberately NOT a 'use server' file: every export of a server-actions
// module becomes a publicly callable endpoint (same rule as
// app/auth/onboarding-status.ts). Server-only data loader for /admin.

/** Window for the "Active Users" metric: users with learning activity since. */
export const ACTIVE_WINDOW_DAYS = 30;

const LIST_LIMIT = 6;

export type AdminOverviewMetrics = {
  totalUsers: number;
  activeUsers: number;
  videosAdded: number;
  assessmentsTaken: number;
  attemptsTotal: number;
  attemptsPassed: number;
  credentialsIssued: number;
  credentialsRevoked: number;
};

export type AdminRecentUser = {
  id: string;
  displayName: string;
  email: string;
  planLabel: string;
  isAdmin: boolean;
  joinedAt: Date | null;
};

export type AdminRecentCredential = {
  id: string;
  holderName: string;
  itemTitle: string;
  score: number;
  status: string;
  passedAt: Date;
};

export type AdminFailureRow = {
  key: string;
  kind: 'attempt' | 'transcript';
  title: string;
  detail: string;
  at: Date;
};

export type AdminOverview = {
  metrics: AdminOverviewMetrics;
  recentUsers: AdminRecentUser[];
  recentCredentials: AdminRecentCredential[];
  failures: AdminFailureRow[];
};

/**
 * Loads every figure shown on the admin overview with real queries against
 * Postgres. All queries run in parallel; any failure rejects so the route's
 * error boundary (app/admin/error.tsx) can offer a retry instead of the page
 * rendering half a dashboard.
 *
 * Failure panel data is derived from persisted rows (no failure log exists):
 * - kind 'attempt'    -> attempts where passed = false (a learner failed)
 * - kind 'transcript' -> assessments with source = 'metadata', i.e. generated
 *                        from the title/channel only because no transcript or
 *                        captions were available (schema.ts source comment).
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    videosAdded,
    attemptStats,
    credentialStats,
    recentUsers,
    recentCredentials,
    failedAttempts,
    titleOnlyAssessments,
  ] = await Promise.all([
    db.select({ value: count() }).from(usersTable),
    db
      .select({ value: countDistinct(learningItemsTable.user_id) })
      .from(learningItemsTable)
      .where(gte(learningItemsTable.updated_at, activeSince)),
    db.select({ value: count() }).from(learningItemsTable),
    db
      .select({
        total: count(),
        passed: sql<number>`count(*) FILTER (WHERE ${attemptsTable.passed})`,
      })
      .from(attemptsTable),
    db
      .select({
        total: count(),
        revoked: sql<number>`count(*) FILTER (WHERE ${credentialsTable.status} = 'revoked')`,
      })
      .from(credentialsTable),
    db
      .select({
        id: usersTable.id,
        firstName: usersTable.first_name,
        lastName: usersTable.last_name,
        username: usersTable.username,
        name: usersTable.name,
        email: usersTable.email,
        plan: usersTable.plan,
        role: usersTable.role,
        joinedAt: usersTable.terms_consented_at,
      })
      .from(usersTable)
      // Newest signups first, but legacy rows without a consent timestamp
      // sink to the bottom instead of hiding recent activity (drizzle-orm
      // 0.45 has no descNullsLast export, so the SQL is inline).
      .orderBy(sql`${usersTable.terms_consented_at} desc nulls last`)
      .limit(LIST_LIMIT),
    db
      .select({
        id: credentialsTable.id,
        holderName: credentialsTable.holder_name,
        itemTitle: credentialsTable.item_title,
        score: credentialsTable.score,
        status: credentialsTable.status,
        passedAt: credentialsTable.passed_at,
      })
      .from(credentialsTable)
      .orderBy(desc(credentialsTable.passed_at))
      .limit(LIST_LIMIT),
    db
      .select({
        id: attemptsTable.id,
        score: attemptsTable.score,
        createdAt: attemptsTable.created_at,
        email: usersTable.email,
        itemTitle: learningItemsTable.title,
      })
      .from(attemptsTable)
      .innerJoin(usersTable, eq(attemptsTable.user_id, usersTable.id))
      .innerJoin(learningItemsTable, eq(attemptsTable.learning_item_id, learningItemsTable.id))
      .where(eq(attemptsTable.passed, false))
      .orderBy(desc(attemptsTable.created_at))
      .limit(LIST_LIMIT),
    db
      .select({
        id: assessmentsTable.id,
        createdAt: assessmentsTable.created_at,
        itemTitle: learningItemsTable.title,
      })
      .from(assessmentsTable)
      .innerJoin(learningItemsTable, eq(assessmentsTable.learning_item_id, learningItemsTable.id))
      .where(eq(assessmentsTable.source, 'metadata'))
      .orderBy(desc(assessmentsTable.created_at))
      .limit(LIST_LIMIT),
  ]);

  const failures: AdminFailureRow[] = [
    ...failedAttempts.map((a) => ({
      key: `attempt-${a.id}`,
      kind: 'attempt' as const,
      title: a.itemTitle ?? 'Untitled course',
      detail: `${a.email} \u00b7 scored ${a.score}%`,
      at: a.createdAt,
    })),
    ...titleOnlyAssessments.map((a) => ({
      key: `assessment-${a.id}`,
      kind: 'transcript' as const,
      title: a.itemTitle ?? 'Untitled course',
      detail: 'Assessment was built from the title only',
      at: a.createdAt,
    })),
  ]
    .sort((x, y) => y.at.getTime() - x.at.getTime())
    .slice(0, LIST_LIMIT);

  return {
    metrics: {
      totalUsers: Number(totalUsers[0]?.value ?? 0),
      activeUsers: Number(activeUsers[0]?.value ?? 0),
      videosAdded: Number(videosAdded[0]?.value ?? 0),
      assessmentsTaken: Number(attemptStats[0]?.total ?? 0),
      attemptsTotal: Number(attemptStats[0]?.total ?? 0),
      attemptsPassed: Number(attemptStats[0]?.passed ?? 0),
      credentialsIssued: Number(credentialStats[0]?.total ?? 0),
      credentialsRevoked: Number(credentialStats[0]?.revoked ?? 0),
    },
    recentUsers: recentUsers.map((u) => {
      const full = [u.firstName, u.lastName].filter(Boolean).join(' ');
      return {
        id: u.id,
        displayName: full || u.username || u.name || u.email,
        email: u.email,
        planLabel: !u.plan || u.plan === 'none' ? 'Free' : u.plan,
        isAdmin: u.role === 'admin',
        joinedAt: u.joinedAt,
      };
    }),
    recentCredentials: recentCredentials.map((c) => ({
      id: c.id,
      holderName: c.holderName,
      itemTitle: c.itemTitle,
      score: c.score,
      status: c.status,
      passedAt: c.passedAt,
    })),
    failures,
  };
}
