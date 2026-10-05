'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import {
  assessmentsTable,
  attemptsTable,
  credentialsTable,
  learningItemsTable,
} from '@/utils/db/schema';
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
import { requireAdmin } from '../require-admin';
import { safeAdminReturnPath, withDeletedNotice } from '../return-path';

export type AdminAssessmentActionState = { message: string; success?: boolean };

/**
 * Shared authorization for assessment-moderation actions. Every action in
 * this module starts here: requireAdmin() redirects signed-out callers to
 * /login and 404s non-admins before any mutation runs, so hiding the buttons
 * in the UI is never the security boundary.
 */
async function authorizeAssessment(
  assessmentId: string
): Promise<AdminAssessmentActionState | { assessmentId: string }> {
  // Ids are opaque text (uuid-like); bound the length so an oversized payload
  // never reaches the query builder.
  if (!assessmentId || assessmentId.length > 128) {
    return { message: 'Missing or invalid assessment id.' };
  }
  await requireAdmin();

  const rows = await db
    .select({ id: assessmentsTable.id })
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, assessmentId));
  if (rows.length === 0) {
    return { message: 'That assessment no longer exists.' };
  }
  return { assessmentId };
}

function targetOf(formData: FormData): string {
  return (formData.get('assessmentId') as string | null)?.trim() ?? '';
}

/** Maps the typed pipeline errors to operator-facing copy (same mapping as startAssessment). */
function pipelineErrorMessage(err: unknown): string {
  if (err instanceof TranscriptNotConfiguredError) {
    return 'Transcript API is not configured (TRANSCRIPTAPI_KEY missing).';
  }
  if (err instanceof TranscriptNotFoundError) {
    return 'No transcript is available for this video (no captions), so it cannot be regenerated.';
  }
  if (err instanceof TranscriptRateLimitError || err instanceof TranscriptTimeoutError) {
    return 'The transcript service is busy or slow right now. Please try again in a moment.';
  }
  if (err instanceof TranscriptAPIError) {
    return `Transcript fetch failed: ${err.message}`;
  }
  if (err instanceof AIUnavailableError) {
    return 'AI generation is not configured (OPENAI_API_KEY missing).';
  }
  if (err instanceof AIRateLimitError) {
    return 'The AI service is rate-limited right now. Please try again in a moment.';
  }
  if (err instanceof AITimeoutError) {
    return 'Question generation timed out. Please try again in a moment.';
  }
  console.error(
    '[admin] assessment regeneration failed:',
    err instanceof Error ? err.message : 'unknown'
  );
  return 'Question generation failed. Please try again in a moment.';
}

/**
 * Regenerate an assessment's questions in place.
 *
 * Uses the EXISTING production pipeline - the same getTranscript (DB-cache ->
 * TranscriptAPI) and generateAssessment (grounded LLM) calls that
 * startAssessment uses - so there is exactly one generation code path. The
 * row keeps its id; only `questions` and `source` are replaced.
 *
 * Blocked once learners have attempted it: replacing questions would leave
 * stored answers/scores pointing at question text that no longer matches.
 */
export async function regenerateAssessment(
  _currentState: AdminAssessmentActionState,
  formData: FormData
): Promise<AdminAssessmentActionState> {
  const assessmentId = targetOf(formData);
  const auth = await authorizeAssessment(assessmentId);
  if ('message' in auth) return auth;

  // Confirmation is enforced server-side, not only by the two-step dialog.
  if (formData.get('confirm') !== 'yes') {
    return { message: 'Confirmation required to regenerate an assessment.' };
  }

  const rows = await db
    .select({
      id: assessmentsTable.id,
      itemId: learningItemsTable.id,
      youtubeId: learningItemsTable.youtube_id,
      itemTitle: learningItemsTable.title,
      author: learningItemsTable.author,
    })
    .from(assessmentsTable)
    .innerJoin(learningItemsTable, eq(assessmentsTable.learning_item_id, learningItemsTable.id))
    .where(eq(assessmentsTable.id, assessmentId));
  const assessment = rows[0];
  if (!assessment) {
    return { message: 'That assessment no longer exists.' };
  }

  const attemptRows = await db
    .select({ id: attemptsTable.id })
    .from(attemptsTable)
    .where(eq(attemptsTable.assessment_id, assessmentId));
  if (attemptRows.length > 0) {
    return {
      message: `Cannot regenerate: ${attemptRows.length} attempt(s) already reference these questions.`,
    };
  }

  const title =
    assessment.itemTitle && assessment.itemTitle.trim().length > 0
      ? assessment.itemTitle
      : `YouTube video ${assessment.youtubeId}`;

  let generated: Awaited<ReturnType<typeof generateAssessment>>;
  try {
    // Same cache-first transcript fetch + grounded generation as startAssessment.
    const { transcript } = await getTranscript(assessment.youtubeId);
    generated = await generateAssessment(title, assessment.author, transcript);
  } catch (err) {
    return { message: pipelineErrorMessage(err) };
  }

  try {
    await db
      .update(assessmentsTable)
      .set({ questions: generated.questions, source: generated.source })
      .where(eq(assessmentsTable.id, assessmentId));
  } catch (err) {
    console.error(
      '[admin] assessment update failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not save the regenerated questions. Please try again.' };
  }

  revalidatePath('/admin/assessments');
  revalidatePath(`/admin/assessments/${assessmentId}`);
  // The learner-facing route reads the questions on every render.
  revalidatePath(`/learn/${assessment.itemId}/assessment`);
  return { message: 'Questions regenerated from the transcript.', success: true };
}

/**
 * Delete an assessment: attempts are deleted first (their FK to assessments
 * has no ON DELETE rule), but only when no issued credential references one
 * of those attempts - breaking a shared certificate is out of scope here.
 */
export async function deleteAssessment(
  _currentState: AdminAssessmentActionState,
  formData: FormData
): Promise<AdminAssessmentActionState> {
  const assessmentId = targetOf(formData);
  const auth = await authorizeAssessment(assessmentId);
  if ('message' in auth) return auth;

  // Confirmation is enforced server-side, not only by the two-step dialog.
  if (formData.get('confirm') !== 'yes') {
    return { message: 'Confirmation required to delete an assessment.' };
  }

  const attempts = await db
    .select({ id: attemptsTable.id })
    .from(attemptsTable)
    .where(eq(attemptsTable.assessment_id, assessmentId));
  const attemptIds = attempts.map((a) => a.id);

  if (attemptIds.length > 0) {
    const creds = await db
      .select({ id: credentialsTable.id })
      .from(credentialsTable)
      .where(inArray(credentialsTable.attempt_id, attemptIds));
    if (creds.length > 0) {
      return {
        message: `Cannot delete: ${creds.length} issued certificate(s) are tied to attempts on this assessment.`,
      };
    }
  }

  try {
    if (attemptIds.length > 0) {
      await db.delete(attemptsTable).where(eq(attemptsTable.assessment_id, assessmentId));
    }
    await db.delete(assessmentsTable).where(eq(assessmentsTable.id, assessmentId));
  } catch (err) {
    console.error(
      '[admin] assessment delete failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not delete this assessment. Please try again.' };
  }

  revalidatePath('/admin/assessments');
  revalidatePath(`/admin/assessments/${assessmentId}`);
  revalidatePath('/admin');
  // The deleted row unmounts on revalidation, so a row-level success message
  // would go with it. Redirect back to the list (filters preserved), where
  // AdminNotice confirms the deletion.
  redirect(withDeletedNotice(safeAdminReturnPath(formData.get('returnTo'), '/admin/assessments')));
}
