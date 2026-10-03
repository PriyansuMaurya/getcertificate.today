'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { learningItemsTable } from '@/utils/db/schema';
import { getVideoMeta, parseYouTubeVideoId } from '@/utils/youtube';

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

  const itemId = formData.get('itemId') as string | null;
  if (!itemId) return { message: 'Missing item.' };

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

/**
 * Persist watch progress from the embedded player (FR-C4). The client supplies
 * position/duration; the server clamps both and keeps progress monotonic so a
 * rewind can never lower the recorded percentage. The ≥80% assessment gate is
 * re-checked server-side from this stored value (FR-C5 AC3).
 */
export async function saveProgress(
  itemId: string,
  positionSeconds: number,
  durationSeconds: number
): Promise<{ ok: boolean; percent: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, percent: 0 };

  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) {
    return { ok: false, percent: 0 };
  }

  const rows = await db
    .select({
      id: learningItemsTable.id,
      progress_percent: learningItemsTable.progress_percent,
    })
    .from(learningItemsTable)
    .where(and(eq(learningItemsTable.id, itemId), eq(learningItemsTable.user_id, user.id)));
  if (rows.length === 0) return { ok: false, percent: 0 };

  const duration = Math.max(0, Math.floor(durationSeconds));
  const position =
    duration > 0
      ? Math.min(duration, Math.max(0, Math.floor(positionSeconds)))
      : Math.max(0, Math.floor(positionSeconds));

  const computed = duration > 0 ? Math.min(100, Math.floor((position / duration) * 100)) : 0;
  const percent = Math.max(rows[0].progress_percent, computed);

  await db
    .update(learningItemsTable)
    .set({
      position_seconds: position,
      duration_seconds: duration,
      progress_percent: percent,
      updated_at: new Date(),
    })
    .where(eq(learningItemsTable.id, itemId));

  return { ok: true, percent };
}
