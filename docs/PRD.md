# PRD — getcertificate.today

| | |
|---|---|
| Document status | Living product source of truth |
| Last updated | 2026-09-28 |
| Evidence basis | Full repository audit (see `ARCHITECTURE.md`) plus the product definition embedded in `app/page.tsx`, `app/layout.tsx` metadata, and the Figma landing-page frame `6:9` (file `ifCw9JuE00PMiaOHgtBxRp`) |
| Related docs | `ARCHITECTURE.md` (how it is built), `RULES.md` (how we build), `DESIGN.md` (how it looks), `TASK.md` (what to build next), `MEMORY.md` (session handoff) |

## Legend used throughout this document

Every capability below is tagged with one of four implementation statuses. These tags are cross-checked against the repository and are consistent with `TASK.md` and `MEMORY.md`:

- **[EXISTS]** — implemented and verified in the current codebase.
- **[PARTIAL]** — a working foundation exists, but the capability is incomplete or has known defects (defects are listed and mirrored in `TASK.md`).
- **[PLANNED]** — only described in marketing copy, metadata, or the Figma design. No implementation exists. This is *intent*, not fact.
- **[N/A YET]** — implied by the product vision but not yet designed, decided, or scheduled.

---

## 1. Product vision

> **Describe a field of study. Watch educational videos on YouTube. Pass AI-generated assessments tailored to the content, and earn official shareable certificates. Learn Today. Go Further.**

getcertificate.today turns YouTube learning into **verifiable credentials**. A learner adds a YouTube video or playlist, completes the learning content in a tracked player, takes an AI-generated assessment based specifically on what they watched, and — after passing — earns a shareable digital credential containing their assessment score, a unique credential ID, a QR code, and a public verification page that anyone (especially employers) can use to confirm the credential is real.

The long-term bet, stated in the landing page's own copy: *"YouTube contains the world's finest educational library. We build the infrastructure to convert those video minutes into certified value recognized by employers worldwide."*

Tagline (exact, from `app/page.tsx` footer): **"Turning YouTube video minutes into verifiable professional credentials. Learn Today. Go Further."**

## 2. Problem statement

1. **Self-taught learning is invisible.** Millions of people learn job-relevant skills (Kubernetes, React, DevOps…) from YouTube, but the resulting knowledge appears nowhere on a résumé because it produced no credential. The landing testimonial states it directly: *"I learned Kubernetes entirely through YouTube, but recruiters needed proof."*
2. **Course certificates don't prove what you actually watched.** Platforms like Coursera certify their own catalog; they cannot certify arbitrary YouTube learning.
3. **Watch-time ≠ competence.** Clicking play on a playlist proves attendance, not understanding. Verification needs an assessment tied to the exact content consumed.
4. **Employers cannot trust self-reported skills.** A verifiable artifact — score, unique ID, tamper-evident record, QR code, public verification URL — closes the trust gap between "I watched it" and "I know it."

## 3. Target audience

### Primary personas

**P1 — The self-directed learner (primary revenue source).**
Self-taught developer / DevOps / designer who already learns from YouTube playlists and tutorials. Needs portable, shareable proof of skill for job applications, LinkedIn, and internal promotion cases. Willing to pay ~$12/month (the "Professional" tier price shown on the landing page) for unlimited credentials. This persona is the audience for every core journey in section 6.

**P2 — The verifier (employer / recruiter / team lead).**
Receives a credential link or QR code scan. Does **not** have an account and must never be forced to create one. Needs a fast, trustworthy, read-only answer: is this credential real, whose is it, what did they learn, what did they score? Served by the public verification page **[PLANNED]**.

**P3 — The team lead / training coordinator (secondary, future).**
Uses the platform to assign YouTube course material to a team and track who is certified on what ("Our team uses it to track internal developer training" — landing testimonial). No functionality for this persona exists or is scheduled; treat as **[N/A YET]** and see §12 (exclusions).

### Anti-personas / non-goals (see also §12)

- People seeking accredited, government- or university-recognized qualifications. The product's value is *verifiability*, not *accreditation*.
- Learners who want to skip content: the product's core mechanic deliberately gates assessment behind completion progress.

## 4. Value proposition

