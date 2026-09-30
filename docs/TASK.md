# TASK — Implementation audit & execution roadmap

|                 |                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document status | Dependency-aware execution plan for AI coding agents                                                                                                                                                                                                                            |
| Last updated    | 2026-09-28                                                                                                                                                                                                                                                                      |
| Basis           | Full repository audit (statuses cross-checked against `PRD.md` §5, `ARCHITECTURE.md` §16)                                                                                                                                                                                       |
| How to use      | Execute phases strictly in order — later phases depend on earlier ones. Check off items as you complete them, obey `RULES.md`, and append a `MEMORY.md` change-log entry per session. Never mark an item complete without running the §Verification commands in `RULES.md` §20. |

Status legend: ✅ complete · 🔶 partial · ❌ missing · 🩹 technical debt.

---

## Phase 0 — Hygiene, correctness & safety (do first; unblocks everything)

### 0.1 Database migration verification (integrity check)

- [ ] 🔶→✅ Verify schema↔migration parity in every environment. _Status as of 2026-09-28: `utils/db/schema.ts` and the migration chain are in sync — migration `0001_add-profile-fields.sql` adds `username` (unique), `first_name`, `last_name`, `dob`, matching the onboarding flow._ Remaining risk is per-database, not per-file:
  - [ ] Run `drizzle-kit migrate` against a fresh/empty Postgres → run `npm run dev` → complete onboarding end-to-end (proves migrations build a working schema from scratch).
  - [ ] Confirm the production DB has `0001` **and `0002`** applied (query `__drizzle_migrations` or the tables/columns); if it was provisioned via `db:push`, reconcile history per drizzle-kit docs — **document the outcome in `MEMORY.md`**.
  - [ ] Note for future sessions: the `0001` journal entry and files were created 2026-09-28 (same day as commit `a1bd15d`); if `db:generate` or `db:migrate` ever complains about journal/history mismatch, re-baseline per drizzle-kit docs and record what happened in `MEMORY.md`.

### 0.2 Stripe webhook security (release blocker for billing)

- [x] ✅ Add webhook signature verification: read raw body, `stripe.webhooks.constructEvent(rawBody, sigHeader, process.env.STRIPE_WEBHOOK_SECRET)`, 400 on failure.
- [x] ✅ Add `STRIPE_WEBHOOK_SECRET` to `.env.example` and document in `ARCHITECTURE.md` §12.1.
- [x] ✅ Fix the missing `break` fall-through in the `customer.subscription.created` case.
- [x] ✅ Handle `customer.subscription.updated` (sync status) and `customer.subscription.deleted` (reset `plan` to `'none'`) — data-integrity rule `RULES.md` §17.3.
- [x] ✅ Make the handler idempotent (upsert by `stripe_id`).
- [x] ✅ Remove `console.log("event:", event)` payload logging (event types only).

### 0.3 Missing error surfaces

- [x] ✅ `app/not-found.tsx` (global 404).
- [x] ✅ `app/error.tsx` (client error boundary).
- [x] ✅ `/auth/auth-code-error` page exists.
- [x] ✅ `/error` page exists.
- [ ] ❌ Optionally `app/loading.tsx` for the dashboard segment.

### 0.4 Starter-kit residue cleanup (cosmetic but user-visible)

- [ ] 🩹 Fix broken Tailwind class typo `text-2x\l` in `app/signup/page.tsx`.
- [ ] 🩹 Replace `app/dashboard/layout.tsx` metadata ("SAAS Starter Kit") with product metadata.
- [x] ✅ Nested `<Link>` inside `<Link>` (Billing item) in `components/DashboardHeaderProfileDropdown.tsx` — rebuilt this session.
- [ ] 🩹 Decide the fate of unused artifacts: `public/next.svg`, `public/vercel.svg`, empty `compositions/components/landing-page/` and `figma-ui/` directories, `utils/supabase/client.ts` (keep if a client-side Supabase use is planned — record decision), `app/dashboard/actions.ts` (empty).
- [ ] 🩹 Replace `"Acme Inc"` sr-only label on `/subscribe` with product name; square logo on auth pages vs wordmark is acceptable short-term.

### 0.5 Tooling

