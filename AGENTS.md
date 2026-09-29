# AGENTS.md — Agent workflow for getcertificate.today

Instructions for AI coding agents working in this repository. This file governs **how agents work**. It does not define the product, architecture, standards, or roadmap — those live in `/docs` and always take precedence there.

## 1. Documentation authority

| Document | Governs |
|---|---|
| `/docs/PRD.md` | Product requirements, feature statuses, acceptance criteria |
| `/docs/ARCHITECTURE.md` | System architecture, stack, data flows, integrations |
| `/docs/DESIGN.md` | Design system and visual specifications |
| `/docs/RULES.md` | Engineering standards and enforceable MUST/SHOULD rules |
| `/docs/TASK.md` | Planned work, phases, execution roadmap |
| `/docs/MEMORY.md` | Project context, decisions, history; read FIRST in every session |

`AGENTS.md` → agent workflow only. Never silently override conflicting documentation. If sources conflict, identify the conflict explicitly and resolve it using repository evidence plus the most domain-specific authoritative document (product behaviour → `PRD.md`; how something is built → `ARCHITECTURE.md`; how to write code → `RULES.md`). Record any resolved conflict in `/docs/MEMORY.md` §12.

## 2. Feature-reality check (mandatory before coding)

The landing page markets features that **do not exist yet**: the YouTube learning loop, AI assessments, certificates, QR codes, and public verification are copy, not code. No `/verify`, `/learn`, or `/certificates` routes exist; no YouTube, LLM, or QR dependencies are installed.

Before assuming any capability exists:

1. Check the `[EXISTS]` / `[PARTIAL]` / `[PLANNED]` / `[N/A YET]` status tags in `/docs/PRD.md` §5.
2. Check `/docs/TASK.md` for the phase that plans the work.
3. Verify in the repository itself (routes in `app/`, tables in `utils/db/schema.ts`, deps in `package.json`).

Never build against, describe, or test an unimplemented capability as if it existed.

## 3. Context efficiency

Inspect `/docs` and repository files only as needed:

- For each task, identify the relevant feature, route, component, service, schema, config, or dependency **first**; open only those files.
- Search specific symbols, paths, imports, and references (`code_search`/`glob`), not whole-tree reads.
- Follow dependencies and call chains only when relevant to the change.
- Read only the required `/docs` sections; do not reload established context each turn.
- Repository-wide analysis is reserved for genuinely architectural, migration, security, or cross-cutting tasks.

Minimize context, tokens, tool calls, and execution time without sacrificing correctness.

## 4. Skills and tools

Before starting a task, identify and load the most relevant available skills, tools, and MCPs; follow their instructions throughout execution and validation. Use only what is relevant to the task.

## 5. Agent rules

- Treat repository evidence and the relevant `/docs` documents as sources of truth. Never guess when evidence is available.
- Follow the existing architecture and conventions (see `ARCHITECTURE.md` §3–§4 for structure, `RULES.md` for standards).
- Make the smallest correct change that fully solves the task.
- Avoid unrelated refactors, cleanup, new dependencies, or modifications.
- Preserve working functionality.
- Fix root causes, not symptoms.
- Maintain strict typing (`tsconfig.json` `strict: true`) and code quality per `RULES.md` §2 and §5.
- Reuse existing components and utilities instead of duplicating them: shadcn primitives in `components/ui/`, `cn()` from `lib/utils.ts`, Supabase clients from `utils/supabase/`, DB via `utils/db/db.ts`, Stripe via `utils/stripe/api.ts`.
- Protect secrets, authentication, data, and security boundaries per `RULES.md` §9: server-only secrets, verified webhooks, server-authoritative scoring/progress, no service-role key.
- Handle loading, empty, success, validation, and error states for every surface you touch.
- Maintain accessibility (`RULES.md` §8), responsiveness (`DESIGN.md` §5), and performance (`RULES.md` §12).

## 6. Design implementation

For Figma or provided designs, treat the design as visual source of truth alongside `/docs/DESIGN.md`. Preserve typography, spacing, dimensions, colours, borders, shadows, radii, assets, states, interactions, and responsive behaviour. Compare implementation against the source and iterate until accurate. The landing page (`app/page.tsx`) implements Figma frame `6:9` (file `ifCw9JuE00PMiaOHgtBxRp`) 1:1 — see `DESIGN.md` §15 consistency rules; `components/icons.tsx` is generated (`scripts/figma-icons-gen.py`), never hand-edited.

## 7. Verification

Verify every change with the applicable checks — real `package.json` scripts:

```bash
npm run lint          # ESLint 9 flat config
npm run format:check  # Prettier (run `npm run format` to fix)
npx tsc --noEmit      # no "typecheck" script exists; run directly
npm run build         # db-preflight && drizzle-kit migrate && next build — requires reachable DATABASE_URL
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