| For | Value |
|---|---|
| Learners | Turn time already spent on YouTube into a résumé-grade, shareable credential with a score and QR-verifiable proof. |
| Verifiers | One scan/link to confirm a candidate actually learned a specific body of content, backed by an assessment score — no account needed. |
| Content creators | Indirect: their videos become certifiable course material (the copy promises "non-cheatable questions specific to the creator's syllabus"). No creator-side features are planned or built. |

Differentiators (as claimed in landing copy — note claims are marketing, not implemented features):
- Assessments generated *from the video transcripts* of the exact content consumed **[PLANNED]**.
- Engagement-gated assessment unlocking (80% watch progress) **[PLANNED]**.
- Every certificate carries "a cryptographic hash and quick-verify QR code" **[PLANNED]**.

## 5. Implemented capabilities today (repository-audited)

The application currently consists of a **marketing landing page plus a complete account/billing chassis**. Concretely:

| Capability | Status | Evidence |
|---|---|---|
| Figma-faithful responsive marketing landing page (hero, how-it-works, features, testimonials, pricing, CTA, footer) | **[EXISTS]** | `app/page.tsx`, `components/MobileNav.tsx`, `components/icons.tsx`, `public/figma/*` |
| Email + password signup / login / logout | **[EXISTS]** | `app/auth/actions.ts` (`signup`, `loginUser`, `logout`), `app/login`, `app/signup` |
| Google + GitHub OAuth sign-in | **[EXISTS]** | `signInWithGoogle`, `signInWithGithub` in `app/auth/actions.ts` (requires provider env vars) |
| Email confirmation, forgot/reset password flows | **[EXISTS]** | `forgotPassword`, `resetPassword` actions; `app/forgot-password/**`; `app/auth/auth/confirm/route.ts` |
| Auth callback that provisions DB + Stripe customer for new users | **[EXISTS]** | `app/auth/callback/route.ts` |
| Mandatory profile onboarding before dashboard (username, first/last name, DOB with 13+ age check) | **[EXISTS]** | `app/onboarding/page.tsx`, `components/OnboardingForm.tsx`, `completeOnboarding` in `app/auth/actions.ts` |
| Protected `/dashboard` with personalized greeting and voluntary upgrade card | **[EXISTS]** | `app/dashboard/layout.tsx`, `app/dashboard/page.tsx` |
| Route protection via middleware (proxy) incl. redirect `/ → /dashboard` for logged-in users | **[EXISTS]** | `proxy.ts`, `utils/supabase/middleware.ts` |
| Stripe subscription billing: pricing table, customer portal, webhook storing subscription ID as `plan` | **[EXISTS but PARTIAL]** | `utils/stripe/api.ts`, `app/subscribe/**`, `app/webhook/stripe/route.ts` — the webhook is unverified and has a fall-through bug; see §8 and `TASK.md` |
| Free-tier posture: subscribing is optional; dashboard shows an *optional* upgrade card | **[EXISTS]** | `app/dashboard/page.tsx` (`isSubscribed` logic), commit `a1bd15d` |
| Add a YouTube video/playlist, track watch progress, enforce 80% completion gate | **[MISSING → PLANNED]** | No YouTube integration code exists anywhere in the repo |
| Transcript parsing and AI assessment generation | **[MISSING → PLANNED]** | No LLM/AI dependency, API route, or prompt code exists |
| Assessment taking UI, scoring, pass/fail flow | **[MISSING → PLANNED]** | No assessment routes, components, or tables exist |
| Credential minting: score, unique credential ID, cryptographic hash, certificate | **[MISSING → PLANNED]** | No credential tables, generation code, or UI exists |
| QR code generation | **[MISSING → PLANNED]** | No QR dependency or code exists |
| Public verification page (no-auth read-only) | **[MISSING → PLANNED]** | No `/verify` route or equivalent exists |
| PDF export / LinkedIn share | **[MISSING → PLANNED]** | Pro-tier feature only in pricing copy |
| Chrome extension integration | **[MISSING → PLANNED]** | Free-tier feature only in pricing copy |
| Plan-based feature gating (1 cert/month free vs unlimited Pro) | **[MISSING → PLANNED]** | Pricing copy exists; no entitlement/quota logic exists; Stripe products configured by `stripeSetup.ts` are still generic starter plans (see FR-B7 and §14.6) |
| Progress tracking data model, watch history | **[MISSING → PLANNED]** | Only `users_table` exists in the schema |

### What the current app *is* (honest framing)

