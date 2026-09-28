ALTER TABLE "users_table" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users_table" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "users_table" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "users_table" ADD COLUMN "dob" date;--> statement-breakpoint
ALTER TABLE "users_table" ADD CONSTRAINT "users_table_username_unique" UNIQUE("username");