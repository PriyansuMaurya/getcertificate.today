# AGENTS.md - Agent workflow for getcertificate.today

## 1. Skills and tools

Before starting a task, identify and load the most relevant available skills, tools, and MCPs; follow their instructions throughout execution and validation. Use only what is relevant to the task.

## 5. Agent rules

- Make the smallest correct change that fully solves the task.
- Avoid unrelated refactors, cleanup, new dependencies, or modifications.
- Preserve working functionality.
- Fix root causes, not symptoms.
- Reuse existing components and utilities instead of duplicating them: shadcn primitives in `components/ui/`, `cn()` from `lib/utils.ts`, Supabase clients from `utils/supabase/`, DB via `utils/db/db.ts`, Stripe via `utils/stripe/api.ts`.

## 7. Verification

Verify every change with the applicable checks - real `package.json` scripts:

```bash
npm run lint          # ESLint 9 flat config
npm run format:check  # Prettier (run `npm run format` to fix)
npm run typecheck     # tsc --noEmit
npm test              # Node's built-in test runner via tsx (test files are listed in package.json)
npm run build         # db-preflight && drizzle-kit migrate && next build - requires reachable DATABASE_URL
```

## 9. Definition of done

A task is complete only when:

1. Requested behaviour works fully.
2. Relevant edge cases are handled.
3. Existing functionality remains intact.
4. Applicable verification (§7) passes.
5. Unrelated changes are avoided.
6. Affected documentation (§8) is updated.

Continue implementing, testing, debugging, and iterating until genuinely complete. Do not stop at "mostly working".
