'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, gte, sql } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import {
  assessmentsTable,
  attemptsTable,
  credentialsTable,
  learningItemsTable,
  usersTable,
} from '@/utils/db/schema';
import {
  ATTEMPT_COOLDOWN_DAYS,
  UNLOCK_PERCENT,
  attemptWindowCutoff,
  computeCredentialHash,
  hasCredentialQuotaRemaining,
  isAdminAccount,
  monthWindowStart,
  newCredentialId,
} from '@/utils/credentials';
import { getSettings } from '@/utils/settings';
import { monthlyCertificateLimit, planLabel } from '@/utils/plans';
import { SUSPENDED_MESSAGE, isAccountSuspended } from '@/utils/auth';
import {
  AIUnavailableError,
  AIRateLimitError,
  AITimeoutError,
  generateAssessment,
} from '@/utils/ai';
import {
  TranscriptAPIError,
  TranscriptNotConfiguredError,
  TranscriptNotFoundError,
  TranscriptRateLimitError,
  TranscriptTimeoutError,
  getTranscript,
} from '@/utils/transcripts';

export type AssessmentActionState = { message: string; success?: boolean };

/** Thrown inside submitAssessment's transaction when a racing submit consumed the last attempt. */
class AttemptLimitError extends Error {
  readonly retryAfterUtc: string;
  constructor(retryAfterUtc: string) {
    super('Attempt limit reached in this window.');
    this.name = 'AttemptLimitError';
    this.retryAfterUtc = retryAfterUtc;
  }
}

/** Shared attempt-limit copy so the fast-path and in-lock races read the same. */
function attemptLimitMessage(maxAttemptsPerWindow: number, retryAfterUtc?: string) {
  const base = `Attempt limit reached (${maxAttemptsPerWindow} per ${ATTEMPT_COOLDOWN_DAYS} days)`;
  return retryAfterUtc
    ? `${base}. You can try again after ${retryAfterUtc}.`
    : `${base}. Please try again later.`;
}

