import { count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import {
  assessmentsTable,
  attemptsTable,
  credentialsTable,
  learningItemsTable,
  usersTable,
  type AssessmentQuestion,
} from '@/utils/db/schema';

// Deliberately NOT a 'use server' file: every export of a server-actions
// module becomes a publicly callable endpoint (same rule as
// app/auth/onboarding-status.ts). Server-only data loader for
// /admin/assessments.

export const ASSESSMENTS_PAGE_SIZE = 20;

/**
 * Generation status derived from assessments.source (schema.ts comment):
 * - 'transcriptapi' -> grounded in the real transcript (healthy)
 * - 'metadata'      -> FAILED generation: no transcript/captions were
 *                      available, so the questions were built from the
 *                      title/channel only. Surfaced prominently.
 * - 'captions'      -> legacy YouTube-timedtext generation, kept for old rows
 */
export type GenerationStatus = 'ready' | 'failed' | 'legacy';

export function generationStatus(source: string): GenerationStatus {
  if (source === 'transcriptapi') return 'ready';
  if (source === 'captions') return 'legacy';
  return 'failed';
}

/** Shared chip styling/labels for generation status (list + detail). */
export const statusChip: Record<GenerationStatus, string> = {
  ready: 'bg-linen text-clay',
  failed: 'bg-red-600 text-white',
  legacy: 'border border-sandline bg-paper text-clay',
};

export const statusLabel: Record<GenerationStatus, string> = {
  ready: 'Generated',
  failed: 'Failed \u00b7 title only',
  legacy: 'Legacy \u00b7 captions',
};

export type AdminAssessmentAttemptSummary = {
  answers: number[];
  correctCount: number;
  score: number;
  passed: boolean;
  at: Date;
};

export type AdminAssessmentRow = {
  id: string;
  courseTitle: string;
  kind: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  questionCount: number;
  source: string;
  status: GenerationStatus;
  attemptCount: number;
  credentialCount: number;
  latest: AdminAssessmentAttemptSummary | null;
  createdAt: Date;
};

export type AdminAssessmentList = {
  rows: AdminAssessmentRow[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
  /** Filter state so the page can render the active tab. */
  status: 'all' | 'failed';
  /** Count of degraded generations across ALL rows (banner), unfiltered. */
  failedTotal: number;
};

/** Correct answers in one attempt, scored against the stored questions. */
function countCorrect(questions: AssessmentQuestion[], answers: number[]): number {
  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].correct) correct++;
  }
  return correct;
}

/**
 * Searchable, paginated assessment list. Each row joins the owning learning
 * item and user, then hydrates attempt/credential aggregates for the page's
 * assessment ids in grouped queries (no join fan-out). The latest attempt per
 * assessment carries the visible score/pass/answers columns.
 */
