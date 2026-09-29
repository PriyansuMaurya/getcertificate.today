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
  - [ ] Confirm the production DB has `0001` applied (query `__drizzle_migrations` or the columns); if it was provisioned via `db:push`, reconcile history per drizzle-kit docs — **document the outcome in `MEMORY.md`**.
  - [ ] Note for future sessions: the `0001` journal entry and files were created 2026-09-28 (same day as commit `a1bd15d`); if `db:generate` or `db:migrate` ever complains about journal/history mismatch, re-baseline per drizzle-kit docs and record what happened in `MEMORY.md`.

### 0.2 Stripe webhook security (release blocker for billing)

- [ ] ❌ Add webhook signature verification: read raw body, `stripe.webhooks.constructEvent(rawBody, sigHeader, process.env.STRIPE_WEBHOOK_SECRET)`, 400 on failure.
- [ ] ❌ Add `STRIPE_WEBHOOK_SECRET` to `.env.example`, local dev (via `stripe listen` output), and document in `ARCHITECTURE.md` §12.1.
- [ ] 🩹 Fix the missing `break` fall-through in the `customer.subscription.created` case.
- [ ] ❌ Handle `customer.subscription.updated` (sync status) and `customer.subscription.deleted` (reset `plan` to `'none'`) — data-integrity rule `RULES.md` §17.3.
- [ ] ❌ Make the handler idempotent (Stripe retries; check whether the subscription ID is already stored before writing, or upsert).
- [ ] 🩹 Remove `console.log("event:", event)` payload logging.

### 0.3 Missing error surfaces

- [ ] ❌ Create `app/not-found.tsx` (global 404).
- [ ] ❌ Create `app/error.tsx` (client error boundary).
- [ ] ❌ Create `/auth/auth-code-error` page — currently a redirect target from `app/auth/callback/route.ts` that 404s.
- [ ] ❌ Create `/error` page — currently a redirect target from `app/auth/auth/confirm/route.ts` that 404s.
- [ ] ❌ Optionally `app/loading.tsx` for the dashboard segment.

### 0.4 Starter-kit residue cleanup (cosmetic but user-visible)

- [ ] 🩹 Fix broken Tailwind class typo `text-2x\l` in `app/signup/page.tsx`.
- [ ] 🩹 Replace `app/dashboard/layout.tsx` metadata ("SAAS Starter Kit") with product metadata.
- [ ] 🩹 Fix nested `<Link>` inside `<Link>` (Billing item) in `components/DashboardHeaderProfileDropdown.tsx`.
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

- [ ] ❌ Refactor the public-path list in `utils/supabase/middleware.ts` into a documented constant, adding `/verify` (future) and the new error pages.
- [ ] ❌ Consolidate user provisioning into one place (recommend `app/auth/callback/route.ts`) to remove the signup/callback duplication and its duplicate-insert race (`ARCHITECTURE.md` §6.5).

**Phase 1 exit criteria:** billing state is truthful; legal pages exist; public-route mechanism ready for verification pages.

---

## Phase 2 — Learning content MVP (YouTube video)

> Depends on: Phase 0/1. Delivers `PRD.md` FR-C1/C3/C4/C5 for single videos (playlists deferred to Phase 5).

### 2.1 Decisions to lock first (see `PRD.md` §14)

- [ ] ❌ Schema naming convention for new tables (`learning_items` vs `*_table` suffix) — record in `MEMORY.md`.
- [ ] ❌ Progress-tracking mechanism (YouTube IFrame API events → server action) and its abuse posture (rate limiting per `RULES.md` §9.3).

### 2.2 Data model

- [ ] ❌ Add `learning_items` table: id (uuid pk), user_id → users_table.id, kind (`video`), source_url, youtube_id, title, status, created_at, updated_at.
- [ ] ❌ Add `learning_progress` (or column set) tracking percent + last position per user per item.
- [ ] ❌ Generate + apply migrations; update `ARCHITECTURE.md` §5.

### 2.3 Backend