/** Feedback returned after the server validates one committed answer. */
export type AnswerFeedback = {
  correct: boolean;
  correctIndex: number;
  selectedText: string;
  correctText: string;
  explanation: string;
  selectedExplanation: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function displayTitle(title: string | null, youtubeId: string): string {
  return title && title.trim().length > 0 ? title : `YouTube video ${youtubeId}`;
}

async function getOwnedItem(itemId: string, userId: string) {
  // IDs travel from the client - only accept opaque text ids (uuids) so a
  // non-string payload can never reach the query builder.
  if (typeof itemId !== 'string' || itemId.length === 0 || itemId.length > 128) return null;
  const rows = await db
    .select()
    .from(learningItemsTable)
    .where(and(eq(learningItemsTable.id, itemId), eq(learningItemsTable.user_id, userId)));
  return rows[0] ?? null;
}

async function attemptsInWindow(assessmentId: string, userId: string) {
  const rows = await db
    .select({ created_at: attemptsTable.created_at })
    .from(attemptsTable)
    .where(
      and(
        eq(attemptsTable.assessment_id, assessmentId),
        eq(attemptsTable.user_id, userId),
        gte(attemptsTable.created_at, attemptWindowCutoff())
      )
    )
    .orderBy(attemptsTable.created_at);
  return rows;
}

/**
 * Generate (once) the assessment for a learning item after the server-side 80%
 * gate passes, then open the assessment route (FR-C5, FR-D2). Idempotent: an
 * existing assessment is reused, never regenerated.
 *
 * Transcript flow: DB cache by YouTube video ID → TranscriptAPI fetch → store
 * → LLM generation grounded strictly in the transcript (never re-fetched for
 * the same video).
 */
export async function startAssessment(
  _currentState: AssessmentActionState,
  formData: FormData
): Promise<AssessmentActionState> {
  const user = await requireUser();
  if (!user) redirect('/login');
  // Enforce an admin suspension immediately: the edge proxy cannot reach
  // Postgres, so this action is a server-side gate (see utils/auth.ts).
  if (await isAccountSuspended(user.id)) return { message: SUSPENDED_MESSAGE };

  const itemId = formData.get('itemId');
  if (typeof itemId !== 'string' || !itemId) return { message: 'Missing course.' };

  const item = await getOwnedItem(itemId, user.id);
  if (!item) return { message: 'That course was not found.' };

  if (item.progress_percent < UNLOCK_PERCENT) {
    return {
      message: `Watch at least ${UNLOCK_PERCENT}% of the course to unlock the assessment (you are at ${item.progress_percent}%).`,
    };
  }

  const existing = await db
    .select({ id: assessmentsTable.id })
    .from(assessmentsTable)
    .where(eq(assessmentsTable.learning_item_id, itemId));
  if (existing.length > 0) {
    redirect(`/learn/${itemId}/assessment`);
  }

  const title = displayTitle(item.title, item.youtube_id);
  let generated: Awaited<ReturnType<typeof generateAssessment>>;
  try {
    // Cache-first TranscriptAPI fetch (DB → API → DB). Title/author come from
    // the learning item row - both were stored when the video was added, so no
    // extra oEmbed/captions round-trip is needed here.
    const { transcript } = await getTranscript(item.youtube_id);
    // duration_seconds came from the player when the course was added; it drives
    // how many questions the quiz gets (one per minute, capped), so pass it in.
    generated = await generateAssessment(title, item.author, transcript, item.duration_seconds);
  } catch (err) {
    if (err instanceof TranscriptNotConfiguredError) {
      return {
        message:
          'Transcript API is not configured yet. Set TRANSCRIPTAPI_KEY to enable assessment generation.',
      };
    }
    if (err instanceof TranscriptNotFoundError) {
      return {
        message:
          'No transcript is available for this video (it may have no captions), so an assessment cannot be generated. Try another course.',
      };
    }
    if (err instanceof TranscriptRateLimitError) {
      return {
        message: 'The transcript service is busy right now. Please try again in a moment.',
      };
    }
    if (err instanceof TranscriptTimeoutError) {
      return {
        message: 'Fetching the transcript took too long. Please try again in a moment.',
      };
    }
    if (err instanceof TranscriptAPIError) {
      if (err.message.startsWith('Invalid YouTube video ID')) {
        return {
          message: 'This course has an invalid YouTube URL, so its transcript cannot be fetched.',
        };
      }
      console.error('[assessment] transcript fetch failed:', err.message);
      return {
        message: "We could not fetch this video's transcript. Please try again in a moment.",
      };
    }
    if (err instanceof AIUnavailableError) {
      return {
        message:
          'AI assessments are not configured yet. Set OPENAI_API_KEY to enable question generation.',
      };
    }
    if (err instanceof AIRateLimitError) {
      return {
        message: 'The AI service is rate-limited right now. Please try again in a moment.',
      };
    }
    if (err instanceof AITimeoutError) {
      return {
        message: 'Question generation took too long. Please try again in a moment.',
      };
    }
    console.error(
      '[assessment] generation failed:',
      err instanceof Error ? err.message : 'unknown'
    );
    return {
      message:
        'We could not generate the assessment for this course. Please try again in a moment.',
    };
  }

  try {
    await db.insert(assessmentsTable).values({
      id: randomUUID(),
      learning_item_id: itemId,
      source: generated.source,
      questions: generated.questions,
    });
  } catch (err) {
    // Concurrent start: another request inserted first - reuse it. Detect the
    // unique violation by SQLSTATE (23505): drizzle's message only contains
    // the SQL + params, while the Postgres details live on the error itself
    // (or its `cause` when the driver error is wrapped).
    const e = err as { code?: string; cause?: { code?: string } } | null;
    const code = e?.code ?? e?.cause?.code;
    if (code !== '23505') {
      console.error('[assessment] insert failed:', code ?? 'unknown', err);
      return { message: 'Could not save the assessment. Please try again.' };
    }
  }

  revalidatePath(`/learn/${itemId}/assessment`);
  redirect(`/learn/${itemId}/assessment`);
}

/**
 * Validate one committed answer server-side and return instant feedback:
 * correctness, the correct choice, and both explanations (FR-D3 - answers and
 * explanations never ship in the page payload; they cross the wire only after
 * the learner selects a choice). Ownership + 80% gate re-checked every call.
 */
export async function checkAnswer(
  itemId: string,
  questionIndex: number,
  choice: number
): Promise<AnswerFeedback | { message: string }> {
  const user = await requireUser();
  if (!user) return { message: 'Your session has expired. Please sign in again.' };
  if (await isAccountSuspended(user.id)) return { message: SUSPENDED_MESSAGE };

  const item = await getOwnedItem(itemId, user.id);
  if (!item) return { message: 'That course was not found.' };
  if (item.progress_percent < UNLOCK_PERCENT) {
    return { message: 'This assessment is locked until you finish the course.' };
  }

  // Integer-only index bounds check before touching the questions array - a
  // fractional/negative/non-numeric index would otherwise probe beyond bounds.
  if (!Number.isInteger(questionIndex) || questionIndex < 0) {
    return { message: 'That question does not exist.' };
  }
  if (!Number.isInteger(choice) || choice < 0) {
    return { message: 'That answer is not a valid choice.' };
  }

  const assessmentRows = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.learning_item_id, itemId));
  const assessment = assessmentRows[0];
  if (!assessment) return { message: 'No assessment exists for this course yet.' };

  const question = assessment.questions[questionIndex];
  if (!question) return { message: 'That question does not exist.' };
  if (!Number.isInteger(choice) || choice < 0 || choice >= question.choices.length) {
    return { message: 'That answer is not a valid choice.' };
  }

  // Same attempt-window gate as submitAssessment - no feedback after the
  // weekly attempt limit is exhausted. The limit is the live admin setting.
  const { maxAttemptsPerWindow } = await getSettings();
  const windowAttempts = await attemptsInWindow(assessment.id, user.id);
  if (windowAttempts.length >= maxAttemptsPerWindow) {
    const latest = windowAttempts[windowAttempts.length - 1].created_at;
    const available = new Date(latest.getTime() + ATTEMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    return {
      message: attemptLimitMessage(maxAttemptsPerWindow, available.toUTCString().slice(0, 16)),
    };
  }

  const correct = choice === question.correct;
  return {
    correct,
    correctIndex: question.correct,
    selectedText: question.choices[choice],
    correctText: question.choices[question.correct],
    explanation: question.explanation ?? '',
    selectedExplanation: question.choice_explanations?.[choice] ?? '',
  };
}

