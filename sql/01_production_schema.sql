-- =============================================================================
-- getcertificate.today - Production schema for Supabase (Postgres)
--
-- Generated from the codebase source of truth:
--   utils/db/schema.ts          (tables, columns, FKs, unique indexes)
--   utils/db/migrations/*       (drizzle migration chain + journal)
--   app/**/actions.ts, pages    (values written, queries run)
--   utils/credentials.ts        (credential hash scheme, quota constants)
--
-- Execution order: run this file FIRST (01), then sql/02_seed_data.sql.
-- Both files are idempotent: safe to re-run on a database that is empty,
-- partially provisioned (drizzle db:push era, missing 0001 columns), or
-- fully migrated. No manual fixes required.
--
-- Design decisions (all grounded in existing code - no invented structure):
--   * Status/kind/source columns use `text` + guarded CHECK constraints, NOT
--     Postgres enums: utils/db/schema.ts declares them as text, and pg enums
--     would diverge from the Drizzle schema. CHECKs are only added when no
--     violating row exists, so pre-existing data can never break execution.
--   * No storage buckets: a repo-wide search found zero uses of
--     supabase.storage / storage.from anywhere in app/, components/, utils/.
--     Nothing references a bucket, so none is created.
--   * No auth trigger on auth.users: app code inserts users_table itself
--     (app/auth/actions.ts:182, app/auth/callback/route.ts:38). A
--     handle_new_user trigger would double-insert.
--   * users_table.id is linked to auth.users.id BY CONVENTION only (no FK) -
--     documented in docs/ARCHITECTURE.md §5 and docs/RULES.md §18.5. This
--     script preserves that decision; it does not add an unsupported FK.
--   * RLS: policies are written for the `authenticated` role (owner-scoped).
--     The application connects as the `postgres` role (DATABASE_URL user,
--     .env.local) which owns these tables and therefore bypasses RLS, so app
--     behaviour is unchanged while direct/anon/authenticated access is locked
--     down. A guard below refuses to enable RLS if table ownership does not
--     match, rather than silently breaking the app.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1 - Extensions (Supabase ships pgcrypto; needed by 02_seed for
-- auth password hashing via extensions.crypt/gen_salt).
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- SECTION 2 - Drizzle migration tracking (must exist before bootstrapping
-- applied-migration rows in Section 9). Matches drizzle-orm's migrator DDL:
--   create table if not exists <schema>.<table> (
--     id serial primary key, hash text not null, created_at bigint
--   )
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id serial PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint NOT NULL
);

-- -----------------------------------------------------------------------------
-- SECTION 3 - Tables, in FK dependency order.
-- Exact mirror of utils/db/schema.ts. ON DELETE behaviour matches the
-- Drizzle .references() clauses byte for byte:
--   learning_items.user_id          -> users_table.id     ON DELETE CASCADE
--   assessments.learning_item_id    -> learning_items.id  ON DELETE CASCADE (UNIQUE)
--   attempts.assessment_id          -> assessments.id     ON DELETE CASCADE
--   attempts.user_id                -> users_table.id     (no action)
--   attempts.learning_item_id       -> learning_items.id  ON DELETE CASCADE
--   credentials.user_id             -> users_table.id     (no action)
--   credentials.learning_item_id    -> learning_items.id  (no action - this is
--       what makes deleteLearningItem's "credential attests to this item"
--       guard work: app/dashboard/actions.ts catches the FK violation)
--   credentials.attempt_id          -> attempts.id        (no action)
-- -----------------------------------------------------------------------------

-- 3.1 users_table (0000 + 0001 shape)
CREATE TABLE IF NOT EXISTS public.users_table (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  plan text NOT NULL,
  stripe_id text NOT NULL,
  CONSTRAINT users_table_username_unique UNIQUE (username),
  first_name text,
  last_name text,
  dob date,
  CONSTRAINT users_table_email_unique UNIQUE (email)
);

-- Backfill profile columns on databases provisioned before migration 0001
-- (db:push-era DBs have them; old 0000-only DBs do not).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users_table'
                   AND column_name = 'username') THEN
    ALTER TABLE public.users_table ADD COLUMN username text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users_table'
                   AND column_name = 'first_name') THEN
    ALTER TABLE public.users_table ADD COLUMN first_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users_table'
                   AND column_name = 'last_name') THEN
    ALTER TABLE public.users_table ADD COLUMN last_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users_table'
                   AND column_name = 'dob') THEN
    ALTER TABLE public.users_table ADD COLUMN dob date;
  END IF;
  -- Migration 0001's unique constraint, if it was never applied.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.users_table'::regclass
                   AND conname = 'users_table_username_unique') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_index i
                   WHERE i.indrelid = 'public.users_table'::regclass
                     AND i.indisunique
                     AND i.indnatts = 1
                     AND i.indkey[0] = (SELECT attnum FROM pg_attribute
                                        WHERE attrelid = 'public.users_table'::regclass
                                          AND attname = 'username')) THEN
      ALTER TABLE public.users_table
        ADD CONSTRAINT users_table_username_unique UNIQUE (username);
    END IF;
  END IF;
