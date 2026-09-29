# RULES — Development rules for getcertificate.today

|                 |                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document status | Enforceable engineering rules                                                                                                                                                          |
| Last updated    | 2026-09-28                                                                                                                                                                             |
| Basis           | Observed conventions in the repository (ESLint/Prettier configs, existing code patterns, `AGENTS.md`) extended with rules required by the product's trust mission (see `PRD.md` NFR-1) |
| Related docs    | `ARCHITECTURE.md`, `DESIGN.md`, `TASK.md`, `MEMORY.md`                                                                                                                                 |

**How to use these rules:** an AI agent (or human) changing this repository must satisfy every **MUST** in the section relevant to their change. "MUST" = blocker; "SHOULD" = deviation requires a written reason in the PR/commit or `MEMORY.md`; "MAY" = optional. Verification commands are given per section.

---

## 1. Architecture boundaries

1. **MUST** keep all route definitions in `app/**` (App Router). No `pages/` directory.
2. **MUST** keep secrets and privileged clients server-only:
   - `DATABASE_URL`, `STRIPE_SECRET_KEY`, provider OAuth secrets, and any future LLM keys **MUST NOT** be imported into Client Components (`"use client"`).
   - The Supabase **service-role** key MUST NOT be used anywhere in this codebase (pattern: anon key + RLS/server actions only).
3. **MUST** place integration clients in their existing homes and import them from there: Supabase → `utils/supabase/{server,client,middleware}.ts`; DB → `utils/db/db.ts`; schema → `utils/db/schema.ts`; Stripe → `utils/stripe/api.ts`. Application code MUST NOT construct raw `postgres`, `createServerClient`, or `Stripe` instances directly (the one existing exception is `stripeSetup.ts` and dev scripts under `scripts/`, which are standalone CLIs).
4. **MUST** do mutations through Server Actions or Route Handlers — never direct DB/Stripe calls from client components. Reads happen in RSCs.
5. **MUST** enforce authorization server-side in every route/action, even where middleware already checks (defense in depth is the existing pattern: middleware + `getUser()` per page + onboarding gate).
6. **MUST** add new public (no-auth) routes — e.g., future `/verify/**` — to the middleware's public-path list **and** keep their data reads minimal and non-PII (see §9).
7. **SHOULD** keep server actions colocated with their route segment (e.g., `app/auth/actions.ts`, `app/dashboard/actions.ts`) rather than a global actions module.
8. **MUST NOT** introduce a second state-management library, data-fetching library (React Query/SWR), or CSS framework without updating `ARCHITECTURE.md` first.
9. **MUST NOT** add new top-level directories without documenting them in `ARCHITECTURE.md` §3 and `MEMORY.md`.
10. **SHOULD** keep generated files (`components/icons.tsx`, `utils/db/migrations/**`) out of manual edits — see §13.

## 2. Code quality

1. **MUST** pass `npm run lint` (ESLint 9 flat config) with zero errors and zero new warnings.
2. **MUST** pass `npx tsc --noEmit` with zero errors. `strict` mode is on; do not weaken `tsconfig.json`.
3. **MUST NOT** use `any` except at documented third-party boundaries; prefer `unknown` + narrowing. Non-null assertions (`!`) are allowed only where the invariant is provable (existing style: `user!.email!` after auth checks) — when in doubt, guard and return an error instead.
4. **MUST NOT** leave commented-out code, `console.log` debugging leftovers, or empty placeholder files in committed work (existing placeholders like `app/dashboard/actions.ts` are grandfathered; use or delete them).
5. **MUST** keep components small and server-first: default to RSC; add `"use client"` only when the file uses hooks, event handlers, or browser APIs. Current client components are all forms/interactions only.
6. **SHOULD** extract repeated markup into components rather than copy-pasting JSX between pages.
7. **MUST** run Prettier (`npm run format`) so formatting never shows up as review noise (see §4).

## 3. Naming conventions

1. **Files & folders:**
   - Route files: Next.js reserved names (`page.tsx`, `layout.tsx`, `route.ts`) lowercase.
   - Components: `PascalCase.tsx` (`DashboardHeader.tsx`); shadcn primitives stay in `components/ui/` with their lowercase shadcn names.
   - Server-action modules: `actions.ts` inside the owning route segment.
   - Integration modules: lowercase (`db.ts`, `schema.ts`, `api.ts`, `middleware.ts`, `client.ts`, `server.ts`).
   - Utility scripts: `kebab-case.mjs` (`db-preflight.mjs`); Python tooling: `kebab-case.py`.
