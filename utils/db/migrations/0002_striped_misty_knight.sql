ALTER TABLE "users_table" DROP CONSTRAINT "users_table_stripe_id_unique";--> statement-breakpoint
ALTER TABLE "users_table" ALTER COLUMN "dob" SET DATA TYPE date;