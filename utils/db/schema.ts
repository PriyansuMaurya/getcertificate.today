import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

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
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

// One row per (user, source video). Progress columns are denormalized onto the
// item because a learning item belongs to exactly one user (no separate
// learning_progress table needed — TASK.md 2.2 allows "or column set").
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
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('learning_items_user_youtube_unique').on(t.user_id, t.youtube_id)]
);

export type SelectLearningItem = typeof learningItemsTable.$inferSelect;
export type InsertLearningItem = typeof learningItemsTable.$inferInsert;

// Question text + choices are stored with the correct index server-side and
// stripped before any pre-submission render (RULES §9.3). Explanations stay
// server-side too — they are revealed only through the checkAnswer action
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
