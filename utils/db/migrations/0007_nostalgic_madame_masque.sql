CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"pass_score" integer DEFAULT 70 NOT NULL,
	"assessment_question_count" integer DEFAULT 2 NOT NULL,
	"max_attempts_per_window" integer DEFAULT 3 NOT NULL,
	"ai_model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"transcript_provider" text DEFAULT 'transcriptapi' NOT NULL,
	"free_credentials_per_month" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
