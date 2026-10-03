-- =============================================================================
-- getcertificate.today - Seed data for Supabase (Postgres)
--
-- Run AFTER sql/01_production_schema.sql. Idempotent: this file first deletes
-- only the fixed seed IDs below (reverse FK order, incl. auth.users rows),
-- then re-inserts everything. Safe to re-run.
--
-- All four seed users share password:  SeedDemo!2026
--   (auth.users.encrypted_password = extensions.crypt(..., extensions.gen_salt('bf')))
--
-- Journey matrix (every state the app can render):
--   ada  - COMPLETED: two finished courses; one active credential (this month,
--          Professional plan), one REVOKED credential (previous month),
--          one in-progress course (45%).
--   ben  - FREE/quota: passed attempt with credential minted this month (free
--          monthly quota now used), one course parked at 79% (assessment gate
--          not yet passed), one course with two FAILED attempts inside the
--          7-day window (cooldown state).
--   cara  - NEW/EMPTY/PENDING: signed up but onboarding incomplete
--          (username/first_name/last_name/dob all NULL), zero learning items
--          (empty dashboard, empty certificates).
--   dev  - EDGE: passed attempt from a previous month with NO credential
--          (quota was exhausted when he passed - exercises mintFromAttempt),
--          plus a brand-new untouched course (0%).
--
-- Timestamps are anchored to date_trunc('month', now()) (= M) so ordering is
-- always valid regardless of the day the script runs:
--   ada  li1 M-40d created, M-38d complete -> ae1 M-38d -> att1 M-37d
--        li2 M-70d/M-60d -> ae2 M-60d -> att2 M-50d -> cred2 M-1s (revoked)
--        li3 created now()-5d, updated now()-1d (45%, pending)
--   ben  li4 M-30d/M-5d (100%) -> ae3 M-5d -> att3 M-3d -> cred3 M (active)
--        li5 now()-3d/now()-2d (79%, pending)
--        li6 M-20d/now()-8d (100%) -> ae4 now()-8d -> att4 now()-6d (40, fail)
--                                                     -> att5 now()-2d (60, fail)
--   dev  li7 M-45d/M-44d (100%) -> ae5 M-44d -> att6 M-40d (80, pass, NO cred)
--        li8 created+updated now()-1h (0%, new)
--
-- Credential hashes are computed IN SQL with the exact canonicalization from
-- utils/credentials.ts (canonicalizeCredential + computeCredentialHash):
--   'sha256-v1:' || sha256_hex(
--     id=<id>|user=<user_id>|item=<learning_item_id>|attempt=<attempt_id>|
--     holder=<holder_name>|title=<item_title>|score=<score>|
--     passed_at=<ISO-8601 UTC with milliseconds>Z )
-- so /certificates/[id] and /verify/[id] render VALID without recomputation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1 - Clear previous seed runs (reverse FK order; seed IDs only).
-- -----------------------------------------------------------------------------
DELETE FROM public.credentials WHERE user_id IN (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000004'
);
DELETE FROM public.attempts WHERE user_id IN (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000004'
);
DELETE FROM public.assessments WHERE learning_item_id IN (
  'aa000000-0000-4000-8000-000000000001',
  'aa000000-0000-4000-8000-000000000002',
  'aa000000-0000-4000-8000-000000000004',
  'aa000000-0000-4000-8000-000000000006',
  'aa000000-0000-4000-8000-000000000007'
);
DELETE FROM public.learning_items WHERE user_id IN (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000004'
);
DELETE FROM public.users_table WHERE id IN (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000004'
);
DELETE FROM auth.identities WHERE user_id IN (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000004'
);
DELETE FROM auth.users WHERE id IN (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000004'
);

