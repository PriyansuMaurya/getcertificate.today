'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { learningItemsTable } from '@/utils/db/schema';
import { getVideoMeta, parseYouTubeVideoId } from '@/utils/youtube';
import { reconcileWatchProgress, type WatchRange } from '@/utils/watch-progress';

export type LearningActionState = { message: string; success?: boolean };

/** Add a YouTube video to the learner's list (FR-C1). Server re-validates. */
export async function addLearningItem(
  _currentState: LearningActionState,
  formData: FormData
): Promise<LearningActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rawUrl = (formData.get('youtubeUrl') as string | null)?.trim() ?? '';
  if (!rawUrl) {
    return { message: 'Please paste a YouTube link.' };
  }

  const youtubeId = parseYouTubeVideoId(rawUrl);
  if (!youtubeId) {
    return {
      message: 'That does not look like a YouTube video link. Paste a watch or youtu.be URL.',
    };
  }

  // Advisory pre-check; the (user_id, youtube_id) unique index is the authority.
  const existing = await db
    .select({ id: learningItemsTable.id })
    .from(learningItemsTable)
    .where(
      and(eq(learningItemsTable.user_id, user.id), eq(learningItemsTable.youtube_id, youtubeId))
    );
  if (existing.length > 0) {
    return { message: 'You have already added this video to your list.' };
  }

  const meta = await getVideoMeta(youtubeId);

  try {
    await db.insert(learningItemsTable).values({
      id: randomUUID(),
      user_id: user.id,
      source_url: meta.sourceUrl,
      youtube_id: youtubeId,
      title: meta.title,
      author: meta.author,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { message: 'You have already added this video to your list.' };
    }
    console.error('[learning] add failed:', msg || 'unknown error');
    return { message: 'Could not add that video. Please try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/learning');
  return { message: '' };
}

/** Remove a learning item. Blocked when a credential already attests to it (RULES §18.4). */
export async function deleteLearningItem(
  _currentState: LearningActionState,
  formData: FormData
): Promise<LearningActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const itemIdRaw = formData.get('itemId');
  if (typeof itemIdRaw !== 'string' || !itemIdRaw) return { message: 'Missing item.' };
  const itemId = itemIdRaw;

  const rows = await db
    .select({ id: learningItemsTable.id })
    .from(learningItemsTable)
    .where(and(eq(learningItemsTable.id, itemId), eq(learningItemsTable.user_id, user.id)));
  if (rows.length === 0) return { message: 'That course was not found.' };

  try {
    await db.delete(learningItemsTable).where(eq(learningItemsTable.id, itemId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    console.error('[learning] delete failed:', msg || 'unknown');
    // FK from credentials (no cascade) fires when a credential attests to this item.
    if (msg.includes('foreign key')) {
      return {
        message:
          'This course has an earned credential and cannot be deleted - credentials stay verifiable.',
      };
    }
    return { message: 'Could not delete that course. Please try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/learning');
  return { message: '' };
}

export type ProgressResult = {
  ok: boolean;
  percent: number;
  watchedSeconds: number;
  /** True when the failure is temporary (over budget) and worth retrying. */
  retryable: boolean;
};

/**
 * Persist unique watch progress from the embedded player (FR-C4).
 *
 * The client reports the contiguous spans it actually played (`segments`), not
 * a single current timestamp. The server keeps the canonical union of those
 * spans on the item - so a forward seek contributes nothing, scrubbing back and
 * forth never double-counts, and `progress_percent` (derived from unique
 * watched seconds, never from `position_seconds`) cannot be forged by posting a
 * large position. A multiplicative wall-clock budget bounds how much new credit
 * one request may claim, defeating a single "I watched everything" payload and
 * request flooding alike.
 *
 * The ≥80% assessment gate is re-checked server-side from the stored value
 * (FR-C5 AC3).
 *
 * `retryable` distinguishes a temporary over-budget rejection (keep the spans,
 * retry) from a terminal failure (unauthenticated/malformed/missing item).
 */
export async function saveProgress(
  itemId: string,
  positionSeconds: number,
  durationSeconds: number,
  segments: WatchRange[] = []
): Promise<ProgressResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, percent: 0, watchedSeconds: 0, retryable: false };

  if (
    typeof itemId !== 'string' ||
    !itemId ||
    itemId.length > 128 ||
    !Number.isFinite(positionSeconds) ||
    !Number.isFinite(durationSeconds)
  ) {
    return { ok: false, percent: 0, watchedSeconds: 0, retryable: false };
  }

  // Row-locked read-modify-write: two concurrent saves (e.g. two tabs) must not
  // clobber each other's watched_ranges and lose real credit.
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: learningItemsTable.id,
        duration_seconds: learningItemsTable.duration_seconds,
        progress_percent: learningItemsTable.progress_percent,
        watched_seconds: learningItemsTable.watched_seconds,
        watched_ranges: learningItemsTable.watched_ranges,
        last_watched_at: learningItemsTable.last_watched_at,
      })
      .from(learningItemsTable)
      .where(and(eq(learningItemsTable.id, itemId), eq(learningItemsTable.user_id, user.id)))
      .for('update');
    if (rows.length === 0) {
      return { ok: false, percent: 0, watchedSeconds: 0, retryable: false };
    }
    const row = rows[0];

    const incomingDuration = Math.max(0, Math.floor(durationSeconds));
    // Keep the largest duration seen; a torn-down player can report 0 mid-session.
    const duration = Math.max(row.duration_seconds, incomingDuration);
    const position =
      duration > 0
        ? Math.min(duration, Math.max(0, Math.floor(positionSeconds)))
        : Math.max(0, Math.floor(positionSeconds));

    // Reconcile the client's proposed spans against the canonical set and the
    // anti-forgery budget (pure + unit-tested: utils/watch-progress.ts
    // reconcileWatchProgress). Overlaps merge so unique seconds are counted
    // once, and a single "I watched the whole video" span is rejected.
    const outcome = reconcileWatchProgress({
      storedRanges: row.watched_ranges,
      storedWatchedSeconds: row.watched_seconds,
      duration,
      segments,
      elapsedSeconds: row.last_watched_at
        ? (Date.now() - row.last_watched_at.getTime()) / 1000
        : null,
    });
    const percent = Math.max(row.progress_percent, outcome.percent);

    await tx
      .update(learningItemsTable)
      .set({
        position_seconds: position,
        duration_seconds: duration,
        progress_percent: percent,
        watched_seconds: outcome.watchedSeconds,
        watched_ranges: outcome.ranges,
        // Advance the rate-limit clock on every sample (accepted or not) so a
        // burst of requests cannot bank budget.
        last_watched_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(learningItemsTable.id, itemId));

    return {
      ok: outcome.accepted,
      percent,
      watchedSeconds: outcome.watchedSeconds,
      retryable: !outcome.accepted,
    } satisfies ProgressResult;
  });
}