- [ ] ❌ Server action `addLearningItem(url)`: validate/parse YouTube watch + youtu.be URLs (`PRD.md` FR-C1 AC1), reject duplicates per user, fetch title (permitted API), insert row.
- [ ] ❌ Server action `updateProgress(itemId, percent|seconds)`: server-side clamping/validation, idempotent writes, rate-limited.
- [ ] ❌ Server-side completion-gate check: exported helper `isAssessmentUnlocked(itemId)` enforcing ≥ 80% (`RULES.md` §9.3 — server-authoritative).

### 2.4 Frontend

- [ ] ❌ Dashboard "Add a video" form (URL input + `{ message }` error pattern).
- [ ] ❌ Dashboard learning-items list with progress ("80% complete") and status.
- [ ] ❌ Item detail page `/learn/[id]`: embedded YouTube player (IFrame API), progress writes, locked/unlocked assessment CTA with explanatory disabled state (`RULES.md` §8.9).
- [ ] ❌ Update dashboard empty state (no items yet) — follow the upgrade-card pattern.
- [ ] ❌ Accessibility pass: player keyboard/focus handling, labeled controls (`DESIGN.md` §11).

**Phase 2 exit criteria:** a user can add a video, watch it, and reach a server-verified ≥ 80% unlock state. Playlists explicitly out of scope.

---

## Phase 3 — Assessment MVP

> Depends on: Phase 2. Delivers `PRD.md` FR-D1–D5.

### 3.1 Decisions to lock first

- [ ] ❌ Transcript source that complies with YouTube ToS (`PRD.md` §12.2) — run a spike, record the decision + fallback in `MEMORY.md`.
- [ ] ❌ LLM provider + thin internal interface (`utils/ai/*`) so the provider is swappable; add env vars to `ARCHITECTURE.md` §12.1.
- [ ] ❌ Pass score (proposed 70%), attempt policy (proposed 3 attempts + cooldown) — confirm in `PRD.md` §14.1.

### 3.2 Data model

- [ ] ❌ `assessments` (id, learning_item_id, question_set hash/version, created_at), `questions` (prompt, choices JSON, correct index — never sent to client pre-submission), `attempts` (id, assessment_id, user_id, answers, score, passed, created_at).

### 3.3 Generation

- [ ] ❌ Server action/route: on first unlock, generate N=10 MCQs grounded in the transcript (`PRD.md` FR-D2 AC1–AC4); store with a schema-version marker; idempotent per item.
- [ ] ❌ Failure UX: clear `{ message }` error, no partial records (transactional insert per `RULES.md` §17.2).

### 3.4 Taking & scoring

- [ ] ❌ Assessment UI per `DESIGN.md` §13 (one-column, radio groups, disabled submit with hint until complete).
- [ ] ❌ Server-side scoring action; persist attempt with score + passed; never expose correct answers pre-submission; return results post-submission.
- [ ] ❌ Attempt limiting + cooldown enforcement server-side.

**Phase 3 exit criteria:** user takes a generated, server-scored assessment; attempts recorded; pass produces an event that Phase 4 consumes.

---

## Phase 4 — Credentials, certificate & verification MVP

> Depends on: Phase 3. Delivers `PRD.md` FR-E1–E5, FR-F1–F2. This phase is the product's trust core — `RULES.md` §18 applies absolutely.

### 4.1 Data model

- [ ] ❌ `credentials` table: id (crypto-random UUID or prefixed random — `RULES.md` §18.1), user_id, learning_item_id, attempt_id, holder display name snapshot, score, passed_at, status (`active` | `revoked`), hash (SHA-256 over canonical fields with `sha256-v1:` version prefix), created_at. Immutable per `RULES.md` §18.4.
- [ ] ❌ Transactional mint: passing attempt → credential row in one DB transaction (`RULES.md` §17.2).

### 4.2 Entitlement gate

- [ ] ❌ Enforce Free quota (1 credential/month, calendar-UTC per `PRD.md` §14.5) vs Pro unlimited — depends on Phase 1.1 normalized plan.

### 4.3 Presentation