export async function getAdminAssessments(
  query: string,
  page: number,
  status: 'all' | 'failed'
): Promise<AdminAssessmentList> {
  const q = query.trim();
  // ILIKE wildcards in user input would otherwise act as globs; escape them.
  const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

  const searchFilter = q
    ? or(
        ilike(learningItemsTable.title, pattern),
        ilike(learningItemsTable.youtube_id, pattern),
        ilike(usersTable.name, pattern),
        ilike(usersTable.email, pattern),
        ilike(usersTable.username, pattern)
      )
    : undefined;
  const statusFilter =
    status === 'failed' ? ne(assessmentsTable.source, 'transcriptapi') : undefined;
  const where = [searchFilter, statusFilter].filter(Boolean) as (SQL<unknown> | undefined)[];
  const whereClause = where.length > 0 ? sql`${sql.join(where, sql` and `)}` : undefined;

  const [totalRows, failedRows] = await Promise.all([
    db.select({ value: count() }).from(assessmentsTable).where(whereClause),
    db
      .select({ value: count() })
      .from(assessmentsTable)
      .where(ne(assessmentsTable.source, 'transcriptapi')),
  ]);
  const total = Number(totalRows[0]?.value ?? 0);
  const failedTotal = Number(failedRows[0]?.value ?? 0);

  const pageCount = Math.max(1, Math.ceil(total / ASSESSMENTS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const assessments = await db
    .select({
      id: assessmentsTable.id,
      source: assessmentsTable.source,
      questions: assessmentsTable.questions,
      createdAt: assessmentsTable.created_at,
      itemTitle: learningItemsTable.title,
      youtubeId: learningItemsTable.youtube_id,
      kind: learningItemsTable.kind,
      userId: usersTable.id,
      firstName: usersTable.first_name,
      lastName: usersTable.last_name,
      username: usersTable.username,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(assessmentsTable)
    .innerJoin(learningItemsTable, eq(assessmentsTable.learning_item_id, learningItemsTable.id))
    .innerJoin(usersTable, eq(learningItemsTable.user_id, usersTable.id))
    .where(whereClause)
    .orderBy(desc(assessmentsTable.created_at))
    .limit(ASSESSMENTS_PAGE_SIZE)
    .offset((safePage - 1) * ASSESSMENTS_PAGE_SIZE);

  const ids = assessments.map((a) => a.id);
  const { attemptsByAssessment, credentialCounts } = await getAttemptAggregates(ids);

  const rows: AdminAssessmentRow[] = assessments.map((a) => {
    const attempts = attemptsByAssessment.get(a.id) ?? [];
    const latest = attempts[0];
    const full = [a.firstName, a.lastName].filter(Boolean).join(' ');
    return {
      id: a.id,
      courseTitle: a.itemTitle ?? `YouTube video ${a.youtubeId}`,
      kind: a.kind,
      userId: a.userId,
      userDisplayName: full || a.username || a.name || a.email,
      userEmail: a.email,
      questionCount: a.questions.length,
      source: a.source,
      status: generationStatus(a.source),
      attemptCount: attempts.length,
      credentialCount: credentialCounts.get(a.id) ?? 0,
      latest: latest
        ? {
            answers: latest.answers,
            correctCount: countCorrect(a.questions, latest.answers),
            score: latest.score,
            passed: latest.passed,
            at: latest.created_at,
          }
        : null,
      createdAt: a.createdAt,
    };
  });

  return { rows, total, page: safePage, pageCount, query: q, status, failedTotal };
}

/** Latest-first attempts per assessment + credential counts, for one page. */
async function getAttemptAggregates(assessmentIds: string[]): Promise<{
  attemptsByAssessment: Map<
    string,
    { answers: number[]; score: number; passed: boolean; created_at: Date }[]
  >;
  credentialCounts: Map<string, number>;
}> {
  const byAssessment = new Map<
    string,
    { answers: number[]; score: number; passed: boolean; created_at: Date }[]
  >();
  const credentialCounts = new Map<string, number>();
  if (assessmentIds.length === 0) return { attemptsByAssessment: byAssessment, credentialCounts };

  const [attemptRows, credentialRows] = await Promise.all([
    db
      .select({
        id: attemptsTable.id,
        assessmentId: attemptsTable.assessment_id,
        answers: attemptsTable.answers,
        score: attemptsTable.score,
        passed: attemptsTable.passed,
        createdAt: attemptsTable.created_at,
      })
      .from(attemptsTable)
      .where(inArray(attemptsTable.assessment_id, assessmentIds))
      .orderBy(desc(attemptsTable.created_at)),
    db
      .select({ assessmentId: attemptsTable.assessment_id, value: count() })
      .from(credentialsTable)
      .innerJoin(attemptsTable, eq(credentialsTable.attempt_id, attemptsTable.id))
      .where(inArray(attemptsTable.assessment_id, assessmentIds))
      .groupBy(attemptsTable.assessment_id),
  ]);

  for (const a of attemptRows) {
    const list = byAssessment.get(a.assessmentId) ?? [];
    list.push({
      answers: a.answers,
      score: a.score,
      passed: a.passed,
      created_at: a.createdAt,
    });
    byAssessment.set(a.assessmentId, list);
  }
  for (const c of credentialRows) {
    credentialCounts.set(c.assessmentId, Number(c.value));
  }
  return { attemptsByAssessment: byAssessment, credentialCounts };
}

export type AdminAssessmentDetailAttempt = {
  id: string;
  score: number;
  passed: boolean;
  answers: number[];
  correctCount: number;
  at: Date;
  userEmail: string;
};

export type AdminAssessmentDetail = {
  id: string;
  itemId: string;
  courseTitle: string;
  youtubeId: string;
  kind: string;
  source: string;
  status: GenerationStatus;
  createdAt: Date;
  user: { id: string; displayName: string; email: string };
  questions: AssessmentQuestion[];
  attempts: AdminAssessmentDetailAttempt[];
  attemptCount: number;
  credentialCount: number;
};

export async function getAdminAssessmentDetail(id: string): Promise<AdminAssessmentDetail | null> {
  const rows = await db
    .select({
      id: assessmentsTable.id,
      source: assessmentsTable.source,
      questions: assessmentsTable.questions,
      createdAt: assessmentsTable.created_at,
      itemId: learningItemsTable.id,
      itemTitle: learningItemsTable.title,
      youtubeId: learningItemsTable.youtube_id,
      kind: learningItemsTable.kind,
      userId: usersTable.id,
      firstName: usersTable.first_name,
      lastName: usersTable.last_name,
      username: usersTable.username,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(assessmentsTable)
    .innerJoin(learningItemsTable, eq(assessmentsTable.learning_item_id, learningItemsTable.id))
    .innerJoin(usersTable, eq(learningItemsTable.user_id, usersTable.id))
    .where(eq(assessmentsTable.id, id));

  const a = rows[0];
  if (!a) return null;

  const [attemptRows, credentialRows] = await Promise.all([
    db
      .select({
        id: attemptsTable.id,
        score: attemptsTable.score,
        passed: attemptsTable.passed,
        answers: attemptsTable.answers,
        at: attemptsTable.created_at,
        email: usersTable.email,
      })
      .from(attemptsTable)
      .innerJoin(usersTable, eq(attemptsTable.user_id, usersTable.id))
      .where(eq(attemptsTable.assessment_id, id))
      .orderBy(desc(attemptsTable.created_at)),
    db
      .select({ value: count() })
      .from(credentialsTable)
      .innerJoin(attemptsTable, eq(credentialsTable.attempt_id, attemptsTable.id))
      .where(eq(attemptsTable.assessment_id, id)),
  ]);

  const full = [a.firstName, a.lastName].filter(Boolean).join(' ');
  return {
    id: a.id,
    itemId: a.itemId,
    courseTitle: a.itemTitle ?? `YouTube video ${a.youtubeId}`,
    youtubeId: a.youtubeId,
    kind: a.kind,
    source: a.source,
    status: generationStatus(a.source),
    createdAt: a.createdAt,
    user: {
      id: a.userId,
      displayName: full || a.username || a.name || a.email,
      email: a.email,
    },
    questions: a.questions,
    attempts: attemptRows.map((t) => ({
      id: t.id,
      score: t.score,
      passed: t.passed,
      answers: t.answers,
      correctCount: countCorrect(a.questions, t.answers),
      at: t.at,
      userEmail: t.email,
    })),
    attemptCount: attemptRows.length,
    credentialCount: Number(credentialRows[0]?.value ?? 0),
  };
}