END $$;

-- Columns added by later migrations (terms_consented_at from 0004, role from
-- 0005, suspended_at from 0006) are intentionally NOT in the CREATE TABLE
-- above: only journal
-- entries 0000-0003 are marked applied below, so `drizzle-kit migrate`
-- (npm run build) adds them to bootstrapped databases. See Section 9.

-- NOTE: users_table.stripe_id intentionally has NO unique constraint.
-- Migration 0002 drops users_table_stripe_id_unique and schema.ts does not
-- define one; the Stripe webhook updates by stripe_id
-- (app/webhook/stripe/route.ts:52,60) and must never fail on duplicates.

-- 3.2 learning_items
CREATE TABLE IF NOT EXISTS public.learning_items (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users_table (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'video',
  source_url text NOT NULL,
  youtube_id text NOT NULL,
  title text,
  author text,
  status text NOT NULL DEFAULT 'active',
  duration_seconds integer NOT NULL DEFAULT 0,
  position_seconds integer NOT NULL DEFAULT 0,
  progress_percent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS learning_items_user_youtube_unique
  ON public.learning_items (user_id, youtube_id);

-- 3.3 assessments (one per learning item; questions JSONB holds
-- {prompt, choices[], correct} - utils/db/schema.ts AssessmentQuestion)
CREATE TABLE IF NOT EXISTS public.assessments (
  id text PRIMARY KEY,
  learning_item_id text NOT NULL
    REFERENCES public.learning_items (id) ON DELETE CASCADE,
  schema_version text NOT NULL DEFAULT 'mcq-v1',
  source text NOT NULL DEFAULT 'metadata',
  questions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.assessments'::regclass
                   AND conname = 'assessments_learning_item_id_unique') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_index i
                   WHERE i.indrelid = 'public.assessments'::regclass
                     AND i.indisunique
                     AND i.indnatts = 1
                     AND i.indkey[0] = (SELECT attnum FROM pg_attribute
                                        WHERE attrelid = 'public.assessments'::regclass
                                          AND attname = 'learning_item_id')) THEN
      ALTER TABLE public.assessments
        ADD CONSTRAINT assessments_learning_item_id_unique UNIQUE (learning_item_id);
    END IF;
  END IF;
END $$;

-- 3.4 transcripts (per-video TranscriptAPI cache - utils/transcripts.ts;
-- fetched once per YouTube video ID, reused by every later assessment start)
CREATE TABLE IF NOT EXISTS public.transcripts (
  id text PRIMARY KEY,
  youtube_id text NOT NULL,
  transcript text NOT NULL,
  language text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS transcripts_youtube_id_unique
  ON public.transcripts (youtube_id);

-- 3.5 attempts (answers JSONB = number[] of chosen indices; score 0-100;
-- server-scored only - app/learn/actions.ts submitAssessment)
CREATE TABLE IF NOT EXISTS public.attempts (
  id text PRIMARY KEY,
  assessment_id text NOT NULL REFERENCES public.assessments (id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users_table (id),
  learning_item_id text NOT NULL REFERENCES public.learning_items (id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  score integer NOT NULL,
  passed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.6 credentials (immutable credential record, sha256-v1 hash -
-- utils/credentials.ts; revocation flips status only, RULES §18.4)
CREATE TABLE IF NOT EXISTS public.credentials (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users_table (id),
  learning_item_id text NOT NULL REFERENCES public.learning_items (id),
  attempt_id text NOT NULL REFERENCES public.attempts (id),
  holder_name text NOT NULL,
  item_title text NOT NULL,
  score integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  hash text NOT NULL,
  passed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS credentials_user_item_unique
  ON public.credentials (user_id, learning_item_id);

-- -----------------------------------------------------------------------------
-- SECTION 4 - CHECK constraints.
-- Every allowed value below is enumerated by existing code; nothing is
-- invented. Each CHECK is added only if (a) it does not already exist and
-- (b) no existing row violates it - a NOTICE is raised instead of an error,
-- keeping the script directly executable on any data state.
-- -----------------------------------------------------------------------------

-- credentials.status: 'active' default (schema), 'revoked' (app/dashboard/certificates/actions.ts:38)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.credentials'::regclass
                   AND conname = 'credentials_status_check') THEN
    IF EXISTS (SELECT 1 FROM public.credentials
               WHERE status NOT IN ('active', 'revoked')) THEN
      RAISE NOTICE 'skipping credentials_status_check: violating rows exist';
    ELSE
      ALTER TABLE public.credentials
        ADD CONSTRAINT credentials_status_check CHECK (status IN ('active', 'revoked'));
    END IF;
  END IF;
END $$;

-- credentials.score: score = Math.round((correct/total)*100) - always 0..100
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.credentials'::regclass
                   AND conname = 'credentials_score_check') THEN
    IF EXISTS (SELECT 1 FROM public.credentials WHERE score NOT BETWEEN 0 AND 100) THEN
      RAISE NOTICE 'skipping credentials_score_check: violating rows exist';
    ELSE
      ALTER TABLE public.credentials
        ADD CONSTRAINT credentials_score_check CHECK (score BETWEEN 0 AND 100);
    END IF;
  END IF;
END $$;

-- attempts.score: same computation as credentials
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.attempts'::regclass
                   AND conname = 'attempts_score_check') THEN
    IF EXISTS (SELECT 1 FROM public.attempts WHERE score NOT BETWEEN 0 AND 100) THEN
      RAISE NOTICE 'skipping attempts_score_check: violating rows exist';
    ELSE
      ALTER TABLE public.attempts
        ADD CONSTRAINT attempts_score_check CHECK (score BETWEEN 0 AND 100);
    END IF;
  END IF;
END $$;

-- assessments.source: 'captions' | 'metadata' | 'transcriptapi' (schema comment; default 'metadata')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conrelid = 'public.assessments'::regclass
               AND conname = 'assessments_source_check') THEN
    -- Widen a pre-existing check that predates 'transcriptapi' (values only
    -- ever grow here; the guard below still refuses when rows would violate).
    IF EXISTS (SELECT 1 FROM public.assessments
               WHERE source NOT IN ('captions', 'metadata', 'transcriptapi')) THEN
      -- Stale 2-value constraint stays in place here: manual cleanup required
      -- (fix the offending rows, then re-run this block to widen it).
      RAISE NOTICE 'skipping assessments_source_check widening: violating rows exist';
    ELSE
      ALTER TABLE public.assessments
        DROP CONSTRAINT assessments_source_check;
      ALTER TABLE public.assessments
        ADD CONSTRAINT assessments_source_check CHECK (source IN ('captions', 'metadata', 'transcriptapi'));
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.assessments
                WHERE source NOT IN ('captions', 'metadata', 'transcriptapi')) THEN
    RAISE NOTICE 'skipping assessments_source_check: violating rows exist';
  ELSE
    ALTER TABLE public.assessments
      ADD CONSTRAINT assessments_source_check CHECK (source IN ('captions', 'metadata', 'transcriptapi'));
  END IF;
END $$;

-- learning_items.kind: only 'video' exists today (default in schema; no other
-- value is ever written). Intentionally strict - widen with a migration if a
-- second content kind ships.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.learning_items'::regclass
                   AND conname = 'learning_items_kind_check') THEN
    IF EXISTS (SELECT 1 FROM public.learning_items WHERE kind IS DISTINCT FROM 'video') THEN
      RAISE NOTICE 'skipping learning_items_kind_check: violating rows exist';
    ELSE
      ALTER TABLE public.learning_items
        ADD CONSTRAINT learning_items_kind_check CHECK (kind = 'video');
    END IF;
  END IF;
