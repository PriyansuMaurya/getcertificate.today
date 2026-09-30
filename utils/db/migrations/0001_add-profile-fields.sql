ALTER TABLE "users_table" ADD COLUMN IF NOT EXISTS "username" text;--> statement-breakpoint
ALTER TABLE "users_table" ADD COLUMN IF NOT EXISTS "first_name" text;--> statement-breakpoint
ALTER TABLE "users_table" ADD COLUMN IF NOT EXISTS "last_name" text;--> statement-breakpoint
ALTER TABLE "users_table" ADD COLUMN IF NOT EXISTS "dob" date;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'users_table_username_unique'
			AND contype = 'u'
			AND conrelid = 'users_table'::regclass
	) THEN
		ALTER TABLE "users_table" ADD CONSTRAINT "users_table_username_unique" UNIQUE("username");
	END IF;
END $$;