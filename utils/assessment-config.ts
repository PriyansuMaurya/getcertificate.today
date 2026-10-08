// Shared, client-safe assessment configuration (no server-only imports, so the
// LLM generator, the server-rendered learn page and the admin UI can all read
// it).
//
// The question count is proportional to the video: one question per started
// minute of runtime, capped at MAX_ASSESSMENT_QUESTIONS. A video whose length is
// not known yet falls back to the admin-configured count (utils/settings.ts),
// which is why this module exposes a function and not just "the" count.

/** Fallback used when the video's runtime is unknown (duration_seconds = 0). */
export const ASSESSMENT_QUESTION_COUNT = 2;

/** Questions generated per minute of video runtime. */
export const QUESTIONS_PER_VIDEO_MINUTE = 1;

/** Hard ceiling on questions per assessment, however long the video is. */
export const MAX_ASSESSMENT_QUESTIONS = 50;

/** Coerce a count into a whole number within [1, MAX_ASSESSMENT_QUESTIONS]. */
function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_ASSESSMENT_QUESTIONS, Math.floor(value)));
}

/**
 * Questions for a video that runs `durationSeconds`: one per started minute,
 * clamped to 1..MAX_ASSESSMENT_QUESTIONS.
 *
 * A duration of 0 (the player has not reported a length yet, or a legacy row)
 * or a non-finite value uses `fallbackCount` instead. Pure and dependency-free
 * so the generator, the learn page copy and the unit tests all agree on the
 * number (utils/assessment-config.test.ts).
 */
export function assessmentQuestionCountForDuration(
  durationSeconds: number,
  fallbackCount: number
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return clampCount(fallbackCount);
  return clampCount(Math.ceil((durationSeconds / 60) * QUESTIONS_PER_VIDEO_MINUTE));
}