-- -----------------------------------------------------------------------------
-- SECTION 2 - auth.users + auth.identities (Supabase GoTrue rows).
-- users_table.id mirrors auth.users.id (RULES §18.5 - join by convention).
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'ada@example.com', extensions.crypt('SeedDemo!2026', extensions.gen_salt('bf')),
   date_trunc('month', now()) - interval '80 days',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Ada Lovelace","email":"ada@example.com"}'::jsonb,
   date_trunc('month', now()) - interval '80 days',
   date_trunc('month', now()) - interval '80 days'),
  ('00000000-0000-0000-0000-000000000000',
   'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'ben.carter@example.com', extensions.crypt('SeedDemo!2026', extensions.gen_salt('bf')),
   date_trunc('month', now()) - interval '40 days',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Ben Carter","email":"ben.carter@example.com"}'::jsonb,
   date_trunc('month', now()) - interval '40 days',
   date_trunc('month', now()) - interval '40 days'),
  ('00000000-0000-0000-0000-000000000000',
   'c0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'cara.silva@example.com', extensions.crypt('SeedDemo!2026', extensions.gen_salt('bf')),
   now() - interval '2 days',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Cara Silva","email":"cara.silva@example.com"}'::jsonb,
   now() - interval '2 days',
   now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000000',
   'd0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'dev.patel@example.com', extensions.crypt('SeedDemo!2026', extensions.gen_salt('bf')),
   date_trunc('month', now()) - interval '70 days',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Dev Patel","email":"dev.patel@example.com"}'::jsonb,
   date_trunc('month', now()) - interval '70 days',
   date_trunc('month', now()) - interval '70 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id,
  jsonb_build_object(
    'sub', u.id,
    'email', u.email,
    'email_verified', true,
    'full_name', u.raw_user_meta_data ->> 'full_name'
  ),
  'email', u.id::text,
  now(), u.created_at, u.created_at
FROM auth.users u
WHERE u.id IN (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000004'
)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION 3 - users_table profiles.
--   ada  Professional: plan stores a Stripe subscription id (any value other
--        than the 'none' sentinel = Professional - utils/credentials.ts:90,
--        app/webhook/stripe/route.ts:51). Settings page tolerates the fake id
--        (getStripePlan is wrapped in try/catch -> 'Plan unavailable').
--   cara Onboarding PENDING: username/first_name/last_name/dob NULL -> the
--        middleware onboarding gate and the empty onboarding form render.
-- -----------------------------------------------------------------------------
INSERT INTO public.users_table (id, name, email, plan, stripe_id, username, first_name, last_name, dob)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Ada Lovelace', 'ada@example.com',
   'sub_gct_seed_pro_0001', 'cus_gct_seed_ada', 'ada', 'Ada', 'Lovelace', DATE '1990-12-10'),
  ('b0000000-0000-4000-8000-000000000002', 'Ben Carter', 'ben.carter@example.com',
   'none', 'cus_gct_seed_ben', 'benc', 'Ben', 'Carter', DATE '1996-04-22'),
  ('c0000000-0000-4000-8000-000000000003', 'Cara Silva', 'cara.silva@example.com',
   'none', 'cus_gct_seed_cara', NULL, NULL, NULL, NULL),
  ('d0000000-0000-4000-8000-000000000004', 'Dev Patel', 'dev.patel@example.com',
   'none', 'cus_gct_seed_dev', 'devp', 'Dev', 'Patel', DATE '1995-03-02')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION 4 - learning_items (8 rows, one per journey state).