- [ ] ❌ Certificate page `/certificates/[id]` implementing the five `DESIGN.md` §12 constraints (brand tokens, data set, monochrome QR, explicit validity states, print stylesheet).
- [ ] ❌ QR generation (tiny server-side lib or hand-rolled SVG per `RULES.md` §6.4) encoding the verification URL; accessible alternative text.

### 4.4 Verification

- [ ] ❌ Public page `/verify/[id]` per `DESIGN.md` §14 + `PRD.md` FR-F1: middleware-exempt (Phase 1.3), recompute + compare hash (`RULES.md` §18.2), states valid/revoked/invalid/not-found, minimal data, no question content.
- [ ] ❌ Landing-page copy reality check: by the time credentials are public, ensure the "cryptographic hash and quick-verify QR code" claims are true (they will be, after 4.1–4.4).

### 4.5 Revocation

- [ ] ❌ Server action to revoke (owner-initiated MVP); revoked state flows through certificate + verification pages.

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

- [ ] ❌ Test coverage goals: server actions (auth, learning, assessment, credentials) at meaningful branch coverage; webhook test suite; E2E smoke of signup → onboard → add video → assess → mint → verify.
- [ ] ❌ Performance pass: Lighthouse ≥ 90 on landing + verification pages; LLM call latency budget (`RULES.md` §12.7).
- [ ] ❌ Accessibility audit (axe) across all surfaces; fix findings.
- [ ] ❌ Security review: re-run through `RULES.md` §9 checklist; pen-test the verification endpoint's ID enumeration posture.
- [ ] ❌ Update README from starter-kit text to product-specific setup (keep setup steps).
- [ ] ❌ Update all six `/docs` files to the post-MVP state; append `MEMORY.md` handoff entry.

---

## Appendix A — Audit summary by category (as of 2026-09-28)

**Completed ✅** — Landing page (Figma 1:1, responsive, mobile nav, generated icons); auth (signup/login/logout, Google/GitHub OAuth, email confirm, forgot/reset password); onboarding gate with validation; dashboard shell + voluntary upgrade; Stripe customer provisioning, pricing table, billing portal; middleware route protection; build preflight + migrations pipeline; lint/type cleanliness (as of last commits); Prettier/ESLint configs.

**Partial 🔶** — Stripe webhook (works for `created` but unverified, fall-through bug, `deleted` unhandled); plan display (name lookup, sentinel handling OK; representation undecided); migration history (files consistent; per-DB application of `0001` unverified — 0.1); legal posture (footer columns exist, pages don't); billing-portal UX (fails silently to `#`).

**Missing ❌** — Entire core product loop (YouTube ingest, player+progress, 80% gate, transcript+LLM assessment, scoring UI, credential minting, QR, certificate view, public verification); entitlement/quota enforcement; real Stripe tiers; error/404 pages; legal pages; tests; CI; analytics; email flows; account deletion.

**Technical debt 🩹** — Migration `0001` application on live DBs unverified (0.1); starter-kit residue (0.4); Inter font duplication; pricing-table script global load; `text-red-500` ad-hoc error color; empty placeholder files/dirs; landing nav gap between `lg` and `xl` breakpoints (no nav rendered); dashboard metadata; nested Link in dropdown; `.env.local` holds `FIGMA_TOKEN` (tooling secret in env file — harmless, note only).

**Security debt** — Webhook signature (0.2) is the only critical finding; plus absence of rate limiting and error tracking (acceptable pre-launch, scheduled Phase 5/6).

## Appendix B — Dependency graph

```
Phase 0 (hygiene) ──► Phase 1 (trust) ──► Phase 2 (learn) ──► Phase 3 (assess) ──► Phase 4 (credentials/verify) ──► Phase 5 (productize) ──► Phase 6 (harden)
        │                    │
        └── 0.6 tests/CI ────┴─► feeds every later phase (write tests alongside each phase)
```

Within-phase ordering is top-to-bottom. Items marked "decisions to lock first" block their section but can proceed in parallel with unrelated sections once resolved.
