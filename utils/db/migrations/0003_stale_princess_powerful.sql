CREATE TABLE "transcripts" (
	"id" text PRIMARY KEY NOT NULL,
	"youtube_id" text NOT NULL,
	"transcript" text NOT NULL,
	"language" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "transcripts_youtube_id_unique" ON "transcripts" USING btree ("youtube_id");