-- progress/position/duration are consistent: completed items have
-- position = duration and progress = 100; 79% item = floor(0.79 * 1200) etc.
-- -----------------------------------------------------------------------------
INSERT INTO public.learning_items (
  id, user_id, kind, source_url, youtube_id, title, author, status,
  duration_seconds, position_seconds, progress_percent, created_at, updated_at
)
VALUES
  -- ada: completed, completed(revoked-cred), in-progress 45%
  ('aa000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ',
   'Linear Algebra: Matrix Multiplication', 'MIT OpenCourseWare', 'active',
   1560, 1560, 100,
   date_trunc('month', now()) - interval '40 days',
   date_trunc('month', now()) - interval '38 days'),
  ('aa000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'video',
   'https://www.youtube.com/watch?v=kJQP7kiw5Fk', 'kJQP7kiw5Fk',
   'Photosynthesis: Light Reactions', 'Khan Academy', 'active',
   905, 905, 100,
   date_trunc('month', now()) - interval '70 days',
   date_trunc('month', now()) - interval '60 days'),
  ('aa000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001', 'video',
   'https://www.youtube.com/watch?v=9bZkp7q19f0', '9bZkp7q19f0',
   'SQL Fundamentals: JOINs Explained', 'Fireship', 'active',
   720, 324, 45,
   now() - interval '5 days', now() - interval '1 day'),
  -- ben: completed (cred minted),79% pending, completed with failed attempts
  ('aa000000-0000-4000-8000-000000000004',
   'b0000000-0000-4000-8000-000000000002', 'video',
   'https://www.youtube.com/watch?v=M7lc1UVf-VE', 'M7lc1UVf-VE',
   'Git in Depth: Rebase vs Merge', 'The Pragmatic Engineer', 'active',
   1080, 1080, 100,
   date_trunc('month', now()) - interval '30 days',
   date_trunc('month', now()) - interval '5 days'),
  ('aa000000-0000-4000-8000-000000000005',
   'b0000000-0000-4000-8000-000000000002', 'video',
   'https://www.youtube.com/watch?v=jNQXAC9IVRw', 'jNQXAC9IVRw',
   'TypeScript Generics Crash Course', 'Traversy Media', 'active',
   1200, 948, 79,
   now() - interval '3 days', now() - interval '2 days'),
  ('aa000000-0000-4000-8000-000000000006',
   'b0000000-0000-4000-8000-000000000002', 'video',
   'https://www.youtube.com/watch?v=ScMzIvxBSi4', 'ScMzIvxBSi4',
   'Docker Compose in 10 Minutes', 'TechWorld with Nana', 'active',
   640, 640, 100,
   date_trunc('month', now()) - interval '20 days',
   now() - interval '8 days'),
  -- dev: completed (old passed attempt, no credential), brand-new 0%
  ('aa000000-0000-4000-8000-000000000007',
   'd0000000-0000-4000-8000-000000000004', 'video',
   'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ',
   'Machine Learning: Gradient Descent', 'Andrew Ng', 'active',
   1320, 1320, 100,
   date_trunc('month', now()) - interval '45 days',
   date_trunc('month', now()) - interval '44 days'),
  ('aa000000-0000-4000-8000-000000000008',
   'd0000000-0000-4000-8000-000000000004', 'video',
   'https://www.youtube.com/watch?v=LXb3EKWsInQ', 'LXb3EKWsInQ',
   'Rust Ownership & Borrowing', 'Jon Gjengset', 'active',
   1800, 0, 0,
   now() - interval '1 hour', now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION 5 - assessments (5 rows; every gated course except ben's 79% and
-- dev's 0%, plus ada's 45% course - those are the "not generated yet" pending
-- states). questions = AssessmentQuestion[] {prompt, choices[], correct}.
-- -----------------------------------------------------------------------------
INSERT INTO public.assessments (id, learning_item_id, schema_version, source, questions, created_at)
VALUES
  ('ae000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001',
   'mcq-v1', 'captions',
   '[{"prompt":"What are the dimensions of the product of a 2x3 and a 3x4 matrix?","choices":["2x4","3x3","4x2","2x3"],"correct":0},
     {"prompt":"When is matrix multiplication defined?","choices":["Always","When inner dimensions match","When both are square","When determinant is nonzero"],"correct":1},
     {"prompt":"Is matrix multiplication commutative?","choices":["Yes, always","Yes for square matrices only","No, in general","No, never"],"correct":2},
     {"prompt":"What is the identity element for matrix multiplication?","choices":["Zero matrix","Any diagonal matrix","Identity matrix","Transpose"],"correct":2},
     {"prompt":"How many scalar multiplications does the naive 2x3 by 3x4 product take?","choices":["6","8","12","24"],"correct":2}]'::jsonb,
   date_trunc('month', now()) - interval '38 days'),
  ('ae000000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-000000000002',
   'mcq-v1', 'captions',
   '[{"prompt":"Where do the light reactions of photosynthesis occur?","choices":["Stroma","Thylakoid membrane","Outer membrane","Cytoplasm"],"correct":1},
     {"prompt":"Which molecules absorb light?","choices":["Chlorophyll","Cellulose","Starch","Sucrose"],"correct":0},
     {"prompt":"What gas is released during the light reactions?","choices":["CO2","N2","O2","H2"],"correct":2},
     {"prompt":"Which carrier is reduced to NADPH?","choices":["NADP+","ATP","FADH2","O2"],"correct":0},
     {"prompt":"Where is ATP synthase located?","choices":["Stroma","Thylakoid membrane","Cristae","Outer membrane"],"correct":1}]'::jsonb,
   date_trunc('month', now()) - interval '60 days'),
  ('ae000000-0000-4000-8000-000000000003', 'aa000000-0000-4000-8000-000000000004',
   'mcq-v1', 'metadata',
   '[{"prompt":"What does git rebase do?","choices":["Copies commits onto another base","Deletes branches","Compresses history only","Tags commits"],"correct":0},
     {"prompt":"What does a merge preserve?","choices":["Linear history only","Original commit hashes","Rewritten hashes","Nothing"],"correct":1},
     {"prompt":"When should you avoid rebasing?","choices":["Local cleanup","Shared/public branches","Creating tags","Reading logs"],"correct":1},
     {"prompt":"Which command rebases the current branch onto main?","choices":["git merge main","git rebase main","git push main","git reset main"],"correct":1},
     {"prompt":"A rebase result is typically?","choices":["A merge commit","Linear history","An empty tree","A two-parent commit"],"correct":1}]'::jsonb,
   date_trunc('month', now()) - interval '5 days'),
  ('ae000000-0000-4000-8000-000000000004', 'aa000000-0000-4000-8000-000000000006',
   'mcq-v1', 'captions',
   '[{"prompt":"Which file defines a Compose stack?","choices":["Dockerfile","docker-compose.yml","Makefile",".dockerignore"],"correct":1},
     {"prompt":"Which command starts all services?","choices":["docker compose up","docker build","docker pull","docker run"],"correct":0},
     {"prompt":"Compose addresses services on the network by?","choices":["Container name","Service name","Image ID","Port"],"correct":1},
     {"prompt":"How do you start only the db service?","choices":["docker compose up db","docker compose db","docker run db","docker start db"],"correct":0},
     {"prompt":"How do you scale a service to 3 replicas?","choices":["docker scale svc=3","docker compose up --scale svc=3","docker compose scale 3","docker increase svc"],"correct":1}]'::jsonb,
   now() - interval '8 days'),
  ('ae000000-0000-4000-8000-000000000005', 'aa000000-0000-4000-8000-000000000007',
   'mcq-v1', 'captions',
   '[{"prompt":"Gradient descent updates weights by?","choices":["Subtracting gradient times learning rate","Adding random noise","Transposing weights","Zeroing gradients"],"correct":0},
     {"prompt":"Too large a learning rate usually causes?","choices":["Slow convergence","Oscillation or divergence","No update","Overfitting only"],"correct":1},
     {"prompt":"The gradient points toward?","choices":["The minimum","The direction of steepest increase","Zero","A random direction"],"correct":1},
     {"prompt":"Batch gradient descent uses?","choices":["One sample per step","All samples per step","A fixed random subset","No data"],"correct":1},
     {"prompt":"A saddle point is?","choices":["Always the global minimum","A flat region that can stall optimization","A NaN value","A matrix operation"],"correct":1}]'::jsonb,
   date_trunc('month', now()) - interval '44 days')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION 6 - attempts (server-scored: score = round(correct/total*100),
-- passed = score >= 70 / PASS_SCORE).
--   att1 ada 100% pass | att2 ada 80% pass | att3 ben 80% pass
--   att4 ben 40% FAIL | att5 ben 60% FAIL (2 attempts inside 7-day window
--        -> 1 more allowed, then cooldown - submitAssessment's window check)
--   att6 dev 80% pass, last month, no credential minted (quota was exhausted)
-- -----------------------------------------------------------------------------
INSERT INTO public.attempts (id, assessment_id, user_id, learning_item_id, answers, score, passed, created_at)
VALUES
  ('e0000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001',
   '[0,1,2,2,2]'::jsonb, 100, true,
   date_trunc('month', now()) - interval '37 days'),
  ('e0000000-0000-4000-8000-000000000002', 'ae000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002',
   '[1,0,0,0,1]'::jsonb, 80, true,
   date_trunc('month', now()) - interval '50 days'),
  ('e0000000-0000-4000-8000-000000000003', 'ae000000-0000-4000-8000-000000000003',
   'b0000000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-000000000004',
   '[0,1,1,1,0]'::jsonb, 80, true,
   date_trunc('month', now()) - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000004', 'ae000000-0000-4000-8000-000000000004',
   'b0000000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-000000000006',
   '[1,1,0,2,1]'::jsonb, 40, false,
   now() - interval '6 days'),
  ('e0000000-0000-4000-8000-000000000005', 'ae000000-0000-4000-8000-000000000004',
   'b0000000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-000000000006',
   '[1,0,0,2,1]'::jsonb, 60, false,
   now() - interval '2 days'),
  ('e0000000-0000-4000-8000-000000000006', 'ae000000-0000-4000-8000-000000000005',
   'd0000000-0000-4000-8000-000000000004', 'aa000000-0000-4000-8000-000000000007',
   '[0,1,1,0,1]'::jsonb, 80, true,
   date_trunc('month', now()) - interval '40 days')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION 7 - credentials (3 rows) with hashes computed by the exact
-- canonicalization from utils/credentials.ts:
--   id=<id>|user=<user_id>|item=<learning_item_id>|attempt=<attempt_id>|
--   holder=<holder_name>|title=<item_title>|score=<score>|
--   passed_at=<toISOString() of passed_at, UTC with milliseconds>
-- to_char 'MS' always renders 3 digits, matching Date.toISOString(); seed
-- timestamps are millisecond-precision (no microseconds) so the JS recompute
-- in verifyCredentialHash() matches byte for byte.
--
--   cred1 ada  active    passed_at = month start          (this month)
--   cred2 ada  REVOKED   passed_at = M - 1s  (previous month, always)
--   cred3 ben  active    passed_at = month start          (free quota used)
--   dev  has NO credential -> dashboard shows the mint-from-attempt CTA
-- -----------------------------------------------------------------------------
INSERT INTO public.credentials (
  id, user_id, learning_item_id, attempt_id,
  holder_name, item_title, score, status, hash, passed_at, created_at
)
WITH seed (
  id, user_id, learning_item_id, attempt_id,
  holder_name, item_title, score, status, passed_at
) AS (
  VALUES
    ('f0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000001',
     'aa000000-0000-4000-8000-000000000001',
     'e0000000-0000-4000-8000-000000000001',
     'Ada Lovelace', 'Linear Algebra: Matrix Multiplication', 100, 'active',
     date_trunc('month', now())),
    ('f0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000001',
     'aa000000-0000-4000-8000-000000000002',
     'e0000000-0000-4000-8000-000000000002',
     'Ada Lovelace', 'Photosynthesis: Light Reactions', 80, 'revoked',
     date_trunc('month', now()) - interval '1 second'),
    ('f0000000-0000-4000-8000-000000000003',
     'b0000000-0000-4000-8000-000000000002',
     'aa000000-0000-4000-8000-000000000004',
     'e0000000-0000-4000-8000-000000000003',
     'Ben Carter', 'Git in Depth: Rebase vs Merge', 80, 'active',
     date_trunc('month', now()))
)
SELECT
  s.id, s.user_id, s.learning_item_id, s.attempt_id,
  s.holder_name, s.item_title, s.score, s.status,
  'sha256-v1:' || encode(sha256(convert_to(
    'id=' || s.id ||
    '|user=' || s.user_id ||
    '|item=' || s.learning_item_id ||
    '|attempt=' || s.attempt_id ||
    '|holder=' || s.holder_name ||
    '|title=' || s.item_title ||
    '|score=' || s.score::text ||
    '|passed_at=' || to_char(s.passed_at AT TIME ZONE 'UTC',
                             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'UTF8')), 'hex'),
  s.passed_at, now()
FROM seed s
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION 8 - Post-seed verification queries (read-only).
-- -----------------------------------------------------------------------------
-- SELECT count(*) FROM auth.users WHERE email LIKE '%example.com';   -- 4
-- SELECT (SELECT count(*) FROM public.users_table),      -- 4
--        (SELECT count(*) FROM public.learning_items),   -- 8
--        (SELECT count(*) FROM public.assessments),      -- 5
--        (SELECT count(*) FROM public.attempts),         -- 6
--        (SELECT count(*) FROM public.credentials);      -- 3
-- -- hash spot-check (must equal stored hash):
-- SELECT id, hash = 'sha256-v1:' || encode(sha256(convert_to(
--   'id=' || id || '|user=' || user_id || '|item=' || learning_item_id ||
--   '|attempt=' || attempt_id || '|holder=' || holder_name ||
--   '|title=' || item_title || '|score=' || score::text ||
--   '|passed_at=' || to_char(passed_at AT TIME ZONE 'UTC',
--                            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'UTF8')), 'hex')
--   AS hash_valid FROM public.credentials;