Today the deployed capability set is: **convince → sign up → onboard → optionally pay**. The product promise in the hero is visible to visitors, but the "paste a YouTube link" step has no corresponding product surface yet. This framing must be preserved in all future AI sessions: do not describe assessments, certificates, or verification as existing features.

## 6. User journeys

### 6.1 Journey A — First-time learner (implemented today) [EXISTS]

1. Visitor lands on `/` (static, ISR-revalidated hourly) and reads hero → how-it-works → features → testimonials → pricing.
2. Visitor clicks **Get Started Free** → `/signup`, submits name/email/password. Server action `signup`:
   - rejects an email already present in `users_table` **[EXISTS]**;
   - creates the Supabase auth user **[EXISTS]**;
   - creates a Stripe customer and inserts a `users_table` row with `plan='none'` **[EXISTS]**;
   - redirects to `/onboarding` **[EXISTS]**.
   - *Known friction:* in production, Supabase requires email confirmation before `auth/callback` runs; the DB row is only provisioned on callback or first password login, and OAuth users skip `signup` entirely (provisioning happens in the callback instead). See `ARCHITECTURE.md` §6.5 and `TASK.md` Phase 1.3.
3. User completes onboarding (username regex `[a-z0-9_]{3,20}`, names, DOB ≥ 13 years) → redirected to `/dashboard` **[EXISTS]**.
4. Dashboard greets by name; if `plan='none'`, shows a *voluntary* "Upgrade your plan" card linking to `/subscribe` **[EXISTS]**.
5. **From here the intended core loop is missing:** the user should add a YouTube video/playlist and begin learning, but no such surface exists **[PLANNED]**.

### 6.2 Journey B — Learn → assess → certify (the core product loop) [PLANNED]

> This journey is assembled from the landing page's own copy (steps 01–03, feature cards, pricing feature lists). It is the canonical target state; every step below is **unimplemented** and detailed as requirements in §7.

1. Learner pastes a YouTube video or playlist URL ("Paste YouTube Link").
2. Learner watches in a "customized split-screen player"; the system tracks viewing progress and unlocks the assessment at ≥ 80% completion ("Watch & Learn", "Engagement Milestones").
3. Learner takes an AI-generated assessment "tailored to the content" ("Pass AI Assessment & Earn").
4. On passing, the system "mints" a credential containing the assessment score, a unique credential ID, a cryptographic hash, and a QR code.
5. Learner shares the credential link on LinkedIn / résumé; Pro users can export PDF ("PDF/LinkedIn resume generator export").

### 6.3 Journey C — Verification (verifier persona) [PLANNED]

1. Employer receives a credential URL or scans the QR code.
2. Public, no-auth page loads showing: holder identity, field of study / content source, assessment score, issue date, credential ID, and validity.
3. Verifier trusts it because the record is tamper-evident ("cryptographic hash") and served from the authoritative domain.

> **Design gap to resolve later [N/A YET]:** whether verification shows PII (full name) and how revocation is communicated. Not decided anywhere in the repo; see `MEMORY.md` unresolved questions.

## 7. Functional requirements

### 7.1 Identity & accounts [EXISTS unless noted]

- **FR-A1.** Users can sign up with email + password; duplicate emails are rejected before Supabase is called. *(Implemented — `signup`.)*
- **FR-A2.** Users can sign in with Google and GitHub OAuth. *(Implemented, gated on provider env vars — `ProviderSigninBlock`.)*
- **FR-A3.** Users can request a password reset and set a new password via emailed code. *(Implemented — `forgotPassword`, `resetPassword`.)*
- **FR-A4.** Users can log out from the dashboard dropdown. *(Implemented — `logout` via form action.)*
- **FR-A5.** Every user must complete onboarding (unique username matching `[a-z0-9_]{3,20}`, first name, last name, DOB with age ≥ 13) before accessing `/dashboard`; logged-in users who skipped onboarding are redirected there from `/`, `/dashboard`, and `/onboarding` itself once complete. *(Implemented — `hasCompletedOnboarding` + redirects.)*
- **FR-A6.** Unauthenticated visitors can access only `/`, `/login`, `/signup`, `/auth/**`, `/forgot-password/**`, and webhook routes; everything else redirects to `/login`. *(Implemented — `utils/supabase/middleware.ts`.)*
- **FR-A7.** A session cookie is refreshed transparently on every matched request. *(Implemented — `updateSession`.)*
- **FR-A8. [PLANNED]** Account deletion / data export (implied by credential-platform privacy posture; not designed).