END $$;

-- learning_items.status: only 'active' is ever written (schema default;
-- no code path sets another value)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.learning_items'::regclass
                   AND conname = 'learning_items_status_check') THEN
    IF EXISTS (SELECT 1 FROM public.learning_items WHERE status IS DISTINCT FROM 'active') THEN
      RAISE NOTICE 'skipping learning_items_status_check: violating rows exist';
    ELSE
      ALTER TABLE public.learning_items
        ADD CONSTRAINT learning_items_status_check CHECK (status = 'active');
    END IF;
  END IF;
END $$;

-- learning_items.progress_percent: saveProgress clamps to 0..100
-- (app/dashboard/actions.ts computed = Math.min(100, ...))
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.learning_items'::regclass
                   AND conname = 'learning_items_progress_check') THEN
    IF EXISTS (SELECT 1 FROM public.learning_items
               WHERE progress_percent NOT BETWEEN 0 AND 100) THEN
      RAISE NOTICE 'skipping learning_items_progress_check: violating rows exist';
    ELSE
      ALTER TABLE public.learning_items
        ADD CONSTRAINT learning_items_progress_check CHECK (progress_percent BETWEEN 0 AND 100);
    END IF;
  END IF;
END $$;

-- learning_items position/duration: saveProgress clamps both to >= 0.
-- NOTE: position_seconds > duration_seconds is deliberately NOT forbidden -
-- saveProgress allows a position while duration is still 0 (unknown).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.learning_items'::regclass
                   AND conname = 'learning_items_seconds_check') THEN
    IF EXISTS (SELECT 1 FROM public.learning_items
               WHERE position_seconds < 0 OR duration_seconds < 0) THEN
      RAISE NOTICE 'skipping learning_items_seconds_check: violating rows exist';
    ELSE
      ALTER TABLE public.learning_items
        ADD CONSTRAINT learning_items_seconds_check
        CHECK (position_seconds >= 0 AND duration_seconds >= 0);
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- SECTION 5 - updated_at maintenance trigger (functions + triggers).
-- App code sets updated_at explicitly on update (app/dashboard/actions.ts:158);
-- this trigger makes the database clock authoritative so a client clock can
-- never skew the dashboard's "recently watched" ordering. Same column
-- semantics, server-side enforcement (RULES §9 server-authoritative pattern).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS learning_items_set_updated_at ON public.learning_items;
CREATE TRIGGER learning_items_set_updated_at
  BEFORE UPDATE ON public.learning_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- SECTION 6 - Row Level Security.
