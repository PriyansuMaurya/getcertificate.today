# getcertificate.today

**Turning YouTube video minutes into verifiable professional credentials. Learn Today. Go Further.**

A single [Next.js 16](https://nextjs.org/) application (App Router) that turns YouTube learning into **shareable, tamper-evident credentials**: a learner adds a YouTube video, watches it in a tracked player, passes an AI-generated assessment grounded in the video's transcript, and earns a certificate with a unique credential ID, SHA-256 integrity hash, QR code, and a public verification page anyone can check, with no account required.

## How it works

1. **Add a video.** Paste a YouTube URL (`watch`, `youtu.be`, or `shorts`); the system validates it and creates a learning item.
2. **Learn.** Watch in the embedded player; progress is persisted server-side (client-reported, clamped and ownership-checked) and the assessment unlocks at **≥ 80% completion**.
3. **Assess.** "Generate & start assessment" fetches the transcript through [TranscriptAPI](https://transcriptapi.com/docs/api/) (server-side, cached per video ID in the `transcripts` table), with best-effort YouTube captions (`utils/youtube.ts`) as the fallback source, then sends it to an OpenAI-compatible LLM, and generates multiple-choice questions strictly from that content. Answers are graded **server-side**; each question shows instant feedback with the selected answer, the correct answer, and why each is right/wrong. Pass score is 70%, max 3 attempts per 7-day window.
4. **Certify.** Passing mints a credential transactionally: score, unique credential ID, `sha256-v1:` hash over immutable fields, free-tier quota enforced (1 credential/month on Free, unlimited on Pro).
5. **Verify.** The certificate page renders an SVG QR code; the public `/verify/<id>` page rechecks the hash and shows valid / revoked / invalid states for anyone, without logging in.

## Features

- Email/password signup, login, logout, forgot/reset password
- Google + GitHub OAuth (rendered only when provider env vars are set)
- Mandatory onboarding gate (username, name, DOB with 13+ age check)
- Protected `/dashboard` with stats, add-video flow, quick search (Cmd/Ctrl+K), settings
- Protected `/admin` console (gated by `users_table.role = 'admin'`, non-admins get 404): overview dashboard with real metrics (users, 30-day actives, learning items, attempts, pass rate, credentials), recent users/credentials, and recent failure signals; plus a searchable users table (`/admin/users`) with per-user activity counts, a detail page, and server-side suspend/unsuspend/delete actions; and an assessments review area (`/admin/assessments`) listing every generated question set with attempt scores, failed-generation surfacing (title-only assessments), a full question inspector, and server-gated regenerate/delete reusing the production transcript + LLM pipeline
- YouTube learning: embedded player, server-validated progress, 80% completion gate
- TranscriptAPI transcript fetch with **per-video DB cache** (no repeated API calls)
- LLM assessment generation via one thin OpenAI-compatible interface (structured JSON, validated before it reaches the frontend), configurable question count
- Instant per-answer feedback, server-side scoring, bounded error/timeout/retry states
- Credential minting with SHA-256 hash, certificate page with QR code, print-to-PDF
- Public `/verify/<id>` verification and `/certificates/<id>` pages (middleware-exempt)
- Stripe billing: embedded pricing table (Customer Sessions), billing portal, **signature-verified** idempotent webhook; subscribing is optional
- Figma-faithful responsive landing page (Figma frame `6:9`, ISR-revalidated hourly)
- Drizzle ORM + Supabase Postgres, Tailwind CSS / shadcn-ui

## Tech stack

| Layer       | Technology                                                                    |
| ----------- | ----------------------------------------------------------------------------- |
| Framework   | Next.js 16 (App Router, Turbopack), React 18, TypeScript `strict`             |
| Auth        | Supabase GoTrue via `@supabase/ssr` (cookie sessions + middleware refresh)    |
| Database    | Supabase Postgres via postgres.js + Drizzle ORM (`prepare: false` for pooler) |
| Payments    | Stripe (pricing table, Customer Sessions, billing portal, webhooks)           |
| AI          | OpenAI SDK against any OpenAI-compatible base URL (`utils/ai.ts`)             |
| Transcripts | TranscriptAPI (`utils/transcripts.ts`, server-only, DB-cached)                |
| Styling     | Tailwind CSS 3 + shadcn/ui + Radix; Figma-derived tokens                      |
| Deploy      | Vercel (Node 20), build = DB preflight → migrate → `next build`               |

Full details live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Getting started

Prerequisites: **Node 20** (see `.nvmrc`) and npm. Use `.env.local` for local development and `.env` for production (the app and `drizzle.config.ts` follow this convention).

Copy the template and fill in values:

```bash
cp .env.example .env.local
```

### 1. Supabase (auth + database)

1. Create a project at [supabase.com](https://supabase.com/).
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use the publishable key, never an `sb_secret_`/service-role key, in a `NEXT_PUBLIC_*` variable).
3. Add `NEXT_PUBLIC_WEBSITE_URL` (defaults to `http://localhost:3000`) so OAuth redirects back correctly.
4. In the dashboard, set **Authentication → URL Configuration** Site URL and redirect allowlist (`/auth/callback`, `/forgot-password/reset`).
5. Optional OAuth providers: add `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` and `GITHUB_OAUTH_CLIENT_ID`/`GITHUB_OAUTH_CLIENT_SECRET`, following the [Google](https://supabase.com/docs/guides/auth/social-login/auth-google) and [GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github) guides.
   - **Google sign-in uses [Google Identity Services](https://developers.google.com/identity/gsi/web) directly** (`signInWithIdToken`) so Google's account chooser shows your own domain instead of `<project-ref>.supabase.co`. In the [Google Cloud OAuth client](https://console.cloud.google.com/apis/credentials), add your app origins under **Authorized JavaScript origins** (e.g. `http://localhost:3000` and `https://getcertificate.today`), and keep the Supabase callback under **Authorized redirect URIs** (used by the built-in fallback flow). `GOOGLE_OAUTH_CLIENT_ID` must match the client configured in the Supabase Google provider.

### 2. Postgres connection

Add `DATABASE_URL`: a Postgres connection string (Supabase pooler-compatible, e.g. `postgresql://USER:PASSWORD@host/db?sslmode=require`).

Then provision the schema. **On a new or existing database, run the idempotent bootstrap scripts, not individual files from `utils/db/migrations/`** (those are drizzle bookkeeping and assume prior state):

```bash
# create all tables, enable RLS, mark migrations as applied
psql "$DATABASE_URL" -f sql/01_production_schema.sql
# optional demo data
psql "$DATABASE_URL" -f sql/02_seed_data.sql
# optional: transactional validation of the bootstrap
node sql/validate.mjs
```

Both SQL scripts are idempotent and safe to re-run. If `psql` is unavailable, run them from any Postgres client (e.g. the Supabase SQL editor).

After that, normal drizzle workflow applies to schema changes:

1. Edit `utils/db/schema.ts`
2. `npm run db:generate` to generate the migration
3. `npm run db:migrate` to apply it

**Granting admin access:** the `/admin` console only admits users with `users_table.role = 'admin'` (everyone else defaults to `'user'` and gets a 404). There is no self-serve promotion flow - grant it directly:

```sql
UPDATE users_table SET role = 'admin' WHERE email = 'you@example.com';
```

### 3. Stripe (optional but recommended)

1. [Register](https://dashboard.stripe.com/register) and add `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, plus `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_POPULAR`, and `STRIPE_PRICE_PREMIUM` (the price IDs behind the `/subscribe` pricing cards).
2. Add `STRIPE_WEBHOOK_SECRET`. The webhook **fails closed** without it (raw-body signature verification). Locally, `npm run stripe:listen` prints the secret and forwards events to `http://localhost:3000/webhook/stripe`.
3. `npm run stripe:setup` seeds the $9/$19/$39 products/prices and (in production mode) the webhook endpoint. `/subscribe` renders its own pricing cards - no Stripe-hosted Pricing Table involved - and returns to `/subscribe?checkout=success|canceled`.

Subscribing is optional for users; the dashboard only shows a voluntary upgrade card.

### 4. AI assessment generation

OpenAI-compatible Chat Completions, all server-side:

```bash
OPENAI_API_KEY=sk-...        # without it, generation shows a clear "not configured" error
OPENAI_MODEL=gpt-4o-mini     # any model id on your endpoint
OPENAI_BASE_URL=https://api.openai.com/v1   # or OpenRouter, Ollama, etc.
```

### 5. Transcript fetching

```bash
TRANSCRIPTAPI_KEY=...        # https://transcriptapi.com/docs/api/
```

Server-only. Transcripts are cached in the `transcripts` table by YouTube video ID, so each video hits the API at most once. Without the key, cached transcripts are still reused and new videos get a friendly "transcript unavailable" error.

### 6. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                                                         | Does                                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                                                  | Next dev (Turbopack)                                                       |
| `npm run build`                                                | DB preflight → `drizzle-kit migrate` → `next build` (DB must be reachable) |
| `npm run lint`                                                 | ESLint 9 (flat config)                                                     |
| `npm run format` / `format:check`                              | Prettier (with Tailwind class sorting)                                     |
| `npx tsc --noEmit`                                             | Typecheck (no `typecheck` script exists)                                   |
| `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` | drizzle-kit workflows                                                      |
| `npm run stripe:setup`                                         | Seed Stripe products/prices/webhook endpoint                               |
| `npm run stripe:listen`                                        | Forward Stripe webhooks to localhost                                       |

## Project structure

```
app/            # App Router: landing, auth, dashboard, learn/[id], certificates, verify, webhook
components/     # Shared components (icons.tsx is generated from Figma; never hand-edit)
utils/          # Server-only integrations: db/ (schema+migrations), transcripts.ts, ai.ts,
                # youtube.ts, credentials.ts, stripe/, supabase/
lib/            # cn() class helper
sql/            # Idempotent production bootstrap + seed + transactional validator
scripts/        # db-preflight, Figma icon generator, dev-only flow checks
docs/           # PRD, ARCHITECTURE, DESIGN, RULES, TASK, MEMORY: source of truth
```

## Documentation

This repository is documented in [`docs/`](docs/):

- [`docs/PRD.md`](docs/PRD.md): product requirements and feature status tags (`[EXISTS]` / `[PLANNED]`)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): system design, routes, data flows, env vars
- [`docs/DESIGN.md`](docs/DESIGN.md): design system and Figma consistency rules
- [`docs/RULES.md`](docs/RULES.md): engineering standards
- [`docs/TASK.md`](docs/TASK.md): roadmap

Agents: see [`AGENTS.md`](AGENTS.md) for workflow rules. **Check the `[EXISTS]`/`[PLANNED]` tags in the PRD before assuming any capability exists.**

## Deploy on Vercel

Deploy with the [Vercel Platform](https://vercel.com/new). Set the environment variables above in the project settings (they must be available to **Builds**, because the build runs the DB preflight and migrations, so `DATABASE_URL` must be reachable at build time), then deploy. See the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for details.

## Known gaps

- No committed test suite or CI yet. Playwright is installed but only used by dev-only scripts (`docs/TASK.md` Phase 0).
- `stripeSetup.ts` seeds placeholder plans that do not match the Free/Pro tiers shown on the landing page.
- Legal pages live at /privacy, /terms, and /cookie-policy (see docs/LEGAL_COMPLIANCE_AUDIT.md).