- [ ] ❌ Add a `typecheck` npm script (`tsc --noEmit`) so agents don't improvise.
- [ ] ❌ Fix the duplicate-font issue: `app/dashboard/layout.tsx` loads Inter (used as the dashboard font) while the root layout already loads Manrope/Fraunces; remove Inter and let the dashboard inherit the root fonts (decide explicitly if the dashboard should keep a distinct font — record in `MEMORY.md`).
- [ ] 🩹 Consider removing the Stripe pricing-table `<script>` from the root layout (loads on every route) — move it to `/subscribe` (uses `next/script`).
- [ ] ❌ Add `.gitignore` entries for `dev-server.log`, `.freebuff/` (agent workspace), and decide whether `tree.txt`/`.media/` should be committed (`.media/` is Figma provenance → recommend keep; `tree.txt` is a generated snapshot → recommend ignore or delete).

### 0.6 Test & CI foundation

- [ ] ❌ Choose and install a test framework (recommendation: Vitest + React Testing Library for units; keep `scripts/test-onboarding-flow.mjs` as a manual E2E aid). Record the choice + conventions in `MEMORY.md`.
- [ ] ❌ Add unit tests for `completeOnboarding` validation branches (username regex, age gate, duplicate username) and `calculateAge`.
- [ ] ❌ Add a test for the Stripe webhook handler (verified signature accepted; unsigned rejected; all three subscription event types mutate `plan` correctly).
- [ ] ❌ Add CI (GitHub Actions) running `npm run lint`, `npm run typecheck`, `npm run build` on PRs; a Postgres service container if migration smoke tests are included. Note: no CI exists today.

**Phase 0 exit criteria:** lint/typecheck/build green; migrations reproducible from scratch and verified applied in prod; webhook verified; error pages exist.

---

## Phase 1 — Trust foundations for the core product (before any credential exists)

### 1.1 Billing truth

- [ ] ❌ Redefine Stripe products/prices to match the landing tiers: Free Explorer ($0) and Professional ($12/mo) — replace `stripeSetup.ts` plan array; document price IDs in env/config (`PRD.md` §14.6).
- [ ] ❌ Decide plan representation: store a normalized plan (`'free' | 'pro'`) derived from Stripe state, or keep raw subscription ID — document in `ARCHITECTURE.md` §5 and implement consistently (`getStripePlan` currently returns product names).
- [ ] 🔶→✅ Ensure non-subscribers work fully (current posture is correct — add a regression test that the upgrade card renders only when `plan === 'none'`).

### 1.2 Privacy & legal baseline (launch blockers per `PRD.md` NFR-2/NFR-9)

- [ ] ❌ Privacy Policy page (covers DOB, names, learning/assessment data, credential publicity).
- [ ] ❌ Terms of Service page.
- [ ] ❌ Wire footer "Legal" links to the real pages; also fix Product/Company placeholder links (`href="#"`) to real anchors/pages or remove them.
- [ ] ❌ Account data surface: minimal "delete my account/data" path or an explicit documented manual process.

### 1.3 Middleware & public routes groundwork

- [x] ✅ Public-path list in `utils/supabase/middleware.ts` now includes `/certificates` and `/verify` (documented in `ARCHITECTURE.md` §6.2).
- [ ] ❌ Refactor the public-path list into a named constant (cosmetic).
- [ ] ❌ Consolidate user provisioning into one place (recommend `app/auth/callback/route.ts`) to remove the signup/callback duplication and its duplicate-insert race (`ARCHITECTURE.md` §6.5).

**Phase 1 exit criteria:** billing state is truthful; legal pages exist; public-route mechanism ready for verification pages.

---

## Phase 2 — Learning content MVP (YouTube video)

> Depends on: Phase 0/1. Delivers `PRD.md` FR-C1/C3/C4/C5 for single videos (playlists deferred to Phase 5).

### 2.1 Decisions to lock first (see `PRD.md` §14)

- [x] ✅ Schema naming: lowercase snake_case plurals for new tables (`learning_items`, `assessments`, `attempts`, `credentials`); `users_table` kept as-is.
- [x] ✅ Progress-tracking: YouTube IFrame API events → `saveProgress` server action (clamped server-side). Rate limiting still open — see Phase 5.

### 2.2 Data model

- [x] ✅ `learning_items` table (id, user_id, kind, source_url, youtube_id, title, author, status, progress_percent, last_position_seconds, timestamps) — migration `0002_striped_misty_knight`.
- [x] ✅ Progress columns on `learning_items` (percent + last position).
- [x] ✅ Migration generated; `ARCHITECTURE.md` §5 updated.

### 2.3 Backend

- [x] ✅ `addLearningItem`: parses watch/youtu.be/shorts URLs, rejects duplicates, fetches title via oEmbed, inserts row.
- [x] ✅ `saveProgress`: server-side clamping 0–100, ownership-checked, idempotent.
- [x] ✅ Server-authoritative ≥80% gate (`UNLOCK_PERCENT` in `utils/credentials.ts`, enforced in `startAssessment`/`submitAssessment`).

