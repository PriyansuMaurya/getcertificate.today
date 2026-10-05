// Runtime-tunable platform settings - the six values an admin can change at
// /admin/settings. SERVER ONLY: reads the single `app_settings` row through
// Drizzle, so it must never enter a client bundle (client components import
// types/labels from utils/settings-config.ts instead).
//
// `getSettings()` is wrapped in React `cache()` so one request that needs the
// values in several places (page + server action) hits the database once. The
// defaults mirror the historical hardcoded constants, so a database with no
// settings row behaves exactly as the product did before.
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { appSettingsTable } from '@/utils/db/schema';
import { ASSESSMENT_QUESTION_COUNT } from '@/utils/assessment-config';
import {
  FREE_CREDENTIALS_PER_MONTH,
  MAX_ATTEMPTS_PER_WINDOW,
  PASS_SCORE,
} from '@/utils/credentials';
import {
  isTranscriptProvider,
  SETTINGS_BOUNDS,
  type AppSettings,
  type SettingsErrors,
  type TranscriptProvider,
} from '@/utils/settings-config';

/** The single settings row always uses this primary key. */
export const SETTINGS_ROW_ID = 'global';

/** Fallback used when the row is missing (and as the admin form's defaults). */
export const DEFAULT_SETTINGS: AppSettings = {
  passScore: PASS_SCORE,
  assessmentQuestionCount: ASSESSMENT_QUESTION_COUNT,
  maxAttemptsPerWindow: MAX_ATTEMPTS_PER_WINDOW,
  aiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  transcriptProvider: 'transcriptapi',
  freeCredentialsPerMonth: FREE_CREDENTIALS_PER_MONTH,
};

/** Maps a settings row to the typed shape (unknown provider falls back). */
function toSettings(row: typeof appSettingsTable.$inferSelect): AppSettings {
  return {
    passScore: row.pass_score,
    assessmentQuestionCount: row.assessment_question_count,
    maxAttemptsPerWindow: row.max_attempts_per_window,
    aiModel: row.ai_model,
    transcriptProvider: isTranscriptProvider(row.transcript_provider)
      ? row.transcript_provider
      : DEFAULT_SETTINGS.transcriptProvider,
    freeCredentialsPerMonth: row.free_credentials_per_month,
  };
}

/** Reads the current settings, falling back to defaults when no row exists. */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, SETTINGS_ROW_ID));
  const row = rows[0];
  return row ? toSettings(row) : DEFAULT_SETTINGS;
});

/** Maps validated settings onto the table's snake_case data columns. */
export function settingsToRow(settings: AppSettings) {
  return {
    pass_score: settings.passScore,
    assessment_question_count: settings.assessmentQuestionCount,
    max_attempts_per_window: settings.maxAttemptsPerWindow,
    ai_model: settings.aiModel,
    transcript_provider: settings.transcriptProvider,
    free_credentials_per_month: settings.freeCredentialsPerMonth,
  };
}

const AI_MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,100}$/;

/** Non-negative integer or null (rejects blanks, signs, decimals, junk). */
function readInt(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function inRange(value: number | null, min: number, max: number): value is number {
  return value !== null && value >= min && value <= max;
}

/**
 * Server-side validation for the settings form. Returns either the parsed,
 * typed settings or per-field error messages. Nothing the client sends is
 * trusted - the action persists only what this function returns.
 */
export function validateSettings(
  formData: FormData
): { settings: AppSettings } | { errors: SettingsErrors } {
  const errors: SettingsErrors = {};

  const passScore = readInt(formData.get('passScore'));
  if (!inRange(passScore, SETTINGS_BOUNDS.passScore.min, SETTINGS_BOUNDS.passScore.max)) {
    errors.passScore = `Enter a whole number from ${SETTINGS_BOUNDS.passScore.min} to ${SETTINGS_BOUNDS.passScore.max}.`;
  }

  const questionCount = readInt(formData.get('assessmentQuestionCount'));
  if (
    !inRange(
      questionCount,
      SETTINGS_BOUNDS.assessmentQuestionCount.min,
      SETTINGS_BOUNDS.assessmentQuestionCount.max
    )
  ) {
    errors.assessmentQuestionCount = `Enter a whole number from ${SETTINGS_BOUNDS.assessmentQuestionCount.min} to ${SETTINGS_BOUNDS.assessmentQuestionCount.max}.`;
  }

  const maxAttempts = readInt(formData.get('maxAttemptsPerWindow'));
  if (
    !inRange(
      maxAttempts,
      SETTINGS_BOUNDS.maxAttemptsPerWindow.min,
      SETTINGS_BOUNDS.maxAttemptsPerWindow.max
    )
  ) {
    errors.maxAttemptsPerWindow = `Enter a whole number from ${SETTINGS_BOUNDS.maxAttemptsPerWindow.min} to ${SETTINGS_BOUNDS.maxAttemptsPerWindow.max}.`;
  }

  const freeCredentials = readInt(formData.get('freeCredentialsPerMonth'));
  if (
    !inRange(
      freeCredentials,
      SETTINGS_BOUNDS.freeCredentialsPerMonth.min,
      SETTINGS_BOUNDS.freeCredentialsPerMonth.max
    )
  ) {
    errors.freeCredentialsPerMonth = `Enter a whole number from ${SETTINGS_BOUNDS.freeCredentialsPerMonth.min} to ${SETTINGS_BOUNDS.freeCredentialsPerMonth.max}.`;
  }

  const aiModelRaw = formData.get('aiModel');
  const aiModel = typeof aiModelRaw === 'string' ? aiModelRaw.trim() : '';
  if (!AI_MODEL_PATTERN.test(aiModel)) {
    errors.aiModel = 'Enter a valid model id (letters, numbers, and . _ : / -).';
  }

  const providerRaw = formData.get('transcriptProvider');
  if (!isTranscriptProvider(providerRaw)) {
    errors.transcriptProvider = 'Choose a transcript provider.';
  }

  if (Object.keys(errors).length > 0) return { errors };

  // Every field passed its bounds check above, so these casts are exact.
  return {
    settings: {
      passScore: passScore as number,
      assessmentQuestionCount: questionCount as number,
      maxAttemptsPerWindow: maxAttempts as number,
      aiModel,
      transcriptProvider: providerRaw as TranscriptProvider,
      freeCredentialsPerMonth: freeCredentials as number,
    },
  };
}