### 7.2 Billing & plans [PARTIAL]

- **FR-B1.** A Stripe customer is provisioned for every user at signup or first OAuth callback. *(Implemented.)*
- **FR-B2.** Users can view a Stripe-embedded pricing table and start a checkout Customer Session from `/subscribe`. *(Implemented.)*
- **FR-B3.** Users can open the Stripe billing portal from the dashboard dropdown. *(Implemented — degrades to `#` if Stripe errors.)*
- **FR-B4.** The `customer.subscription.*` webhook writes the subscription ID into `users_table.plan`. *(Implemented but **insecure and buggy** — see `ARCHITECTURE.md` §8.2; treating B4 as not-production-ready.)*
- **FR-B5.** Subscribing is optional; a non-subscriber sees a voluntary upgrade card. *(Implemented.)*
- **FR-B6. [PLANNED]** Entitlement enforcement: Free = 1 credential/month; Pro = unlimited, plus deep-syllabus assessments, PDF export. No quota or entitlement code exists.
- **FR-B7. [PLANNED]** Plan products must reflect actual tiers (Free Explorer / Professional $12/mo). Today `stripeSetup.ts` seeds unrelated starter plans (Basic $10 / Pro $20 / Enterprise $50). Mismatch documented in `TASK.md`.

### 7.3 Learning content (core loop) [PLANNED — not started]

> Acceptance criteria here define the *first implementable MVP slice* of each requirement; they are intentionally minimal so an AI agent can build them sequentially (execution order lives in `TASK.md`).

- **FR-C1. Add learning source.** User can paste a YouTube **video** URL on a dashboard form; the system validates the URL, extracts the video ID, and persists a learning item linked to the user.
  - *AC1:* `https://www.youtube.com/watch?v=<id>` and `https://youtu.be/<id>` are accepted; other URLs show a friendly inline error.
  - *AC2:* Duplicate sources for the same user are rejected with a clear message.
  - *AC3:* Item appears on the dashboard immediately after creation.
- **FR-C2. Playlist support.** Same as FR-C1 for playlist URLs (`list=` parameter), listing child videos as one trackable unit.
  - *AC1:* Playlist URL with `list=` accepted; non-list URLs rejected.
  - *AC2:* Item shows aggregate progress across child videos.
- **FR-C3. Embedded player.** Learning item detail page embeds a YouTube player (iframe or YouTube IFrame API) so users can watch from inside the app.
  - *AC1:* Player plays the selected video on the item page.
  - *AC2:* Player is keyboard-reachable and labeled for screen readers.
- **FR-C4. Progress tracking.** The system records how much of the content the user has watched.
  - *AC1:* Progress percentage is persisted per user per item.
  - *AC2:* Progress survives page reloads and new sessions.
  - *AC3:* Progress is visible on the dashboard ("80% complete").
- **FR-C5. Completion gate.** Assessment becomes available only at ≥ 80% progress (the number stated in landing copy).
  - *AC1:* Below 80%, the "Take assessment" action is disabled with an explanatory tooltip/text.
  - *AC2:* At ≥ 80%, assessment becomes reachable.
  - *AC3:* The gate is enforced server-side, not only in UI.
- **FR-C6. [N/A YET]** Anti-cheat protections around progress (e.g., preventing API-level progress forgery) — design decision pending; interactions with YouTube ToS must be reviewed before any scraping approach is chosen.

### 7.4 Assessment (core loop) [PLANNED — not started]

- **FR-D1. Transcript acquisition.** For each learning item the system obtains the content's transcript(s) to ground question generation. (Mechanism undecided: captions API vs. third-party service vs. LLM with URL context — see `MEMORY.md` open questions.)
- **FR-D2. Assessment generation.** On first unlock, the system generates a multiple-choice assessment from the transcript using an LLM, tied to "the creator's syllabus."
  - *AC1:* Assessment has a fixed, documented question count (recommend 10 for MVP).
  - *AC2:* Each question has exactly one correct answer and 3 distractors; questions reference only content present in the transcript.
  - *AC3:* Generation is idempotent per item+user attempt policy (regeneration rules decided before build).
  - *AC4:* LLM failure yields a clear user-facing error and does not create a partial assessment record.