### 2.4 Frontend

- [x] ✅ Dashboard "Add a video" form (`AddLearningForm`).
- [x] ✅ My Learning list with progress (`/dashboard/learning`).
- [x] ✅ `/learn/[id]` player page with IFrame API, progress writes, locked/unlocked assessment CTA.
- [x] ✅ Dashboard home shows real stats + recent activity (empty states when none).
- [x] 🔶 Accessibility basics (labels, aria-live errors, focus states); full axe audit deferred to Phase 6.

**Phase 2 exit criteria:** a user can add a video, watch it, and reach a server-verified ≥ 80% unlock state. Playlists explicitly out of scope.

---

## Phase 3 — Assessment MVP

> Depends on: Phase 2. Delivers `PRD.md` FR-D1–D5.

### 3.1 Decisions to lock first

- [x] ✅ Transcript source: best-effort YouTube captions (`utils/youtube.ts` timedtext) with graceful fallback to title/author grounding when captions are unavailable — decision recorded in `MEMORY.md` §12.
- [x] ✅ LLM provider behind thin interface `utils/ai.ts` (OpenAI-compatible Chat Completions, swappable via `OPENAI_BASE_URL`/`OPENAI_MODEL`); env vars in `ARCHITECTURE.md` §12.1.
- [x] ✅ Pass score 70% (`PASS_SCORE`), attempt policy: 3 attempts / 7-day window (`MAX_ATTEMPTS_PER_WINDOW`, `ATTEMPT_COOLDOWN_DAYS` in `utils/credentials.ts`).

### 3.2 Data model

- [x] ✅ `assessments` (id, learning_item_id, source, JSONB questions incl. correct index, created_at), `attempts` (id, assessment_id, user_id, learning_item_id, JSONB answers, score, passed, created_at) — migration `0002`.

### 3.3 Generation

- [x] ✅ `startAssessment`: generates once on first unlock, grounded in captions/meta; idempotent (existing assessment reused; concurrent insert handled); `AIUnavailableError` → friendly `{ message }` when `OPENAI_API_KEY` absent.
- [x] ✅ Failure UX: clear `{ message }`, no partial records (insert is single-statement; questions stored atomically).

### 3.4 Taking & scoring

- [x] ✅ Assessment UI (`/learn/[id]/assessment`, radio groups, disabled submit until all answered).
- [x] ✅ `submitAssessment` scores server-side, persists attempt, never returns correct answers pre-submission.
- [x] ✅ Attempt limiting + cooldown enforced server-side in `submitAssessment`.

**Phase 3 exit criteria:** user takes a generated, server-scored assessment; attempts recorded; pass produces an event that Phase 4 consumes.

---

## Phase 4 — Credentials, certificate & verification MVP

> Depends on: Phase 3. Delivers `PRD.md` FR-E1–E5, FR-F1–F2. This phase is the product's trust core — `RULES.md` §18 applies absolutely.

### 4.1 Data model

- [x] ✅ `credentials` table per `RULES.md` §18: prefixed random id, user/learning_item/attempt FKs, holder-name snapshot, score, `passed_at`, status `active|revoked`, `sha256-v1:` hash (`utils/credentials.ts`), timestamps.
- [x] ✅ Transactional mint: pass → credential row in one `db.transaction`, quota checked in-transaction.

### 4.2 Entitlement gate

- [x] ✅ Free quota (1 credential/month, calendar-UTC per `PRD.md` §14.5) enforced in `hasFreeQuotaRemaining`; `plan === 'none'` = free. Note: still keyed on raw subscription ID (Phase 1.1 normalization remains open).

### 4.3 Presentation

- [x] ✅ Certificate page `/certificates/[id]`: brand tokens, minimal data set, explicit validity state, print stylesheet (`PrintCertificateButton`), public access.
- [x] ✅ QR: server-side `qrcode` SVG (`buildCertificateQrSvg`) encoding the verification URL, accessible alt/adjacent URL text.

### 4.4 Verification

- [x] ✅ Public page `/verify/[id]`: middleware-exempt, recomputes + compares hash, states valid/revoked/invalid/not-found, minimal data, no question content.
- [ ] ❌ Landing-page copy reality check — confirm marketing claims match once deployed (manual).

### 4.5 Revocation

- [x] ✅ `revokeCredential` server action (owner-initiated MVP); revoked state flows through certificate + verification pages.

