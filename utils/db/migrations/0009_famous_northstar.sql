CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referred_user_id" text NOT NULL,
	"referred_email" text NOT NULL,
	"referral_code" text NOT NULL,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"reward_status" text DEFAULT 'none' NOT NULL,
	"reward_awarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users_table" ADD COLUMN "referral_code" text DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)) NOT NULL;--> statement-breakpoint
ALTER TABLE "users_table" ADD COLUMN "referral_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill guarantee: the volatile DEFAULT above already assigns a distinct
-- code to every existing row during the ADD COLUMN rewrite. This guard only
-- regenerates the (astronomically unlikely) duplicate before the NOT NULL +
-- UNIQUE constraint below is created, so the migration can never abort on real
-- data.
DO $$
DECLARE dup RECORD;
BEGIN
  FOR dup IN
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY referral_code ORDER BY id) AS rn
      FROM public.users_table
    ) d WHERE d.rn > 1
  LOOP
    UPDATE public.users_table
    SET referral_code = upper(substr(md5(random()::text || clock_timestamp()::text || dup.id), 1, 8))
    WHERE id = dup.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_table_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_table_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Self-referral is impossible at the database level: a row can never point its
-- referrer and referred user at the same account (the app repeats this check
-- against email too, in lib/referral-code.ts).
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_no_self_referral" CHECK ("referrer_user_id" <> "referred_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referred_user_unique" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referred_email_unique" ON "referrals" USING btree ("referred_email");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_user_id","created_at");--> statement-breakpoint
ALTER TABLE "users_table" ADD CONSTRAINT "users_table_referral_code_unique" UNIQUE("referral_code");