- **FR-D3. Assessment taking.** User answers questions in a dedicated UI with progress indication.
  - *AC1:* All questions must be answered before submission; unanswered submits are blocked client- and server-side.
  - *AC2:* Submission is server-scored; the client never receives correct answers before submission.
- **FR-D4. Scoring & attempts.** Score = % correct, persisted per attempt.
  - *AC1:* Pass threshold is 70% (proposed; confirm before build — landing copy says "pass" without a number).
  - *AC2:* Failed attempts may be retried; the number of allowed attempts is a product decision to make before implementing (proposal: 3 per item, then 7-day cooldown).
- **FR-D5.** Results feed directly into credential minting (FR-E1) — the credential's score field is the passing attempt's score.

### 7.5 Credentials & certificates (core loop) [PLANNED — not started]

- **FR-E1. Minting.** On passing, the system creates an immutable credential record containing: user identity, learning item identity, assessment score, pass date, and a **unique credential ID**.
  - *AC1:* Credential ID is globally unique, URL-safe, and non-sequential (e.g., UUIDv4 or prefixed random).
  - *AC2:* Minting is transactional with the scoring write (no pass without a credential record).
  - *AC3:* Minting respects plan quota (FR-B6) once entitlements exist.
- **FR-E2. Cryptographic integrity.** Each credential stores a content hash (e.g., SHA-256 over canonical credential fields) so later tampering is detectable.
  - *AC1:* Hash is recomputable server-side from stored fields.
  - *AC2:* Verification page recomputes and compares the hash; mismatch → "invalid" state.
- **FR-E3. Certificate presentation.** A shareable certificate view (HTML-first for MVP) renders the holder name, score, credential ID, issue date, and content title.
  - *AC1:* Reachable at a stable URL by credential ID.
  - *AC2:* Printable (browser print → PDF) for MVP; dedicated PDF export deferred (Pro feature).
- **FR-E4. QR code.** Each credential exposes a QR code encoding its verification URL.
  - *AC1:* Scanning the QR opens the verification page (FR-F1) for that credential.
  - *AC2:* QR is rendered as accessible SVG/image with a text alternative of the encoded URL.
- **FR-E5. Revocation.** Credentials can be revoked (by user or admin); revoked credentials display a clear revoked state on the verification page.
  - *AC1:* Revoked credential's QR/link still resolves but shows "REVOKED" prominently.
- **FR-E6. [N/A YET]** LinkedIn share deep-link and OpenGraph card images for credential URLs.

### 7.6 Verification (verifier persona) [PLANNED — not started]

- **FR-F1. Public verification page.** `/verify/<credentialId>` (route name TBD at build time; see `MEMORY.md`) is publicly accessible without login, middleware-exempt, and shows: holder name, learning item title + source, score, pass date, credential ID, and validity (valid / revoked / invalid hash).
  - *AC1:* Unauthenticated fetch returns 200 with the credential data.
  - *AC2:* Nonexistent ID → clear "not found" state (no stack traces, no user enumeration beyond the ID).
  - *AC3:* Page never reveals assessor/question data beyond what verification requires.
- **FR-F2.** The verification page links to the certificate view and back to the product home page.

### 7.7 Landing, marketing & legal [EXISTS unless noted]

- **FR-G1.** Landing page communicates the three-step process, features, testimonials, pricing tiers, and CTA. *(Implemented, Figma-faithful.)*
- **FR-G2.** Mobile navigation disclosure works below `lg` breakpoint. *(Implemented — `MobileNav`.)*
- **FR-G3.** Footer links exist as placeholders (`href="#"`). *(Implemented; real destinations are outstanding work — `TASK.md`.)*
- **FR-G4. [PARTIAL]** Legal pages (Privacy, Terms) — **required** for a platform storing DOB and issuing credentials, but no pages exist. Only referenced as "Legal" footer column labels.

## 8. Non-functional requirements