2. **Identifiers:** `camelCase` for variables/functions; `PascalCase` for components/types; `SCREAMING_SNAKE_CASE` for module-level constants (`NAV_LINKS`, `STEPS`, `PUBLIC_URL`).
3. **Database:** tables lowercase snake (`users_table`); columns lowercase snake (`first_name`, `stripe_id`); Drizzle exports `camelCase` (`usersTable`). Keep the existing `*_table` suffix for new tables unless a documented decision changes it (open question in `MEMORY.md`).
4. **Env vars:** exact `SCREAMING_SNAKE_CASE` as listed in `ARCHITECTURE.md` §12.1; `NEXT_PUBLIC_` prefix only for values safe to ship to browsers.
5. **Exports:** named exports for everything except pages/layouts (Next requires default exports there) and `components/ui` shadcn files (keep their existing pattern).

## 4. Formatting

1. **MUST** satisfy `.prettierrc`: single quotes, semi, 2-space indent, print width 100, ES5 trailing commas, LF line endings, Tailwind class sorting via `prettier-plugin-tailwindcss`.
2. **MUST** use LF in committed files even on Windows (`endOfLine: "lf"`); verify with `npm run format:check`.
3. **SHOULD** keep the existing three-space indentation of config files only when editing those exact files; new TS/TSX files use Prettier defaults (2 spaces).
4. Tailwind class order follows the Prettier plugin — do not hand-sort.

## 5. Typing rules

1. **MUST** type all function signatures; rely on inference only for trivial locals.
2. **MUST** use Drizzle's inferred types for DB rows (`SelectUser`, `InsertUser`, or `$inferSelect`/`$inferInsert`) instead of hand-written row shapes.
3. **MUST** type server-action state as `{ message: string }` to match the existing `useActionState` contract (or update every form consistently if it changes).
4. **MUST NOT** use `// @ts-ignore` / `@ts-expect-error` without a same-line explanation and a linked issue in `TASK.md`.
5. **SHOULD** model enums as string-literal unions (e.g., `type Plan = 'none' | 'pro'`) in `utils/db/schema.ts`-adjacent types; keep DB columns `text` with validated values at the boundary (current pattern).
6. External-element casts like `'stripe-pricing-table' as React.ElementType` (existing in `StripePricingTable.tsx`) are the approved pattern for untyped custom elements — prefer it over global JSX namespace augmentation.

## 6. Dependency management

1. **MUST** use npm (package-lock.json is authoritative); no mixing yarn/pnpm/bun lockfiles.
2. **MUST** run `npm install` (not `--force`) and commit `package-lock.json` with any `package.json` change.
3. **MUST** pin new runtime dependencies with carets consistent with existing entries and verify they work on Node 20.
4. **SHOULD NOT** add a dependency for something < ~30 lines of code (e.g., date math, small QR SVGs may be hand-rolled or use a tiny lib — justify in the PR).
5. **MUST** check the bundle impact of anything imported into client components; server-only packages must never appear in a `"use client"` import graph.
6. **MUST** record any new external service (LLM provider, QR service, email) in `ARCHITECTURE.md` §8 and its env vars in §12.1 **in the same change**.
7. Dependency upgrades in-range are fine (precedent: commit `091a4e4`); cross-major upgrades need their own commit and a green `npm run build`.

## 7. Testing