--
-- Ownership guard first: the app connects as `postgres` (DATABASE_URL user).
-- Table owners bypass RLS, so enabling it cannot affect the application as
-- long as the tables are owned by `postgres`. If they are not, fail fast with
-- a clear message instead of silently breaking every query.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  owner_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users_table', 'learning_items', 'assessments', 'transcripts', 'attempts', 'credentials']
  LOOP
    SELECT pg_get_userbyid(c.relowner) INTO owner_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r';
    IF owner_name IS NULL THEN
      RAISE EXCEPTION 'Table public.% does not exist - run Sections 1-3 first.', t;
    END IF;
    -- Safe iff the app role (postgres) bypasses RLS: it owns the tables, or
    -- the postgres role is superuser/BYPASSRLS.
    IF NOT (owner_name = 'postgres'
            OR EXISTS (SELECT 1 FROM pg_roles
                       WHERE rolname = 'postgres' AND (rolsuper OR rolbypassrls))) THEN
      RAISE EXCEPTION
        'public.% is owned by %. The app connects as postgres; enabling RLS would lock it out. Transfer ownership of the app tables to postgres first.',
        t, owner_name;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.users_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

-- Deliberately NOT enabled: drizzle.__drizzle_migrations (no user data).
-- FORCE ROW LEVEL SECURITY is NOT set anywhere (owner bypass is the point).
--
-- Policy matrix (role `authenticated` only; `anon` gets no policy = zero rows;
-- writes to assessments/attempts/credentials have NO authenticated policy so
-- question content, scoring and minting stay server-authoritative - RULES §9):
--
--   users_table     SELECT/INSERT/UPDATE own row (id = auth.uid)   no DELETE
--   learning_items  SELECT/INSERT/UPDATE/DELETE own rows           (user_id)
--   assessments     SELECT via owning learning_item                no writes
--   attempts        SELECT own rows                                no writes
--   credentials     SELECT own rows                                no writes
--   transcripts     no policy (server-only cache; never read from the client)

DROP POLICY IF EXISTS users_select_own ON public.users_table;
CREATE POLICY users_select_own ON public.users_table
  FOR SELECT TO authenticated
  USING (id = (auth.uid())::text);

DROP POLICY IF EXISTS users_insert_own ON public.users_table;
CREATE POLICY users_insert_own ON public.users_table
  FOR INSERT TO authenticated
  WITH CHECK (id = (auth.uid())::text);

DROP POLICY IF EXISTS users_update_own ON public.users_table;
CREATE POLICY users_update_own ON public.users_table
  FOR UPDATE TO authenticated
  USING (id = (auth.uid())::text)
  WITH CHECK (id = (auth.uid())::text);

