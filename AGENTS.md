# AGENTS.md - Agent workflow for getcertificate.today


## 1. Skills and tools

Before starting a task, identify and load the most relevant available skills, tools, and MCPs; follow their instructions throughout execution and validation. Use only what is relevant to the task.

## 5. Agent rules

- Make the smallest correct change that fully solves the task.
- Avoid unrelated refactors, cleanup, new dependencies, or modifications.
- Preserve working functionality.
- Fix root causes, not symptoms.
- Maintain strict typing (`tsconfig.json` `strict: true`) and code quality per `RULES.md` §2 and §5.
- Reuse existing components and utilities instead of duplicating them: shadcn primitives in `components/ui/`, `cn()` from `lib/utils.ts`, Supabase clients from `utils/supabase/`, DB via `utils/db/db.ts`, Stripe via `utils/stripe/api.ts`.
- Protect secrets, authentication, data, and security boundaries per `RULES.md` §9: server-only secrets, verified webhooks, server-authoritative scoring/progress, no service-role key.
- Handle loading, empty, success, validation, and error states for every surface you touch.
- Maintain accessibility (`RULES.md` §8), responsiveness (`DESIGN.md` §5), and performance (`RULES.md` §12).


## 7. Verification

Verify every change with the applicable checks - real `package.json` scripts:

```bash
npm run lint          # ESLint 9 flat config
npm run format:check  # Prettier (run `npm run format` to fix)
npx tsc --noEmit      # no "typecheck" script exists; run directly
npm run build         # db-preflight && drizzle-kit migrate && next build - requires reachable DATABASE_URL
```

- No test framework is installed. When one is added (Phase 0.6 in `TASK.md`), run it as part of verification.
- Runtime/visual checks: run `npm run dev` and exercise the affected flow; for UI changes, compare against the Figma frame or `DESIGN.md`.
- Never claim completion with relevant failures or stop at "mostly working." Debug, fix, retest, and iterate until correct.
- Workflow-specific gates: schema changes also need a generated migration (`npm run db:generate`) and an `ARCHITECTURE.md` §5 update; new env vars go in `.env.example` + `ARCHITECTURE.md` §12.1.

## 8. Documentation

Update `/docs` only when implementation materially changes documented facts, and update only affected documents: routes/tables/env/deps → `ARCHITECTURE.md`; completed roadmap items → `TASK.md` checkboxes; decisions/context → `MEMORY.md` (append to §12, never rewrite history). Never rewrite documentation merely to justify an implementation that violates requirements.

## 9. Definition of done

A task is complete only when:

1. Requested behaviour works fully.
2. Relevant edge cases are handled.
3. Existing functionality remains intact.
4. Applicable verification (§7) passes.
5. Unrelated changes are avoided.
6. Affected documentation (§8) is updated.

Continue implementing, testing, debugging, and iterating until genuinely complete. Do not stop at "mostly working".
