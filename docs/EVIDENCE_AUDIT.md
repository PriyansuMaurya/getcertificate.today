# Evidence Audit — getcertificate.today

**Evidence checked: 2026-10-08.** Read-only throughout: `SELECT`-only database
queries and `GET`-only HTTP probes. No code, database rows, settings,
subscriptions, or deployment configuration were changed. No secrets or personal
data are reproduced below — email addresses are reported only as domain-level
counts.

This document records which product metrics are **verifiable from evidence** and
which are not, so that resume/portfolio claims can cite only observed results.
It deliberately distinguishes observed production data from test data, local
runs, estimates, and code-defined limits.

## How "production" was established

- The live site's `/login` client bundle references
  `glbblmstzrkffnohuedy.supabase.co`, which matches the host in `.env.local`'s
  `DATABASE_URL`. The database queried here is therefore the **same Supabase
  project the live app uses** — a strong inference, not a cryptographic proof
  (a different database name/role on the same project is conceivable, and the
  pooler role may bypass RLS differently than the app).
- Local Stripe keys are **test mode** (`sk_test_…` / `pk_test_…`). There is
  **no `.env` (production) file on this machine**, so live-mode Stripe data was
  not accessible.

## Reproduction commands

```bash
npm test                                   # 141 tests / 28 suites
npm run test:referrals:local               # disposable-Postgres lifecycle test
npm run typecheck && npm run lint          # 0 type errors, 1 lint warning
curl -s -o /dev/null -w '%{http_code}' https://getcertificate.today/   # 200
# DB counts are SELECT-only aggregates run against DATABASE_URL (.env.local)
```

---

## 1. Evidence table