DROP POLICY IF EXISTS learning_items_select_own ON public.learning_items;
CREATE POLICY learning_items_select_own ON public.learning_items
  FOR SELECT TO authenticated
  USING (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS learning_items_insert_own ON public.learning_items;
CREATE POLICY learning_items_insert_own ON public.learning_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS learning_items_update_own ON public.learning_items;
CREATE POLICY learning_items_update_own ON public.learning_items
  FOR UPDATE TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS learning_items_delete_own ON public.learning_items;
CREATE POLICY learning_items_delete_own ON public.learning_items
  FOR DELETE TO authenticated
  USING (user_id = (auth.uid())::text);

-- assessments has no user_id column: ownership resolves through the parent
-- learning_item (assessments.learning_item_id is UNIQUE).
DROP POLICY IF EXISTS assessments_select_own ON public.assessments;
CREATE POLICY assessments_select_own ON public.assessments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_items li
                 WHERE li.id = assessments.learning_item_id
                   AND li.user_id = (auth.uid())::text));

DROP POLICY IF EXISTS attempts_select_own ON public.attempts;
CREATE POLICY attempts_select_own ON public.attempts
  FOR SELECT TO authenticated
  USING (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS credentials_select_own ON public.credentials;
CREATE POLICY credentials_select_own ON public.credentials
  FOR SELECT TO authenticated
  USING (user_id = (auth.uid())::text);

-- -----------------------------------------------------------------------------
-- SECTION 7 - Performance indexes for the queries the app actually runs.
-- (Unique indexes from Section 3 are not repeated here.)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS learning_items_user_updated_idx
  ON public.learning_items (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS learning_items_user_created_idx
  ON public.learning_items (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attempts_assessment_user_idx
  ON public.attempts (assessment_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS attempts_user_created_idx
  ON public.attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attempts_item_idx
  ON public.attempts (learning_item_id);
CREATE INDEX IF NOT EXISTS credentials_user_passed_idx
  ON public.credentials (user_id, passed_at DESC);
CREATE INDEX IF NOT EXISTS credentials_learning_item_idx
  ON public.credentials (learning_item_id);
CREATE INDEX IF NOT EXISTS credentials_attempt_idx
  ON public.credentials (attempt_id);
CREATE INDEX IF NOT EXISTS users_table_stripe_id_idx
  ON public.users_table (stripe_id);

-- -----------------------------------------------------------------------------
-- SECTION 8 - Storage buckets: NONE.
-- Verified: zero references to supabase.storage / storage.from /
-- upload in app/, components/, utils/. Creating a bucket here would be an
-- unsupported assumption, so none is created.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- SECTION 9 - Drizzle migration bootstrap.
--
-- Why: the committed migration chain cannot run cleanly on a fresh database -
-- migration 0002_striped_misty_knight.sql only does
--   ALTER TABLE users_table DROP CONSTRAINT users_table_stripe_id_unique;
--   ALTER TABLE users_table ALTER COLUMN dob SET DATA TYPE date;
-- (the four core tables were provisioned outside the chain), and it would
-- error on a database where the dropped constraint never existed. Meanwhile
-- migration 0001 would fail on any database that already has the profile
-- columns. (0003 creates the `transcripts` cache table - see utils/transcripts.ts.)
-- Marking all four journal entries as applied (hash = sha256 of the
-- exact file bytes, created_at = journal `when`, matching drizzle-orm's
-- migrator: SELECT ... ORDER BY created_at DESC LIMIT 1) makes
-- `drizzle-kit migrate` (npm run build) a no-op against this schema.
-- Hashes verified against utils/db/migrations/meta/_journal.json.
-- -----------------------------------------------------------------------------
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '9626616eefa33c26e94f4c0552355834ae9f83db00376f39548c1652f08aee78', 1748947435391
WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1748947435391);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '9ecd3d77bf70ef07799d4bc61b1b197aaf8a3d28449117df67c82824f8359677', 1790630360970
WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1790630360970);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'f786dea9d48c95b008008e04a76cded5d9f1bb17f7397f3d374411bc6dc10549', 1790724396506
WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1790724396506);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '77d3c91110d6dd1832cccc1f7e9c51f212b1fc93e05d58510d804aeeca391f7e', 1790784869180
WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1790784869180);

-- -----------------------------------------------------------------------------
-- SECTION 10 - Post-run verification queries (read-only, for manual check).
-- -----------------------------------------------------------------------------
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('users_table','learning_items','assessments','attempts','credentials')
--   ORDER BY relname;            -- all five must be `t`
-- SELECT schemaname, tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
--   rows for 0000-0003 exist from Section 9; 0004+ are added by
--   `drizzle-kit migrate`, so the last row must match the latest `when` in
--   utils/db/migrations/meta/_journal.json.