- **NFR-1. Security & trust (highest priority for this product).** Credential verification is the product's core promise, so every trust surface must be technically sound: signature/secret-verified Stripe webhooks, tamper-evident credential hashes, no client-trusted scoring, no client-trusted progress writes. Current state fails the Stripe part (see `ARCHITECTURE.md` §8.2).
- **NFR-2. Privacy & data protection.** The app stores DOB and full names (onboarding) and will store learning/assessment history. Requirements: privacy policy and terms pages before public launch; minimal PII exposure on public verification pages; no PII in logs. Age gate (13+) already implemented.
- **NFR-3. Accessibility.** Target WCAG 2.1 AA for all new surfaces (baseline largely present on landing page: semantic landmarks, `aria-expanded` nav, focus-visible rings via shadcn primitives; Radix dropdown for dashboard menus). Verification and assessment pages must be keyboard-complete and screen-reader navigable.
- **NFR-4. Performance.** Landing page is statically rendered with ISR (`revalidate = 3600`) and priority-loads hero assets. New dynamic surfaces should keep server-rendered data fetching, avoid client-side waterfalls, and hold interactive flows (assessment) to < 2s first contentful paint on mid-range mobile.
- **NFR-5. Reliability.** External integrations (Stripe, Supabase, future LLM) must degrade gracefully: pattern already set by the billing-portal `try/catch` fallback. Webhook handlers must be idempotent.
- **NFR-6. Observability.** Currently `console.log/error` only; acceptable for MVP but structured logging and error tracking (e.g., Sentry) should arrive before public credential issuance.
- **NFR-7. Platform support.** Responsive from mobile (360px-class devices) through desktop 1440px+ (Figma design width); mobile nav below `lg`.
- **NFR-8. Browser support.** Modern evergreen browsers (Next.js 16 baseline); no legacy IE/Safari<15 commitments documented anywhere — treat as evergreen-only.
- **NFR-9. Compliance posture.** COPPA-relevant (13+ age gate exists); GDPR/CCPA obligations implied by PII storage — legal pages + data-deletion path are launch blockers (see §7.7, `TASK.md`).

## 9. Constraints

1. **Single-repo, single-app architecture.** Everything (marketing, app, verification) ships from one Next.js codebase; no microservices.
2. **Supabase auth is the identity provider.** `users_table` mirrors auth users; no separate identity system will be introduced.
3. **Postgres via Drizzle ORM.** Direct SQL only through Drizzle; migrations via drizzle-kit (see §10).
4. **Vercel deployment model.** Build = preflight → migrate → `next build`; env vars from Vercel project settings. (Inference from README deployment section + `scripts/db-preflight.mjs` wording; no `vercel.json` exists, so this is high-confidence but not stamped in config.)
5. **Stripe is the only payment provider.**
6. **Landing page is Figma-bound.** `app/page.tsx` is a 1:1 implementation of Figma frame `6:9` with per-section comments citing Figma geometry; visual changes must trace to the design, not freehand edits (see `DESIGN.md`).
7. **No test framework currently installed.** Testing capability must be added as part of roadmap work (`TASK.md`), not assumed.
8. **Windows-first developer environment.** `next.config.mjs` pins the Turbopack root for a Windows path issue; scripts must stay cross-platform (npm scripts only, no shell-isms).
9. **Node 20.18.1** (`.nvmrc`) and **npm** (package-lock.json present, no lockfiles for other managers).

## 10. MVP boundary (definition of "certification MVP")

The MVP is the **smallest end-to-end path from "I watched it" to "an employer can verify it"**. Everything else is post-MVP even if marketing copy mentions it.

**In MVP:**
1. Email/password + OAuth accounts, onboarding *(already built)*.
2. Add a YouTube **video** (playlist support can land in MVP-2 but is not required for first end-to-end proof).
3. Embedded player with server-validated progress tracking and the 80% gate.
4. Transcript-grounded LLM assessment (10 MCQs) with server-side scoring, ≥ 70% pass, limited attempts.
5. Credential minting with unique ID + SHA-256 integrity hash.
6. Public verification page + QR code encoding its URL.
7. Plan gating for Free (1 credential/month) vs Pro (unlimited) — requires fixing Stripe webhook security first.
8. Legal pages (privacy/terms) — plus the marketing-copy reality check in Phase 4.4 of `TASK.md` (the "cryptographic hash / QR" claims become true there).

**Explicitly out of MVP** (post-MVP scope): PDF export, LinkedIn résumé generator, Chrome extension, team/org training features, creator-facing analytics, mobile apps, localization beyond English, anti-cheat hardening beyond server-side validation.

## 11. Success criteria