| Category               | Verified metric                                      | Value and period                                                                                                                                                                       | Calculation / method                                                                                                 | Evidence source                       | Limitations                                                                                                                              |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Testing                | Unit suite: count & result                           | **141 tests / 28 suites across 5 files; 141 pass, 0 fail, 0 cancelled; 261.9 ms** (2026-10-08)                                                                                         | `npm test` → `node --import tsx --test utils/{watch-progress,credentials,plans,assessment-config,referrals}.test.ts` | `package.json:11`; raw runner summary | Local run only; **no CI**; case counts, not coverage. README's "No committed test suite" is stale.                                       |
| Testing                | Referral lifecycle / concurrency E2E                 | **31/31 checks pass** — 3 parallel settlements → exactly one credit; idempotent settlement; idempotent reversal; self-referral rejected (id **and** email); paid referrer not credited | `npm run test:referrals:local` (recorded run 2026-10-08)                                                             | `scripts/referral-lifecycle.ts`       | Ran against a **disposable embedded Postgres** (`--local`), **not** production. Not in CI.                                               |
| Testing                | Typecheck / lint                                     | `tsc --noEmit` clean; ESLint **0 errors, 1 warning** (`scripts/create-test-user.mjs` unused `e`)                                                                                       | `npm run typecheck`, `npm run lint` (2026-10-08)                                                                     | command output                        | Static checks, not tests.                                                                                                                |
| Testing                | Coverage (line/branch)                               | **Not measured** — no coverage tooling present                                                                                                                                         | —                                                                                                                    | repo scan                             | See §2.                                                                                                                                  |
| Adoption               | Registered accounts — all rows                       | **17** (2026-10-08 snapshot)                                                                                                                                                           | `count(*)` on `users_table`                                                                                          | read-only query, production project   | **Includes 5 demo/seed rows.**                                                                                                           |
| Adoption               | Registered accounts — excluding demo/seed            | **12** (11 `role=user` + 1 admin)                                                                                                                                                      | `email NOT LIKE '%@example.com'`                                                                                     | read-only query                       | Other test accounts (browser-E2E / `create-test-user` gmail signups) can't be fully identified; seed file comment says 4 but DB shows 5. |
| Adoption               | New accounts, last 30 days                           | **5**                                                                                                                                                                                  | `terms_consented_at >= now() − 30d`                                                                                  | read-only query                       | 12 of 17 rows have `terms_consented_at = NULL` (legacy), so this undercounts older signups; no historical series.                        |
| Adoption               | Learners with ≥1 learning item (non-seed)            | **4 distinct users**; 11 items                                                                                                                                                         | `count(distinct user_id)` on `learning_items`                                                                        | read-only query                       | Item granularity is videos, not sessions.                                                                                                |
| Engagement             | Video progress (non-seed)                            | **7 items ≥80% watched; 0 items at 100%**                                                                                                                                              | `progress_percent` filters                                                                                           | read-only query                       | 80% is the assessment unlock gate; 0 complete is explained by the gate.                                                                  |
| Engagement             | Attempts & pass rate                                 | All: **16 attempts / 10 passed (62.5%)**, mean score 71. Non-seed: **10 attempts / 6 passed (60.0%)**                                                                                  | `count(*)`, `count(*) FILTER (WHERE passed)`                                                                         | read-only query                       | All-time snapshot, no time series; small n.                                                                                              |
| Engagement             | Credentials issued                                   | All: **5** (4 active, 1 revoked). Non-seed: **2** (0 revoked), **1 distinct holder**                                                                                                   | `count(*)` + `status`                                                                                                | read-only query                       | 3 of 5 credentials are seed-derived.                                                                                                     |
| Engagement             | Assessments / cached transcripts                     | Assessments **10** (non-seed **5**, inferred by subtraction); transcripts cached **7**                                                                                                 | `count(*)`                                                                                                           | read-only query                       | The non-seed assessment figure is derived, not directly queried.                                                                         |
| Adoption               | Referral program usage                               | **0 referrals, 0 credit-ledger rows**                                                                                                                                                  | `count(*)` on `referrals`, `referral_credits`                                                                        | read-only query                       | Feature is shipped **and tested**, but has **zero production usage**.                                                                    |
| Public verification    | Verification-page traffic                            | **Not measurable** — no counter/log exists                                                                                                                                             | —                                                                                                                    | code inspection                       | See §2.                                                                                                                                  |
| Time coverage          | Data window                                          | Attempts **2026-08-12 → 2026-10-08**; credentials **2026-09-30 → 2026-10-02**; consent timestamps only from **2026-10-04**                                                             | min/max timestamps                                                                                                   | read-only query                       | Legacy rows predate the consent column.                                                                                                  |
| Revenue                | Paid plans (DB `plan` column)                        | **0 of 12 non-seed accounts are paid** (all `none`); the only pro-like value (`sub_gct_seed_pro_0001`) is demo data                                                                    | `group by plan`                                                                                                      | read-only query                       | Scoped to the DB column only. Test-mode Stripe locally **cannot rule out** live subscriptions.                                           |
| Revenue                | Billing mode                                         | **Stripe TEST mode** locally (`sk_test`/`pk_test`); no production `.env` present                                                                                                       | key-prefix grep (no secret values read)                                                                              | `.env.local` (prefixes only)          | Cannot inspect live Stripe without a live key/dashboard.                                                                                 |
| Revenue (code-defined) | Pricing tiers                                        | Free 1 cert/mo; Starter €4.99/mo (10/mo); Pro €9.99/mo (30/mo); Pro Yearly €49.99/yr (unlimited)                                                                                       | static definitions                                                                                                   | `utils/plans.ts`, `stripeSetup.ts`    | **Code-defined limits — not earned revenue.**                                                                                            |
| Reliability            | Site is live                                         | `GET /` 200, `/login` 200, `/robots.txt` 200, `/sitemap.xml` 200; `/subscribe` **307** (expected redirect); `/verify/<missing>` **200** (soft invalid page)                            | single `curl` GET each (2026-10-08)                                                                                  | HTTP probes                           | One probe each; 307/200 are by design, not errors, and imply no activity volume.                                                         |
| Reliability            | Home-page latency                                    | 12 samples: **min 0.159 s, median 0.190 s, mean 0.196 s, max 0.275 s**                                                                                                                 | 12 sequential `curl` timings                                                                                         | HTTP probe                            | **Single vantage, ~1 minute** — convenience sample. **Not p50/p95/p99**; TTFB not separated.                                             |
| Reliability            | Uptime %, error rate, p95/p99, external-API failures | **Not measured**                                                                                                                                                                       | —                                                                                                                    | —                                     | See §2.                                                                                                                                  |
| Instrumentation (code) | Analytics mounted                                    | Vercel Analytics + Speed Insights mounted (cookieless); GTM consent-gated (`NEXT_PUBLIC_GTM_ID` set locally)                                                                           | source inspection                                                                                                    | `components/analytics/*`              | Wiring ≠ data; **no dashboard access**.                                                                                                  |
| Instrumentation (code) | In-app metrics                                       | Admin overview computes total/active users, pass rate, credentials from live Postgres                                                                                                  | source inspection                                                                                                    | `app/admin/overview-data.ts`          | Computes on read; **stores no history**.                                                                                                 |

