import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { WatchRange } from '../watch-progress';

export const usersTable = pgTable('users_table', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  plan: text('plan').notNull(),
  stripe_id: text('stripe_id').notNull(),
  username: text('username').unique(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  dob: date('dob'),
  // When the user accepted the Terms of Service + Privacy Policy (proof of
  // GDPR consent; set at signup or onboarding, never overwritten on re-save).
  terms_consented_at: timestamp('terms_consented_at', { withTimezone: true }),
  // Authorization role: 'user' (default) or 'admin'. Only 'admin' rows pass
  // the requireAdmin() gate for /admin routes (app/admin/require-admin.ts).
  // Server-derived from the DB - never trusted from anything the client sends.
  role: text('role').notNull().default('user'),
  // Moderation status: null = active, a timestamp = suspended at that time
  // (set/cleared only by admin server actions in app/admin/users/actions.ts).
  // Enforced server-side at login, OAuth sign-in, the dashboard layout and
  // requireAdmin() - never by hiding UI. (Postgres has no native boolean for
  // this because the suspension timestamp is needed for the admin list.)
  suspended_at: timestamp('suspended_at', { withTimezone: true }),
  // Referral program: unique, shareable code exposed at /ref/<code>. Always
  // uppercase (A-Z, 0-9). The column default issues a code for every row even
  // when inserted outside the app (seed/test scripts), and the migration
  // backfills existing users, so no account can exist without one.
  referral_code: text('referral_code')
    .notNull()
    .unique()
    .default(sql`upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))`),
  // Denormalized count of referrals attributed to this user, updated in the
  // same transaction that inserts the referrals row (see utils/referrals.ts).
  // Certificate credits themselves live in the append-only referral_credits
  // ledger below - never as a mutable balance here.
  referral_count: integer('referral_count').notNull().default(0),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

// Referral program foundation. One row per attributed referral, written when a
// referred account finishes onboarding (the single place a users row is born).
//
// Status columns are plain text (matching the rest of the schema) rather than
// pg enums. reward_status starts 'none' and becomes 'awarded' (free-tier
// referrer credited), 'not_applicable' (referrer was paid at verification, so
// no credit is owed) or 'reversed' (a credit was clawed back) - see
// utils/referrals.ts.
//
// Self-referral is blocked three ways: the (referrer_user_id <>
// referred_user_id) CHECK added by migration 0009, the unique indexes below,
// and the pure eligibility check in lib/referral-code.ts applied before insert.
export const referralsTable = pgTable(
  'referrals',
  {
    id: text('id').primaryKey(),
    // The user whose code was used. Referrers must already exist.
    referrer_user_id: text('referrer_user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    // The referred account. users_table.id equals the Supabase auth user id by
    // convention, so this is known as soon as onboarding creates the row.
    referred_user_id: text('referred_user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    // Lowercased signup email - blocks same-email self-referral and dedupes.
    referred_email: text('referred_email').notNull(),
    // The exact code that was redeemed (kept even if the referrer's later change).
    referral_code: text('referral_code').notNull(),
    // 'pending' until the referred account confirms their email, then
    // 'verified'. 'rejected' is reserved for the future fraud review.
    verification_status: text('verification_status').notNull().default('pending'),
    verified_at: timestamp('verified_at', { withTimezone: true }),
    // No rewards are live yet - always 'none' for now.
    reward_status: text('reward_status').notNull().default('none'),
    reward_awarded_at: timestamp('reward_awarded_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A user can be referred at most once; so can an email address.
    uniqueIndex('referrals_referred_user_unique').on(t.referred_user_id),
    uniqueIndex('referrals_referred_email_unique').on(t.referred_email),
    // Referrer lookup for the dashboard list and the denormalized count.
    index('referrals_referrer_idx').on(t.referrer_user_id, t.created_at),
  ]
);

export type SelectReferral = typeof referralsTable.$inferSelect;
export type InsertReferral = typeof referralsTable.$inferInsert;

// Append-only credit ledger for referral rewards - the single source of truth
// for a user's earned certificate credits. There is deliberately NO mutable
// balance column (and no separate mint path): the balance is SUM(amount), and
// it feeds the existing free-tier monthly quota in utils/credentials.ts.
//
// One +1 row per verified referral ('referral_verified'), plus at most one -1
// row per referral when a reward is reversed ('reversal'). The composite unique
// index makes both issuance and reversal idempotent, so a retried or duplicated
// settlement can never double-credit. Credits persist across subscription
// changes (the ledger is never edited); they only affect the free tier, because
// paid tiers use their own fixed monthly limits.
export const referralCreditsTable = pgTable(
  'referral_credits',
  {
    id: text('id').primaryKey(),
    // The referrer who earned the credit.
    user_id: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    // Audit link to the referral that produced this entry. Nullable so a manual
    // adjustment can exist without a referral; set null if the referral is ever
    // removed (the user keeps the credit history).
    referral_id: text('referral_id').references(() => referralsTable.id, {
      onDelete: 'set null',
    }),
    // Signed: +1 on award, -1 on reversal.
    amount: integer('amount').notNull(),
    // 'referral_verified' | 'reversal' (text, like every other status column).
    reason: text('reason').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('referral_credits_user_idx').on(t.user_id),
    uniqueIndex('referral_credits_referral_reason_unique').on(t.referral_id, t.reason),
  ]
);

export type SelectReferralCredit = typeof referralCreditsTable.$inferSelect;
export type InsertReferralCredit = typeof referralCreditsTable.$inferInsert;

// One row per (user, source video). Progress columns are denormalized onto the
// item because a learning item belongs to exactly one user (no separate
// learning_progress table needed - TASK.md 2.2 allows "or column set").
export const learningItemsTable = pgTable(
  'learning_items',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('video'),
    source_url: text('source_url').notNull(),
    youtube_id: text('youtube_id').notNull(),
    title: text('title'),
    author: text('author'),
    status: text('status').notNull().default('active'),
    duration_seconds: integer('duration_seconds').notNull().default(0),
    position_seconds: integer('position_seconds').notNull().default(0),
    progress_percent: integer('progress_percent').notNull().default(0),
    // Unique seconds actually watched - the sum of the disjoint spans in
    // `watched_ranges`. `progress_percent` is derived from this, never from
    // `position_seconds`, so skipping ahead cannot bank completion (FR-C4).
    watched_seconds: integer('watched_seconds').notNull().default(0),
    // Canonical union of the played spans, server-merged on every sample. The
    // client can propose spans but never sets a total directly.
    watched_ranges: jsonb('watched_ranges').$type<WatchRange[]>().notNull().default([]),
    // Server clock of the last accepted sample; bounds how much new credit a
    // single request may claim (anti-forgery rate limit).
    last_watched_at: timestamp('last_watched_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('learning_items_user_youtube_unique').on(t.user_id, t.youtube_id)]
);

export type SelectLearningItem = typeof learningItemsTable.$inferSelect;
export type InsertLearningItem = typeof learningItemsTable.$inferInsert;

// Question text + choices are stored with the correct index server-side and
// stripped before any pre-submission render (RULES §9.3). Explanations stay
// server-side too - they are revealed only through the checkAnswer action
// after the learner commits to a choice (instant-feedback flow).
export type AssessmentQuestion = {
  prompt: string;
  choices: string[];
  correct: number;
  /** Why the correct answer is correct. Optional: legacy rows predate it. */
  explanation?: string;
  /** Why each choice is right/wrong, aligned with `choices` (index-matched). */
  choice_explanations?: string[];
};

// Cached YouTube transcript per video, fetched once from TranscriptAPI and
// reused by every future assessment start for the same video (FR-D1).
export const transcriptsTable = pgTable(
  'transcripts',
  {
    id: text('id').primaryKey(),
    youtube_id: text('youtube_id').notNull(),
    transcript: text('transcript').notNull(),
    language: text('language'),
    fetched_at: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('transcripts_youtube_id_unique').on(t.youtube_id)]
);

export type SelectTranscript = typeof transcriptsTable.$inferSelect;
export type InsertTranscript = typeof transcriptsTable.$inferInsert;

export const assessmentsTable = pgTable('assessments', {
  id: text('id').primaryKey(),
  learning_item_id: text('learning_item_id')
    .notNull()
    .unique()
    .references(() => learningItemsTable.id, { onDelete: 'cascade' }),
  schema_version: text('schema_version').notNull().default('mcq-v1'),
  // How question content was grounded: 'transcriptapi' (TranscriptAPI fetch),
  // legacy 'captions' (YouTube timedtext) or 'metadata' (title/channel only).
  source: text('source').notNull().default('metadata'),
  questions: jsonb('questions').$type<AssessmentQuestion[]>().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SelectAssessment = typeof assessmentsTable.$inferSelect;
export type InsertAssessment = typeof assessmentsTable.$inferInsert;

export const attemptsTable = pgTable('attempts', {
  id: text('id').primaryKey(),
  assessment_id: text('assessment_id')
    .notNull()
    .references(() => assessmentsTable.id, { onDelete: 'cascade' }),
  user_id: text('user_id')
    .notNull()
    .references(() => usersTable.id),
  learning_item_id: text('learning_item_id')
    .notNull()
    .references(() => learningItemsTable.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').$type<number[]>().notNull(),
  score: integer('score').notNull(),
  passed: boolean('passed').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SelectAttempt = typeof attemptsTable.$inferSelect;
export type InsertAttempt = typeof attemptsTable.$inferInsert;

// Immutable credential record. `hash` is `sha256-v1:` + hex over the canonical
// field set (see utils/credentials.ts); revocation flips `status`, never edits
// hashed fields (RULES §18.4). One credential per (user, learning item).
export const credentialsTable = pgTable(
  'credentials',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => usersTable.id),
    learning_item_id: text('learning_item_id')
      .notNull()
      .references(() => learningItemsTable.id),
    attempt_id: text('attempt_id')
      .notNull()
      .references(() => attemptsTable.id),
    holder_name: text('holder_name').notNull(),
    item_title: text('item_title').notNull(),
    score: integer('score').notNull(),
    status: text('status').notNull().default('active'),
    hash: text('hash').notNull(),
    passed_at: timestamp('passed_at', { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('credentials_user_item_unique').on(t.user_id, t.learning_item_id)]
);

export type SelectCredential = typeof credentialsTable.$inferSelect;
export type InsertCredential = typeof credentialsTable.$inferInsert;

// Runtime-tunable platform settings, edited at /admin/settings. Exactly one row
// (id = 'global'); always read through utils/settings.ts, which falls back to
// the historical defaults when the row is missing. No CHECK constraints here -
// like plan/role/status, values are validated server-side before every write.
export const appSettingsTable = pgTable('app_settings', {
  id: text('id').primaryKey().default('global'),
  // Minimum score (0-100) an attempt must reach to pass and mint a credential.
  pass_score: integer('pass_score').notNull().default(70),
  // Fallback question count for videos whose runtime is unknown
  // (duration_seconds = 0). Otherwise the generator asks one question per
  // started minute, capped at MAX_ASSESSMENT_QUESTIONS
  // (utils/assessment-config.ts).
  assessment_question_count: integer('assessment_question_count').notNull().default(2),
  // Attempts allowed per learner per rolling cooldown window.
  max_attempts_per_window: integer('max_attempts_per_window').notNull().default(3),
  // Model id sent to the OpenAI-compatible endpoint in utils/ai.ts.
  ai_model: text('ai_model').notNull().default('gpt-4o-mini'),
  // 'transcriptapi' (TranscriptAPI, DB-cached) | 'youtube' (public captions).
  transcript_provider: text('transcript_provider').notNull().default('transcriptapi'),
  // Credentials a free (non-subscriber) user may mint per calendar month.
  free_credentials_per_month: integer('free_credentials_per_month').notNull().default(1),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SelectAppSettings = typeof appSettingsTable.$inferSelect;
export type InsertAppSettings = typeof appSettingsTable.$inferInsert;
