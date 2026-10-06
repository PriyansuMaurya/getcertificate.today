ALTER TABLE "learning_items" ADD COLUMN "watched_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_items" ADD COLUMN "watched_ranges" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_items" ADD COLUMN "last_watched_at" timestamp with time zone;--> statement-breakpoint
-- Backfill (preserve existing progress): fold each row's legacy percent into a
-- single watched span so no learner loses the progress they already had. From
-- here on progress_percent is derived from watched_seconds, never position.
UPDATE "learning_items"
SET
	"watched_seconds" = LEAST("duration_seconds", CEIL("duration_seconds" * "progress_percent" / 100.0)::integer),
	"watched_ranges" = jsonb_build_array(
		jsonb_build_object(
			'start', 0,
			'end', LEAST("duration_seconds", CEIL("duration_seconds" * "progress_percent" / 100.0)::integer)
		)
	)
WHERE "progress_percent" > 0
	AND "duration_seconds" > 0
	AND "watched_seconds" = 0;