**Phase 4 exit criteria:** end-to-end `PRD.md` Journey B + C works and is honest; QR + public verification live.

---

## Phase 5 — Productization

- [ ] ❌ Playlists (`PRD.md` FR-C2): playlist URL parsing, child video listing, aggregate progress.
- [ ] ❌ PDF export (Pro): server-rendered PDF of the certificate (choose library; keep print CSS as fallback).
- [ ] ❌ LinkedIn share deep-links + OpenGraph metadata for certificate/verification pages (`PRD.md` FR-E6).
- [ ] ❌ Public profile `/u/[username]` listing active credentials (username uniqueness already exists).
- [ ] ❌ Emails: welcome, credential earned, attempt results (via Supabase or an email provider — document choice).
- [ ] ❌ Analytics for `PRD.md` §11 metrics + error tracking (e.g., Sentry), server-only (`RULES.md` §11.4).
- [ ] ❌ Chrome extension (free-tier promise) — needs its own PRD appendix before build; treat as unscheduled until then.
- [ ] ❌ Rate limiting/auth hardening pass before public launch (login, progress writes, generation endpoints).

## Phase 6 — Hardening & quality

> Note: the `/docs` update item below is 🔶 in progress as of the core-loop session (ARCHITECTURE/TASK/MEMORY/PRD updated); remaining phases' docs still pending.

- [ ] ❌ Test coverage goals: server actions (auth, learning, assessment, credentials) at meaningful branch coverage; webhook test suite; E2E smoke of signup → onboard → add video → assess → mint → verify.
- [ ] ❌ Performance pass: Lighthouse ≥ 90 on landing + verification pages; LLM call latency budget (`RULES.md` §12.7).
- [ ] ❌ Accessibility audit (axe) across all surfaces; fix findings.
- [ ] ❌ Security review: re-run through `RULES.md` §9 checklist; pen-test the verification endpoint's ID enumeration posture.
- [ ] ❌ Update README from starter-kit text to product-specific setup (keep setup steps).
- [ ] ❌ Update all six `/docs` files to the post-MVP state; append `MEMORY.md` handoff entry.

---

## Appendix A — Audit summary by category (as of 2026-09-28)

**Completed ✅** — Landing page (Figma 1:1, responsive, mobile nav, generated icons); auth (signup/login/logout, Google/GitHub OAuth, email confirm, forgot/reset password); onboarding gate with validation; dashboard shell + voluntary upgrade; Stripe customer provisioning, pricing table, billing portal; middleware route protection; build preflight + migrations pipeline; lint/type cleanliness (as of last commits); Prettier/ESLint configs.

**Partial 🔶** — plan display (name lookup, sentinel handling OK; representation undecided); migration history (files consistent; per-DB application of `0001`/`0002` unverified — 0.1); legal posture (footer columns exist, pages don't); billing-portal UX (fails silently to `#`).

**Completed ✅ (this session)** — full core loop: YouTube ingest + player + clamped progress + 80% gate, LLM assessment generation (OpenAI-compatible, captions fallback), server-side scoring with attempt limits, credential minting with Free quota, certificate page with QR + print, public `/verify/[id]`, revocation; dashboard navigation with active states, quick search (Cmd/Ctrl+K), settings (profile/password/plan/sign-out); Stripe webhook signature verification + updated/deleted handling + idempotency + no payload logging.

**Missing ❌** — real Stripe tiers; error surfaces beyond existing ones are fine but `loading.tsx` optional; legal pages; tests; CI; analytics; email flows; account deletion; rate limiting.

**Technical debt 🩹** — Migration application on live DBs unverified (0.1); starter-kit residue (0.4); Inter font duplication; pricing-table script global load; `text-red-500` ad-hoc error color; landing nav gap between `lg` and `xl` breakpoints; `.env.local` holds `FIGMA_TOKEN` (tooling secret in env file — harmless, note only).

**Security debt** — Absence of rate limiting and error tracking (acceptable pre-launch, scheduled Phase 5/6). Webhook signature (0.2) now fixed.

## Appendix B — Dependency graph

```
Phase 0 (hygiene) ──► Phase 1 (trust) ──► Phase 2 (learn) ──► Phase 3 (assess) ──► Phase 4 (credentials/verify) ──► Phase 5 (productize) ──► Phase 6 (harden)
        │                    │
        └── 0.6 tests/CI ────┴─► feeds every later phase (write tests alongside each phase)
```

Within-phase ordering is top-to-bottom. Items marked "decisions to lock first" block their section but can proceed in parallel with unrelated sections once resolved.