---

## 2. Metrics that could NOT be verified (and the source needed)

| Unverified metric                                                            | Why                                                                                  | Source required                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Registered / active / returning users **over time**                          | DB stores only current rows; `terms_consented_at` NULL for 12/17; no session history | Vercel Analytics or GA4 dashboard, or a time-series export              |
| **Public verification activity**                                             | `/verify/<id>` has no counter or log                                                 | New instrumentation, or Vercel/GA page-view data for `/verify/*`        |
| Free→paid conversion, active paid subscriptions, MRR, refunds, cancellations | Local Stripe is **test mode**; no production `.env`; DB `plan` alone is insufficient | Stripe **live-mode** Dashboard / API                                    |
| Uptime %, p95/p99 latency, error rates                                       | No monitoring artifact in repo                                                       | Vercel Analytics/Speed Insights, Vercel deployment logs, monitoring Svc |
| External-API failure/timeout rates (OpenAI, TranscriptAPI, YouTube)          | Failures logged to console only                                                      | Log aggregation (Vercel logs) or added error instrumentation            |
| Line/branch test coverage                                                    | No coverage tooling; not inferred from file/test counts                              | Add `--experimental-test-coverage` (Node) or c8/nyc and record a run    |
| Browser E2E (onboarding/referral) results                                    | Scripts exist but were **not run** (need a dev server + real signups)                | Run `scripts/test-onboarding-browser.mjs`, `test-referral-browser.mjs`  |

---

## 3. Revised "Evidence Not Included" note

> An original "Evidence Not Included" note was **not found** in the repository —
> `docs/` contains only `LEGAL_COMPLIANCE_AUDIT.md`, and the README references
> `docs/PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `RULES.md`, `TASK.md`, and
> `MEMORY.md`, none of which exist. The note below is a reconstructed revision.

**Evidence Not Included** _(revised 2026-10-08)_

- **Now included / gaps resolved:** a committed automated test suite with
  recorded results (141 tests, 28 suites, 0 failures); a recorded Postgres
  concurrency + fraud-reversal lifecycle test (31/31 checks); verification that
  the product is live (key routes return 200); and a production adoption
  snapshot (12 non-demo accounts, 4 learners, 6/10 non-demo attempts passed, 1
  credential holder).
- **Still not included (unresolved):** returning-user/historical analytics;
  free→paid conversion, revenue, refunds and cancellations (Stripe live mode);
  uptime %, p95/p99 latency, error rates and external-API failure rates;
  line/branch test coverage; public verification-page activity.

---

## 4. Resume-ready bullets (verified evidence only)

- **Authored 141 automated tests across 28 suites (5 modules)** for a Next.js
  credential platform — covering anti-forgery watch-progress reconciliation,
  SHA-256 credential integrity and quota logic, plan-tier entitlements, adaptive
  assessment sizing, and referral eligibility — **all 141 pass in 0.26 s**.
- **Built a Postgres end-to-end integrity test that proves referral safety under
  concurrency:** 3 parallel settlements yield **exactly one** credit; settlement
  and fraud reversal are idempotent; self-referral is rejected by both user id
  and email — **31/31 checks pass** against a disposable database provisioned
  with the production schema.
- **Shipped and operate getcertificate.today** (Next.js 16 · Supabase Postgres ·
  Stripe · Vercel): verified live with HTTP 200 on `/`, `/login`, `/robots.txt`
  and `/sitemap.xml`, and a 12-request home-page latency sample of **0.16–0.28 s**.
- **Implemented tamper-evident certificates** — server-side SHA-256 hashing with a
  versioned scheme, unique credential IDs, QR codes, and a public `/verify/<id>`
  page that rechecks the hash **without requiring an account**.
- **Delivered an admin analytics view** that computes total/active users, pass
  rate, and credentials issued directly from production Postgres (observed
  **60% pass rate on 10 non-demo attempts**).
- **Launched a referral program with an idempotent, append-only credit ledger**
  that raises the free-tier certificate allowance (+1 per verified referral),
  with admin fraud-reversal support — shipped and test-covered (currently 0
  production referrals).

> **Scaling caveat:** the verified production footprint is small (12 non-demo
> accounts, 1 credential holder). Avoid "thousands of users" framing — the
> strongest, safest signal here is **engineering rigor** (tests, concurrency
> safety, transactional/idempotent design, a shipped live product), not scale.
