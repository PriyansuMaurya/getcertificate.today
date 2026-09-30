'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, gte } from 'drizzle-orm';
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
  MAX_ATTEMPTS_PER_WINDOW,
  PASS_SCORE,
  UNLOCK_PERCENT,
  FREE_CREDENTIALS_PER_MONTH,
  attemptWindowCutoff,
  computeCredentialHash,
  hasFreeQuotaRemaining,
  monthWindowStart,
  newCredentialId,
} from '@/utils/credentials';
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

  const itemId = formData.get('itemId') as string | null;
  if (!itemId) return { message: 'Missing course.' };

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
    // the learning item row — both were stored when the video was added, so no
    // extra oEmbed/captions round-trip is needed here.
    const { transcript } = await getTranscript(item.youtube_id);
    generated = await generateAssessment(title, item.author, transcript);
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
    // Concurrent start: another request inserted first — reuse it. Detect the
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
 * correctness, the correct choice, and both explanations (FR-D3 — answers and
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

  const item = await getOwnedItem(itemId, user.id);
  if (!item) return { message: 'That course was not found.' };
  if (item.progress_percent < UNLOCK_PERCENT) {
    return { message: 'This assessment is locked until you finish the course.' };
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

  // Same attempt-window gate as submitAssessment — no feedback after the
  // weekly attempt limit is exhausted.
  const windowAttempts = await attemptsInWindow(assessment.id, user.id);
  if (windowAttempts.length >= MAX_ATTEMPTS_PER_WINDOW) {
    return {
      message: `Attempt limit reached (${MAX_ATTEMPTS_PER_WINDOW} per ${ATTEMPT_COOLDOWN_DAYS} days).`,
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

  const itemId = formData.get('itemId') as string | null;
  if (!itemId) return { message: 'Missing course.' };

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

  const windowAttempts = await attemptsInWindow(assessment.id, user.id);
  if (windowAttempts.length >= MAX_ATTEMPTS_PER_WINDOW) {
    const latest = windowAttempts[windowAttempts.length - 1].created_at;
    const available = new Date(latest.getTime() + ATTEMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    return {
      message: `Attempt limit reached (${MAX_ATTEMPTS_PER_WINDOW} per ${ATTEMPT_COOLDOWN_DAYS} days). You can try again after ${available.toUTCString().slice(0, 16)}.`,
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
  const passed = score >= PASS_SCORE;

  const attemptId = randomUUID();

  try {
    await db.transaction(async (tx) => {
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

      const existingCred = await tx
        .select({ id: credentialsTable.id })
        .from(credentialsTable)
        .where(
          and(eq(credentialsTable.user_id, user.id), eq(credentialsTable.learning_item_id, itemId))
        );
      if (existingCred.length > 0) return; // already minted for this course

      const profileRows = await tx.select().from(usersTable).where(eq(usersTable.id, user.id));
      const profile = profileRows[0];

      const monthStart = monthWindowStart();
      const credsThisMonth = await tx
        .select({ id: credentialsTable.id })
        .from(credentialsTable)
        .where(
          and(eq(credentialsTable.user_id, user.id), gte(credentialsTable.passed_at, monthStart))
        );
      if (!hasFreeQuotaRemaining(credsThisMonth.length, profile?.plan ?? 'none')) return;

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
    console.error('[assessment] submit failed:', err instanceof Error ? err.message : 'unknown');
    return { message: 'Could not save your attempt. Please try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/certificates');
  redirect(`/learn/${itemId}/assessment/result?attempt=${attemptId}`);
}

/**
 * Mint a credential from an already-passing attempt — used when quota was
 * exhausted at pass time (e.g. the user upgraded afterwards).
 */
export async function mintFromAttempt(
  _currentState: AssessmentActionState,
  formData: FormData
): Promise<AssessmentActionState> {
  const user = await requireUser();
  if (!user) redirect('/login');

  const attemptId = formData.get('attemptId') as string | null;
  if (!attemptId) return { message: 'Missing attempt.' };

  const attemptRows = await db
    .select()
    .from(attemptsTable)
    .where(and(eq(attemptsTable.id, attemptId), eq(attemptsTable.user_id, user.id)));
  const attempt = attemptRows[0];
  if (!attempt) return { message: 'That attempt was not found.' };
  if (!attempt.passed) return { message: 'Only passed attempts can become credentials.' };

  const item = await getOwnedItem(attempt.learning_item_id, user.id);
  if (!item) return { message: 'That course was not found.' };

  let mintedId: string | null = null;
  try {
    await db.transaction(async (tx) => {
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

      const credsThisMonth = await tx
        .select({ id: credentialsTable.id })
        .from(credentialsTable)
        .where(
          and(
            eq(credentialsTable.user_id, user.id),
            gte(credentialsTable.passed_at, monthWindowStart())
          )
        );
      if (!hasFreeQuotaRemaining(credsThisMonth.length, profile?.plan ?? 'none')) return;

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
    // NEXT_REDIRECT from a nested redirect would be rethrown — none occurs here.
    console.error('[credential] mint failed:', err instanceof Error ? err.message : 'unknown');
    return { message: 'Could not mint the credential. Please try again.' };
  }

  // `redirect` must sit outside try/catch or Next's redirect error gets swallowed.
  if (mintedId) {
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/certificates');
    redirect(`/certificates/${mintedId}`);
  }

  return {
    message: `Free plan includes ${FREE_CREDENTIALS_PER_MONTH} credential per month. Upgrade to Professional to mint this one now.`,
  };
}
