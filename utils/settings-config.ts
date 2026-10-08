// Client-safe settings metadata: types, bounds, provider choices and labels.
// No server-only imports live here, so components/admin/SettingsForm.tsx can
// import these values directly. All server logic (DB read/write + validation)
// lives in utils/settings.ts, which imports from this module.

/** Transcript sources the generation pipeline can use. */
export const TRANSCRIPT_PROVIDERS = ['transcriptapi', 'youtube'] as const;
export type TranscriptProvider = (typeof TRANSCRIPT_PROVIDERS)[number];

export function isTranscriptProvider(value: unknown): value is TranscriptProvider {
  return typeof value === 'string' && (TRANSCRIPT_PROVIDERS as readonly string[]).includes(value);
}

/** Human labels for the transcript provider choices (admin UI copy). */
export const TRANSCRIPT_PROVIDER_LABELS: Record<TranscriptProvider, string> = {
  transcriptapi: 'TranscriptAPI (recommended)',
  youtube: 'YouTube captions (best effort)',
};

/** The six admin-tunable platform settings, in camelCase. */
export type AppSettings = {
  passScore: number;
  assessmentQuestionCount: number;
  maxAttemptsPerWindow: number;
  aiModel: string;
  transcriptProvider: TranscriptProvider;
  freeCredentialsPerMonth: number;
};

/** Field bounds, shared by the validator and the form's helper copy. */
export const SETTINGS_BOUNDS = {
  passScore: { min: 1, max: 100 },
  // Fallback only: assessments scale with video length (one question per
  // started minute, capped at MAX_ASSESSMENT_QUESTIONS in
  // utils/assessment-config.ts), so this bound applies to the count used when a
  // video's runtime is unknown, not to every assessment.
  assessmentQuestionCount: { min: 1, max: 20 },
  maxAttemptsPerWindow: { min: 1, max: 100 },
  freeCredentialsPerMonth: { min: 0, max: 100 },
} as const;

/** Common model ids offered as datalist suggestions (any endpoint id works). */
export const AI_MODEL_SUGGESTIONS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'];

export type SettingsErrors = Partial<Record<keyof AppSettings, string>>;