**Product metrics (proposed — no analytics exist yet, instrumentation is itself roadmap work):**
1. **Time-to-first-credential:** median < 7 days from signup for active learners.
2. **Assessment completion rate:** ≥ 60% of unlocked assessments are submitted.
3. **First-attempt pass rate:** 50–80% (below 50% → assessments too hard; above 80% → too easy).
4. **Verification actions:** ≥ 20% of minted credentials get ≥ 1 external verification visit (proof verifiers are real).
5. **Free → Pro conversion:** ≥ 3% of monthly-active free users within 60 days.
6. **Trust quality:** 0 credential-integrity incidents; 100% of verification page loads resolve a correct valid/revoked state.

**Engineering quality gates (measurable now, enforced via `TASK.md`):**
- `npm run lint` and `npx tsc --noEmit` pass with zero errors.
- `npm run build` succeeds (preflight + migrate + build).
- Every new core-loop feature ships with tests (framework added in Phase 0 of `TASK.md`).
- Stripe webhook verification lands before any production credential issuance.

## 12. Exclusions (explicit non-goals)

The following are **not** being built, despite appearing in marketing copy or being conceivable:

1. **Accreditation or formal recognition.** Credentials attest to assessed competence on specific content; they are not degrees or certifications from accredited bodies. Compliance-sensitive wording should eventually be reviewed by legal.
2. **Copyright / content hosting.** The platform will not copy, host, or re-serve YouTube content; it links/embeds and assesses. Any mechanism that conflicts with YouTube ToS (e.g., transcript scraping in violation of ToS) must be rejected during design.
3. **Team/organization workspaces, LMS integrations, creator dashboards.** Testimonial copy hints at team training; nothing is designed or scheduled.
4. **Chrome extension.** Mentioned in free-tier feature list only; no design exists.
5. **Marketplace / payments to content creators.** No creator revenue model anywhere in the product.
6. **Mobile native apps.**
7. **Real-time proctoring / webcam anti-cheating.** "Non-cheatable" in copy means *content-grounded questions*, not surveillance.
8. **Multi-language content or UI localization** beyond English.

## 13. Realistic future scope (post-MVP, in rough priority order)

1. **Playlists & courses** — multi-video learning tracks with per-chapter progress (FR-C2).
2. **PDF certificate export & LinkedIn résumé generator** (Pro tier promise).
3. **Chrome extension** — save/learn from any page, not just YouTube (free-tier promise).
4. **Credential signing upgrade** — HMAC/asymmetric signatures instead of plain hashes; W3C Verifiable Credentials data model as an exchange format.
5. **Public profiles** — `/u/<username>` pages listing a user's public credentials (username uniqueness groundwork already exists).
6. **Org/team plans** — seat management, assigned learning, team scoreboards (P3 persona).
7. **Analytics & telemetry** — privacy-conscious product analytics for the §11 metrics; error tracking.
8. **Assessment quality tooling** — question review UI, difficulty calibration, question pools to reduce repeat-exposure cheating.
9. **Emails** — transactional templates (welcome, credential earned, verification reminders) beyond Supabase's built-in auth emails.
10. **Internationalization.**

## 14. Open product decisions (must be resolved before related build)

| # | Decision | Affects | Proposed default |
|---|---|---|---|
| 1 | Pass score (70%?) and attempt policy | FR-D4 | 70%, 3 attempts, 7-day cooldown |
| 2 | Transcript acquisition method (YouTube captions vs. third-party vs. LLM URL context) | FR-D1, §12.2 ToS constraint | Prefer official/ToS-compliant source; decide in a spike |
| 3 | LLM provider & prompt ownership | FR-D2 | Single provider behind a thin internal interface so it can be swapped |
| 4 | Verification route name & public data set | FR-F1 | `/verify/<id>`, holder name + item title + score + date + ID + status |
| 5 | Quota reset semantics ("1 credential/month" — rolling vs calendar) | FR-B6 | Calendar month, UTC |
| 6 | Real Stripe product/price IDs matching Free/Pro tiers | FR-B7 | Replace `stripeSetup.ts` plan array with the two real tiers |
| 7 | Whether watch-progress writes need abuse limits (rate limiting) | FR-C4/C6 | Add simple per-user rate limit on progress writes |

These decisions are mirrored in `MEMORY.md` (unresolved questions) so future sessions inherit them without re-deriving.