/**
 * Score an assessment attempt entirely server-side (FR-D3 AC2), persist the
 * attempt, and mint a credential transactionally on pass (FR-E1 AC2,
 * RULES §17.2) when quota allows (FR-B6).
 */
export async function submitAssessment(
  _currentState: AssessmentActionState,
  formData: FormData
): Promise<AssessmentActionState> {
  const user = await requireUser();
  if (!user) redirect('/login');
  // Enforce an admin suspension immediately: the edge proxy cannot reach
  // Postgres, so this action is a server-side gate (see utils/auth.ts).
  if (await isAccountSuspended(user.id)) return { message: SUSPENDED_MESSAGE };

  const itemId = formData.get('itemId');
  if (typeof itemId !== 'string' || !itemId) return { message: 'Missing course.' };

  const item = await getOwnedItem(itemId, user.id);
  if (!item) return { message: 'That course was not found.' };

  // Server-authoritative completion gate (FR-C5 AC3).
  if (item.progress_percent < UNLOCK_PERCENT) {
    return { message: 'This assessment is locked until you finish the course.' };
  }

  const assessmentRows = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.learning_item_id, itemId));
  const assessment = assessmentRows[0];
  if (!assessment) return { message: 'No assessment exists for this course yet.' };

  // Live admin settings: pass mark, attempt limit and free quota all come from
  // app_settings so a change at /admin/settings takes effect on the next submit.
  // Admins bypass the free quota entirely (unlimited).
  const { passScore, maxAttemptsPerWindow, freeCredentialsPerMonth } = await getSettings();

  const windowAttempts = await attemptsInWindow(assessment.id, user.id);
  if (windowAttempts.length >= maxAttemptsPerWindow) {
    const latest = windowAttempts[windowAttempts.length - 1].created_at;
    const available = new Date(latest.getTime() + ATTEMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    return {
      message: attemptLimitMessage(maxAttemptsPerWindow, available.toUTCString().slice(0, 16)),
    };
  }

  // Server re-validates every answer even though the client validated first.
  const answers: number[] = [];
  for (let i = 0; i < assessment.questions.length; i++) {
    const raw = formData.get(`q${i}`);
    if (typeof raw !== 'string' || !/^\d$/.test(raw)) {
      return { message: 'Please answer every question before submitting.' };
    }
    const choice = Number(raw);
    if (choice < 0 || choice >= assessment.questions[i].choices.length) {
      return { message: 'One of your answers was not a valid choice.' };
    }
    answers.push(choice);
  }

  const correct = assessment.questions.reduce(
    (sum, q, i) => sum + (answers[i] === q.correct ? 1 : 0),
    0
  );
  const score = Math.round((correct / assessment.questions.length) * 100);
  const passed = score >= passScore;

  const attemptId = randomUUID();

  try {
    await db.transaction(async (tx) => {
      // Serialize concurrent submits for this (user, assessment) pair so the
      // rolling attempt limit can't be exceeded by a racing double-submit.
      // xact lock is released automatically at commit/rollback.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`attempt:${user.id}:${assessment.id}`}))`
      );

      const lockedWindow = await tx
        .select({ created_at: attemptsTable.created_at })
        .from(attemptsTable)
        .where(
          and(
            eq(attemptsTable.assessment_id, assessment.id),
            eq(attemptsTable.user_id, user.id),
            gte(attemptsTable.created_at, attemptWindowCutoff())
          )
        );
      if (lockedWindow.length >= maxAttemptsPerWindow) {
        const latest = lockedWindow[lockedWindow.length - 1].created_at;
        const available = new Date(latest.getTime() + ATTEMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        throw new AttemptLimitError(available.toUTCString().slice(0, 16));
      }

      await tx.insert(attemptsTable).values({
        id: attemptId,
        assessment_id: assessment.id,
        user_id: user.id,
        learning_item_id: itemId,
        answers,
        score,
        passed,
      });

      if (!passed) return;

      // Serialize the monthly free-quota check per user: two concurrent passing
      // submits on *different* courses must not both see 0 credentials this
      // month and mint two free credentials.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`quota:${user.id}`}))`);

      const existingCred = await tx
        .select({ id: credentialsTable.id })
        .from(credentialsTable)
        .where(
          and(eq(credentialsTable.user_id, user.id), eq(credentialsTable.learning_item_id, itemId))
        );
      if (existingCred.length > 0) return; // already minted for this course

      const profileRows = await tx.select().from(usersTable).where(eq(usersTable.id, user.id));
      const profile = profileRows[0];
      // Admins are exempt from the free quota: unlimited regardless of the
      // configured limit or subscription status. The row is already in hand, so
      // reuse the shared admin rule instead of a second query.
      const isAdmin = isAdminAccount(profile?.role, profile?.suspended_at);

      const monthStart = monthWindowStart();
      const credsThisMonth = await tx
        .select({ id: credentialsTable.id })
        .from(credentialsTable)
        .where(
          and(eq(credentialsTable.user_id, user.id), gte(credentialsTable.passed_at, monthStart))
        );
      if (
        !hasCredentialQuotaRemaining(
          credsThisMonth.length,
          profile?.plan ?? 'none',
          freeCredentialsPerMonth,
          isAdmin
        )
      )
        return;

      const holderName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
        profile?.username ||
        user.email ||
        'Credential holder';
      const passedAt = new Date();
      const id = newCredentialId();
      const itemTitle = displayTitle(item.title, item.youtube_id);

      const hash = computeCredentialHash({
        id,
        user_id: user.id,
        learning_item_id: itemId,
        attempt_id: attemptId,
        holder_name: holderName,
        item_title: itemTitle,
        score,
        passed_at: passedAt,
      });

      await tx.insert(credentialsTable).values({
        id,
        user_id: user.id,
        learning_item_id: itemId,
        attempt_id: attemptId,
        holder_name: holderName,
        item_title: itemTitle,
        score,
        status: 'active',
        hash,
        passed_at: passedAt,
      });
    });
  } catch (err) {
    if (err instanceof AttemptLimitError) {
      return { message: attemptLimitMessage(maxAttemptsPerWindow, err.retryAfterUtc) };
    }
    console.error('[assessment] submit failed:', err instanceof Error ? err.message : 'unknown');
    return { message: 'Could not save your attempt. Please try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/certificates');
  redirect(`/learn/${itemId}/assessment/result?attempt=${attemptId}`);
}

/**
 * Mint a credential from an already-passing attempt - used when quota was
 * exhausted at pass time (e.g. the user upgraded afterwards).
 */
export async function mintFromAttempt(
  _currentState: AssessmentActionState,
  formData: FormData
): Promise<AssessmentActionState> {
  const user = await requireUser();
  if (!user) redirect('/login');
  // Enforce an admin suspension immediately: the edge proxy cannot reach
  // Postgres, so this action is a server-side gate (see utils/auth.ts).
  if (await isAccountSuspended(user.id)) return { message: SUSPENDED_MESSAGE };

  const attemptId = formData.get('attemptId');
  if (typeof attemptId !== 'string' || !attemptId) return { message: 'Missing attempt.' };

  const attemptRows = await db
    .select()
    .from(attemptsTable)
    .where(and(eq(attemptsTable.id, attemptId), eq(attemptsTable.user_id, user.id)));
  const attempt = attemptRows[0];
  if (!attempt) return { message: 'That attempt was not found.' };
  if (!attempt.passed) return { message: 'Only passed attempts can become credentials.' };

  const item = await getOwnedItem(attempt.learning_item_id, user.id);
  if (!item) return { message: 'That course was not found.' };

  // Live admin setting: the free monthly credential quota. Admins are exempt
  // (unlimited) regardless of the configured limit or subscription status.
  const { freeCredentialsPerMonth } = await getSettings();

  let mintedId: string | null = null;
  try {
    await db.transaction(async (tx) => {
      // Same per-user quota lock as submitAssessment - serializes concurrent
      // mint requests so the monthly free-credential quota cannot be exceeded
      // by a race between two tabs.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`quota:${user.id}`}))`);

      const existingCred = await tx
        .select({ id: credentialsTable.id })
        .from(credentialsTable)
        .where(
          and(eq(credentialsTable.user_id, user.id), eq(credentialsTable.learning_item_id, item.id))
        );
      if (existingCred.length > 0) {
        mintedId = existingCred[0].id;
        return;
      }

      const profileRows = await tx.select().from(usersTable).where(eq(usersTable.id, user.id));
      const profile = profileRows[0];
      // Admins are exempt from the free quota: unlimited regardless of the
      // configured limit or subscription status. The row is already in hand, so
      // reuse the shared admin rule instead of a second query.
      const isAdmin = isAdminAccount(profile?.role, profile?.suspended_at);

      const credsThisMonth = await tx
        .select({ id: credentialsTable.id })
        .from(credentialsTable)
        .where(
          and(
            eq(credentialsTable.user_id, user.id),
            gte(credentialsTable.passed_at, monthWindowStart())
          )
        );
      if (
        !hasCredentialQuotaRemaining(
          credsThisMonth.length,
          profile?.plan ?? 'none',
          freeCredentialsPerMonth,
          isAdmin
        )
      )
        return;

      const holderName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
        profile?.username ||
        user.email ||
        'Credential holder';
      const passedAt = new Date();
      const id = newCredentialId();
      const itemTitle = displayTitle(item.title, item.youtube_id);
      const hash = computeCredentialHash({
        id,
        user_id: user.id,
        learning_item_id: item.id,
        attempt_id: attempt.id,
        holder_name: holderName,
        item_title: itemTitle,
        score: attempt.score,
        passed_at: passedAt,
      });

      await tx.insert(credentialsTable).values({
        id,
        user_id: user.id,
        learning_item_id: item.id,
        attempt_id: attempt.id,
        holder_name: holderName,
        item_title: itemTitle,
        score: attempt.score,
        status: 'active',
        hash,
        passed_at: passedAt,
      });
      mintedId = id;
    });
  } catch (err) {
    // NEXT_REDIRECT from a nested redirect would be rethrown - none occurs here.
    console.error('[credential] mint failed:', err instanceof Error ? err.message : 'unknown');
    return { message: 'Could not mint the credential. Please try again.' };
  }

  // `redirect` must sit outside try/catch or Next's redirect error gets swallowed.
  if (mintedId) {
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/certificates');
    redirect(`/certificates/${mintedId}`);
  }

  // Quota was the only reason nothing was minted: report the user's real plan
  // allowance (Free/Starter/Pro) from the stored entitlement key. The lookup is
  // best-effort - a failure here must not replace the quota message with a 500.
  let limitedPlan: string | null = null;
  try {
    const [profilePlanRow] = await db
      .select({ plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, user.id));
    limitedPlan = profilePlanRow?.plan ?? null;
  } catch (err) {
    console.error(
      '[credential] quota message lookup failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
  }
  const limit = monthlyCertificateLimit(limitedPlan, freeCredentialsPerMonth);
  const limitText = limit === null ? 'unlimited' : `${limit}`;
  return {
    message: `You have reached your monthly certificate limit (${limitText}) on the ${planLabel(
      limitedPlan
    )} plan. Upgrade your plan to mint this one now, or wait until next month.`,
  };
}