1. **Current state:** no test framework is installed. Adding one is Phase 0 work in `TASK.md`; until then the minimum bar is: `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass.
2. **MUST** (once the framework lands): every new server action or route handler with business logic gets at least one unit test (validation branches included); every new page gets a smoke test asserting render + auth redirect.
3. **MUST** keep test files adjacent (`*.test.ts(x)` next to the unit) or under a top-level `__tests__/` — pick one and stay consistent (decide when the framework is added; record in `MEMORY.md`).
4. **MUST NOT** commit tests that require real external services (Stripe/Supabase/LLM). Use mocks; the existing dev scripts (`scripts/test-onboarding-flow.mjs`) are the model for _manual_ integration verification against localhost, not CI tests.
5. **MUST NOT** run dev scripts (`scripts/demo-user.mjs`, `scripts/test-onboarding-flow.mjs`, `stripeSetup.ts`) against production env or shared databases; they mutate/delete rows directly.
6. **SHOULD** verify flows end-to-end with `npm run dev` + the browser before marking roadmap items complete, mirroring the existing `test-onboarding-flow.mjs` approach.

## 8. Accessibility

1. **MUST** target WCAG 2.1 AA on all surfaces (`PRD.md` NFR-3).
2. **MUST** associate every input with a `<Label htmlFor>` (existing forms do this).
3. **MUST** give icon-only buttons an accessible name (`aria-label`/`sr-only` text — pattern already used in `DashboardHeader`, `MobileNav`, `ProviderSigninBlock`).
4. **MUST** mark decorative SVGs `aria-hidden` (pattern used throughout `components/icons.tsx`).
5. **MUST** keep the disclosure pattern of `MobileNav` for any new toggled UI: `aria-expanded` on the trigger, keyboard operable, closes on selection.
6. **MUST** ensure visible focus states (`focus-visible:ring-*` from shadcn primitives) are never removed.
7. **SHOULD** prefer semantic elements (`nav`, `header`, `main`, `ul/li`) over div soup, as the landing page does.
8. Color contrast must meet 4.5:1 for body text; the Figma palette in `DESIGN.md` was chosen with this in mind — do not lighten `clay`/`sand` text without a contrast check.
9. Interactive gates (e.g., disabled "Take assessment" button) MUST explain _why_ they're disabled in adjacent text, not just `disabled` state.

## 9. Security

1. **MUST** verify every webhook's signature before trusting its payload. The Stripe webhook MUST use `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` and the raw request body (this is currently violated — fixing it is a top roadmap item, not optional).
2. **MUST** make webhook handlers idempotent (Stripe retries; an event may arrive more than once).
3. **MUST NOT** trust the client for anything security-relevant: scores, progress, plan/entitlements, credential IDs must be computed/validated server-side. Server actions MUST re-validate all form fields even when the client validates.
4. **MUST NOT** log secrets, tokens, full webhook payloads, or PII (`dob`, emails in non-error contexts). Error logs carry messages, not payloads (existing pattern: `err instanceof Error ? err.message : 'Unknown error'`).
5. **MUST** add new public-path exemptions in `utils/supabase/middleware.ts` narrowly (exact prefixes) and never exempt mutation endpoints from signature checks to "make them work".
6. **MUST** use `redirect()` targets from server constants (`PUBLIC_URL` pattern), never from unvalidated user input.
7. **MUST** parameterize all SQL through Drizzle — never string-concatenate queries.
8. **MUST NOT** display raw DB/Stripe error messages to users; map to friendly copy (existing pattern in auth actions).
9. New tables holding PII MUST be reviewed for column minimization (e.g., `dob` must never appear on public verification pages).

## 10. Error handling

1. **MUST** catch and convert external-service failures (Stripe, Supabase, future LLM) into user-facing `{ message }` strings in actions, or graceful fallbacks in RSCs (pattern: `DashboardHeaderProfileDropdown`'s billing-portal `try/catch` → `'#'`).
2. **MUST** fail fast on configuration errors at startup/build (pattern: `drizzle.config.ts` and `db-preflight.mjs` throwing with actionable text).
3. **MUST NOT** swallow errors silently; at minimum log `console.error` with context. When adding an error-tracking tool, wrap rather than replace this.
4. **MUST** give every redirect-to-error path a real destination: currently `/auth/auth-code-error` and `/error` 404 — any change touching those flows SHOULD create the missing pages (tracked in `TASK.md`).
5. **MUST** handle promise rejections in async route handlers; a handler that can throw MUST return a typed error response (the webhook's 400 pattern) rather than crashing the function.
6. In forms, server-side validation errors return `{ message }` and render in the existing red helper-text slot; do not invent toast systems.

## 11. Logging

1. **MUST** use `console.log`/`console.error` only at meaningful boundaries (webhook receipts, provisioning steps, failures) — the current codebase's level of logging is the ceiling, not the floor to grow from.
2. **SHOULD** prefix server logs with a module tag (`[db-preflight]` pattern) for grep-ability.
3. **MUST NOT** log request bodies, auth tokens, cookies, or PII (see §9.4).
4. Structured logging/telemetry, if added, MUST be server-only and documented in `ARCHITECTURE.md` §8.

## 12. Performance

1. **MUST** keep the landing page statically rendered (ISR) — do not convert it to dynamic rendering or add per-request data fetching to it.
2. **MUST** use `next/image` for raster images with explicit `width`/`height` (CLS) and `priority` only for above-the-fold hero assets (existing pattern).
3. **MUST NOT** fetch data in client components when the data can be fetched in the RSC and passed as props (waterfall prevention).
4. **MUST** keep `prepare: false` on the postgres client (Supabase pooler requirement — removing it causes runtime failures).
5. **SHOULD** batch DB reads per page (the codebase does at most a few queries per render; keep it that way).
6. **SHOULD** prefer `revalidatePath` over full-page dynamic rendering when only specific data changes.
7. New LLM calls (assessment generation) MUST be async with user feedback (loading state), retry-safe, and never block unrelated page renders.

## 13. Generated files & design pipeline

1. `components/icons.tsx` is **auto-generated** by `scripts/figma-icons-gen.py` from `.media/images/*.svg`. **MUST NOT** hand-edit icon path data; regenerate instead.
2. `utils/db/migrations/**` is generated by drizzle-kit. **MUST** generate migrations via `npm run db:generate` after schema edits; never hand-write migration SQL unless mirroring an emergency hotfix that is then reconciled.
3. `.media/` (Figma bindings/manifest/cache) is tool-managed provenance — do not manually edit bindings.
4. `figma-tokens.json` is currently an empty stub; if real token export lands, `tailwind.config.ts` MUST be updated from it rather than ad-hoc.
5. Landing-page changes MUST trace to the Figma design (see `DESIGN.md` consistency rules); freehand visual changes to `app/page.tsx` are forbidden.

## 14. Documentation

1. **MUST** keep the six `/docs` files truthful to the codebase: any change that adds/removes routes, tables, env vars, scripts, dependencies, or design tokens MUST update the relevant sections of `ARCHITECTURE.md`, and `MEMORY.md`'s change log, in the same change.
2. **MUST** update `TASK.md` checkboxes as roadmap items complete (that file is the execution ledger).
3. **MUST** label anything not yet implemented as `[PLANNED]` in docs; never describe planned behavior in present tense.
4. Code comments: explain _why_ (constraint, Figma node, pooler limitation) like the existing comments do; don't narrate the obvious.
5. `README.md` still describes the generic starter kit — an agent MAY update it when onboarding/verification docs diverge, but MUST NOT delete its setup instructions.

## 15. Git practices

1. **Commit style (observed convention, MUST follow):** conventional commits with scopes — `feat(auth):`, `fix(build):`, `chore(deps):`, `fix(next16):`, `chore(lint):`, `fix(forms):`, `fix(db):`, `fix(env):`, `feat(ui):`. Subjects in lowercase imperative, focused on intent.
2. **MUST NOT** commit: `.env*` (except `.env.example`), `tsconfig.tsbuildinfo`, `dev-server.log`, `node_modules`, `.next`. Respect existing `.gitignore`; if a new artifact type appears, add it to `.gitignore` in the same commit rather than committing it.
3. **MUST NOT** stage unrelated files; stage intentionally (no blanket `git add -A` when unrelated changes exist in the worktree).
4. One logical change per commit; breaking config changes (framework upgrades, lint migrations) get their own commit (precedent: commits `3615e6b`, `97e89f1`).
5. **MUST NOT** force-push shared branches, rewrite history on `main`, or push without explicit instruction.
6. Merge commits/PR conventions: none established yet in this repo (direct commits to `main` so far); keep the conventional-commit subject convention regardless of merge method.

## 16. AI-generated code

1. **MUST** read `docs/` (`MEMORY.md` first) before changing anything; the repo docs are the entrypoint.
2. **MUST** verify claims against the repository before writing docs or code that describe current behavior — label uncertainty explicitly (`[PLANNED]`, "unverified", "assumed").
3. **MUST NOT** silently refactor working code outside the task's scope ("never modify, delete, rename, refactor, or regenerate existing application code" beyond the requested change).
4. **MUST NOT** invent features that only exist in marketing copy — the landing page's promises (assessments, verification) are **not** implemented; check `PRD.md` §5 statuses before describing or building.
5. **MUST** run the verification commands (§2.1, §7.1) after changes and report honest results, including failures.
6. **MUST** append a dated entry to `MEMORY.md`'s change log describing what was changed, decisions made, and anything left unfinished.
7. **MUST NOT** paste secrets, customer data, or `.env.local` contents into docs, code, commits, or logs.
8. When generating UI, **MUST** follow `DESIGN.md` tokens (colors/typography/spacing) — no new hex values or ad-hoc fonts.
9. When generating DB changes, **MUST** produce migrations via drizzle-kit and update `ARCHITECTURE.md` §5 in the same change.

## 17. Data integrity

1. **MUST** treat the database unique constraints as the authority (app-level pre-checks like the username check are advisory UX only).
2. **MUST** write multi-table mutations (e.g., future credential minting spanning attempts + credentials) transactionally (`db.transaction`) so no partial states persist.
3. **MUST** make every lifecycle event handler idempotent and complete: subscription `created`, `updated`, **and** `deleted` must all maintain a coherent `plan` value (currently broken — see `TASK.md`).
4. **MUST NOT** delete rows that other records depend on without a documented cascade/soft-delete strategy; for credentials, prefer revocation over deletion (immutability is the product promise).
5. **MUST** keep `users_table.id` exactly equal to the Supabase `auth.users.id` (the join key by convention).
6. **SHOULD** add `created_at`/`updated_at` timestamp columns to every new table (absent on `users_table` — do not retrofit without a migration, but do not repeat the omission).

## 18. Credential integrity (product-critical)

These rules protect the core product promise ("cryptographic hash", verifiable records) and override convenience:

1. **MUST** generate credential IDs server-side from a cryptographically random source (UUIDv4 or better); **MUST NOT** derive them from sequential counters or user input.
2. **MUST** compute credential integrity hashes server-side over a canonical serialization of the credential's fields, and re-verify them on the public verification page before displaying "valid".
3. **MUST NOT** allow any client-writable field to influence the credential's hash or score.
4. **MUST** make credentials immutable records: corrections create a superseding credential; revocation flips a status field; historical records are never edited in place.
5. **MUST** keep the pass/fail decision server-side and persisted with the attempt (who, when, score, item) so verification can cite evidence.
6. Any change to hashing/serialization MUST be documented in `ARCHITECTURE.md` and `MEMORY.md`, and old credentials must remain verifiable (versioned hash scheme, e.g., `sha256-v1:` prefix).

## 19. Explicitly forbidden practices

**Never do any of the following in this repository:**

1. ❌ Commit secrets/keys/`.env.local`, or hardcode URLs/keys that should be env vars.
2. ❌ Use the Supabase service-role key in app code.
3. ❌ Ship a webhook or callback handler that trusts unauthenticated payloads (status: currently violated by the Stripe webhook — this must be fixed, not copied as a pattern).
4. ❌ Client-side scoring, client-side progress authority, or client-side entitlement checks.
5. ❌ Store or render credentials/certificates as editable content; no admin "fix the score" paths without an audit trail.
6. ❌ Introduce jQuery-style DOM manipulation; no `dangerouslySetInnerHTML` for untrusted content (transcripts/LLM output must be rendered as escaped text or sanitized markdown).
7. ❌ Hand-edit generated files (icons, migrations, `.media/`).
8. ❌ Convert the landing page to dynamic rendering, or break its Figma contract.
9. ❌ Add UI libraries/CSS frameworks/Tailwind config values not derived from the Figma tokens without a `DESIGN.md` update.
10. ❌ `any`-typed public APIs; `@ts-ignore` without justification.
11. ❌ Tests or scripts that hit paid third-party APIs in CI or mutate shared/prod databases.
12. ❌ Scraping YouTube in violation of YouTube ToS (transcripts must come from permitted sources — `PRD.md` §12.2).
13. ❌ Logging PII or secrets.
14. ❌ Deploys/infrastructure changes without updating `ARCHITECTURE.md` §13.
15. ❌ Describing unimplemented features as existing in any user-facing copy or docs.

## 20. Rule verification checklist (run before declaring any task complete)

```bash
npm run lint            # zero errors
npx tsc --noEmit        # zero errors
npm run format:check    # clean (or run npm run format)
npm run build           # green: preflight + migrate + build
```

Plus, when applicable: new env vars listed in `ARCHITECTURE.md` §12.1 · schema changes migrated and documented · `TASK.md` checkboxes updated · `MEMORY.md` change log entry appended.
