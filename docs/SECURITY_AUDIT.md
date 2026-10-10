# Security Audit - getcertificate.today

- **Date:** 2026-10-10
- **Scope:** Entire application repository (Next.js 16 App Router, Supabase Auth/Postgres, Drizzle ORM, Stripe, OpenAI + TranscriptAPI). Includes auth flows, admin console, API route handlers, server actions, database schema/RLS, and dependencies.
- **Method:** Static review of source + SQL schema, dependency audit (`npm audit`), secrets/git-history review, and manual threat modelling of each trust boundary. No live penetration testing and no authenticated dynamic testing were performed.
- **Outcome:** No critical or unauthenticated remotely-exploitable vulnerability was identified in the application code. 1 high, 2 medium, 5 low, and several informational findings are reported below, dominated by a framework dependency update and defence-in-depth hardening (security headers, rate limiting).

---

## 1. Executive summary

The application has an unusually mature security posture for its size: authorization is enforced server-side on every admin action and page, Stripe webhooks are signature-verified and fail closed, credentials are integrity-hashed with constant-time verification, watch progress is anti-forgery, and all untrusted database input is parameterized through Drizzle. No secrets are committed and no secret is exposed to the client.

The highest-value actions are:

1. **Upgrade `next`** - the installed 16.3.6 is inside the vulnerable range for several published advisories (SSRF in Image Optimization, SSG/ISR cache poisoning, metadata-route information disclosure). Fix is available.
2. **Add HTTP security headers** - the app currently sets none (no CSP, frame protection, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
3. **Add application-level rate limiting** on auth and cost-bearing endpoints (login, signup, forgot-password, username availability, referral resolution, assessment generation).

Severity counts (application, as found): **Critical 0, High 1, Medium 2, Low 5, Info 6.** See §7 for fixes applied on 2026-10-10.
Dependency advisories, as found: **Critical 0, High 6, Moderate 7, Low 1** (predominantly indirect/dev; the direct runtime hit is `next`). **After remediation: 9 remain (full tree) - 5 high, 4 moderate, all dev/build-time only; production-only runtime advisories are cleared** - the runtime `next` advisory is cleared. See §7.

---

## 2. System and attack surface

| Boundary       | Entry point(s)                                                                                               | Auth model                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Browser / RSC  | Next.js App Router pages (`app/**`)                                                                          | Supabase SSR cookie session; middleware `proxy.ts` → `utils/supabase/middleware.ts`       |
| Server actions | `app/**/actions.ts` (`'use server'`)                                                                         | Re-checks `supabase.auth.getUser()` in each action                                        |
| Route handlers | `app/auth/callback`, `app/auth/auth/confirm`, `app/auth/auth/logout`, `app/ref/[code]`, `app/webhook/stripe` | Per-route                                                                                 |
| Admin console  | `app/admin/**`                                                                                               | `requireAdmin()` (DB role check) in layout + every page/action                            |
| Database       | Postgres via Drizzle (`postgres` driver)                                                                     | App connects as table owner (`postgres`) → RLS bypassed for app; RLS protects direct/anon |
| Supabase RLS   | `sql/01_production_schema.sql`                                                                               | `authenticated` owner-scoped SELECT policies; writes remain server-authoritative          |
| Payments       | Stripe checkout + webhook                                                                                    | Webhook HMAC signature verification                                                       |
| Third-party    | OpenAI, TranscriptAPI                                                                                        | Server-only API keys                                                                      |

---

## 3. Findings

### High

#### H-1 - Outdated Next.js with published advisories (direct dependency) — **Fixed 2026-10-10**

- **Evidence:** Installed `next` is **16.3.6** (`node -p "require('next/package.json').version"`); `package.json` pins `"next": "^16.3.5"`. `npm audit --omit=dev` reports `next 16.0.0 - 16.3.7` as **high** severity with fix available.
- **Advisories in range:** SSRF in Image Optimization (`GHSA-cjq9-62q9-8jv4`), SSG/ISR cache poisoning (`GHSA-4jqv-mc3x-m676`, `GHSA-mcj8-r9mp-w47p`), App Router metadata image route information disclosure (`GHSA-f87g-xv8r-7p7x`), `use cache` Draft Mode content leak (`GHSA-3w37-wq28-93x7`), dev MCP endpoint info disclosure (`GHSA-39w2-rjm5-chcv`).
- **Impact:** The SSRF and cache-poisoning issues can affect production self-hosted/hosted deployments. The app does not appear to use `use cache` or `next/image` with remote/unsafe sources, which reduces exposure, but the patch should not be deferred.
- **Remediation:** `npm audit fix` (bumps `next` to ≥ 16.3.8) or set `"next": "^16.3.8"` and reinstall; re-run build/tests.

> Severity rationale: rated High because the SSRF advisory is remotely reachable in principle; it is placed first on the remediation list.

### Medium

#### M-1 - No HTTP security headers configured — **Fixed 2026-10-10**

- **Evidence:** `next.config.mjs` defines only `turbopack.root`; there is no `headers()` function, no `vercel.json`, and no root `middleware.ts` setting response headers (`grep -rn "headers()" app utils` returned nothing).
- **Impact:** Missing `Content-Security-Policy`, `X-Frame-Options` / `frame-ancestors` (clickjacking), `Strict-Transport-Security` (HSTS), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. Increases the impact of any future XSS and allows framing of the login/dashboard pages.
- **Remediation:** Add a `headers()` block in `next.config.mjs` (or a `vercel.json`) emitting at minimum `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Permissions-Policy`, and a conservative CSP (start report-only given GTM/analytics inline usage).

#### M-2 - No application-level rate limiting on auth / abuse-prone endpoints — **Mitigated (best-effort) 2026-10-10**

- **Evidence:** `app/auth/actions.ts` — `loginUser`, `signup`, `forgotPassword`, `resetPassword`, `checkUsernameAvailability` have no throttling. The code itself notes this: _"if it is ever abused, throttle at the proxy/edge rather than here"_ (`checkUsernameAvailability`). `app/ref/[code]/route.ts` performs a DB lookup per request with no limit.
- **Impact:** Credential stuffing / password spraying on `loginUser`, signup/email abuse via `forgotPassword`, username enumeration and DB load via `checkUsernameAvailability`, and referral-code probing. Supabase Auth applies some provider-side limits, but the app adds none.
- **Remediation:** Add edge/proxy rate limiting keyed by IP (and by email for login), e.g. Vercel/Cloudflare rate-limit rules or an Upstash Redis limiter, and return `429` with `Retry-After`. Prioritise `loginUser`, `forgotPassword`, and `checkUsernameAvailability`.

### Low

#### L-1 - Assessment generation is not quota-limited (cost abuse) — **Fixed 2026-10-10**

- **Evidence:** `app/learn/actions.ts` `startAssessment` triggers `getTranscript()` (TranscriptAPI) and `generateAssessment()` (OpenAI) before any credit/quota check. Quota (`hasCredentialQuotaRemaining`) is enforced only at credential mint time (`submitAssessment` / `mintFromAttempt`).
- **Impact:** An authenticated user can trigger unlimited paid upstream calls (LLM + transcript) without ever minting a certificate. Cost/DoS rather than data exposure. Transcript results are cached by video ID (`utils/transcripts.ts`), which limits the transcript side.
- **Remediation:** Rate-limit `startAssessment` per user (e.g. N generations/hour) or gate it behind the monthly allowance / a lighter per-user budget before calling upstream.

#### L-2 - Host-header trust in the OAuth callback redirect — **Fixed 2026-10-10**

- **Evidence:** `app/auth/callback/route.ts` builds the post-auth URL from `request.headers.get('x-forwarded-host')` when `NODE_ENV !== 'development'`.
- **Impact:** On infrastructure where `X-Forwarded-Host` is not stripped/overwritten by a trusted proxy, a crafted value could redirect a freshly authenticated user to an attacker-controlled host. Cookies are scoped to the app domain, so this is a phishing/redirect nuisance rather than session theft; the open-redirect `?next=` path is already neutralised by `safeNextPath` (`lib/safe-next.ts`).
- **Remediation:** Prefer `request.nextUrl.origin` / a configured allow-listed origin (`NEXT_PUBLIC_WEBSITE_URL`) over the forwarded header, or validate `x-forwarded-host` against an allow-list.

#### L-3 - `generateStripeBillingPortalLink` can throw on an unknown email — **Fixed 2026-10-10**

- **Evidence:** `utils/stripe/api.ts` — `const user = await db.select()...where(eq(usersTable.email, email)); ... customer: user[0].stripe_id`. If no row matches, `user[0]` is `undefined` and access throws.
- **Impact:** Robustness/error-handling, not a direct vulnerability; a 500 could surface on a bad input path.
- **Remediation:** Guard `user[0]` and return a typed error/redirect when the account is missing.

#### L-4 - Referral codes generated with `Math.random()` — **Fixed 2026-10-10**

- **Evidence:** `lib/referral-code.ts` `generateReferralCode()` uses `Math.random()`. The comment documents that codes are _deliberately not a secret_; uniqueness is enforced by the DB unique index and app-side probing.
- **Impact:** Predictability is acceptable given referrals are public and self-referral is blocked (`canAttributeReferral`, DB `referrals_no_self_referral`). Noted for completeness: a user could enumerate plausible codes and attribute a signup to a chosen referrer.
- **Remediation:** Optional - use `crypto.randomInt`/`randomBytes` for defense-in-depth so codes are non-guessable, at no UX cost.

#### L-5 - Non-null assertion on Stripe secret / weak config failure mode — **Deferred**

- **Evidence:** `utils/stripe/api.ts` — `new Stripe(process.env.STRIPE_SECRET_KEY!)`. `NEXT_PUBLIC_WEBSITE_URL` also falls back to `http://localhost:3000` in several modules.
- **Impact:** If `STRIPE_SECRET_KEY` is unset, construction fails later rather than at startup with a clear message. The `NEXT_PUBLIC_WEBSITE_URL` fallback could emit localhost URLs in misconfigured production.
- **Remediation:** Validate required env at startup (fail fast with a clear error) and avoid a localhost default for production-only paths.

### Informational

- **I-1 - Public certificate page discloses holder name, course title, score, and credential ID** to anyone with the link (`app/certificates/[id]/page.tsx`). This is by design (FR-E3); IDs are `randomUUID()` and therefore unguessable. The certificate _document_ and its OG image are correctly gated to holder/admin (`viewerMayViewCertificate` in `app/certificates/[id]/opengraph-image.tsx`).
- **I-2 - RLS is bypassed for the application.** The app connects as the table owner (`postgres`), which bypasses RLS by design (`sql/01_production_schema.sql` Section 6). RLS therefore protects direct/anon/authenticated PostgREST access only; the app's own safety relies on every query being user-scoped in code (which it is, consistently using `eq(table.user_id, user.id)`). No `FORCE ROW LEVEL SECURITY` is set. This is documented and intentional but means a coding slip in a query would not be caught by RLS.
- **I-3 - Public server action `checkUsernameAvailability`** enables username enumeration. The code acknowledges this as inherent to signup UX.
- **I-4 - Dev-only dependency advisories** (see §4): `drizzle-kit`/`esbuild` dev-server advisory, `eslint-config-next` → `fast-glob` → `braces`/`micromatch` ReDoS, `postcss-selector-parser` CPU exhaustion, `@esbuild-kit/*`. These are build/dev-time and not shipped to the runtime bundle.
- **I-5 - `dangerouslySetInnerHTML` usage is safe.** Two call sites in `app/layout.tsx`: a static inline `document.documentElement.classList.add('js')` string and the JSON-LD block, which escapes `<` (`JSON.stringify(JSON_LD).replace(/</g, '\\u003c')`).
- **I-6 - `/auth/*` is exempted from the auth redirect by a bare `startsWith`.** `utils/supabase/middleware.ts` exempts `/login`, `/auth`, `/signup`, `/forgot-password`, `/error` via `startsWith`, which is slightly broader than the exact/segment `PUBLIC_PREFIXES` matching used for `/verify`, `/certificates`, etc. Currently safe (only known routes exist), but `/auth-anything` would inherit public status - the same class of issue the segment matching was introduced to avoid.

---

## 4. Dependency audit (`npm audit`)

Full tree (includes dev): **14 vulnerabilities - 0 critical, 6 high, 7 moderate, 1 low.**
Production only (`--omit=dev`): **13 vulnerabilities - 7 high, 6 moderate** (the `next` advisories plus transitive postcss/brace chains pulled through the dependency graph).

| Package                                              | Severity | Direct?          | Advisory / note                                                                                                         | Fix                            |
| ---------------------------------------------------- | -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `next`                                               | high     | direct           | SSRF in Image Optimization, SSG/ISR cache poisoning, metadata route info disclosure, `use cache` leak, dev MCP endpoint | available (`npm audit fix`)    |
| `braces`                                             | high     | transitive       | stack-exhaustion DoS via nested patterns (`GHSA-vfj7-8cjw-p6xm`)                                                        | via `tailwindcss` major bump   |
| `micromatch`                                         | high     | transitive       | depends on vulnerable `braces`                                                                                          | via major bumps                |
| `fast-glob`                                          | high     | transitive       | depends on `micromatch`                                                                                                 | via `eslint-config-next` major |
| `@next/eslint-plugin-next`                           | high     | transitive       | via `fast-glob`                                                                                                         | via `eslint-config-next` major |
| `eslint-config-next`                                 | high     | direct (dev)     | via `@next/eslint-plugin-next`                                                                                          | major bump                     |
| `chokidar`                                           | high     | transitive       | via `braces`                                                                                                            | via `tailwindcss` major        |
| `drizzle-kit`                                        | moderate | direct (dev)     | via `@esbuild-kit/esm-loader`                                                                                           | major bump                     |
| `esbuild`                                            | moderate | transitive (dev) | dev-server request/read advisory (`GHSA-67mh-4wv8-2f99`)                                                                | via `drizzle-kit`              |
| `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader` | moderate | transitive       | via `esbuild`                                                                                                           | via `drizzle-kit`              |
| `postcss-nested`, `postcss-selector-parser`          | moderate | transitive       | CPU exhaustion in flat selector parsing (`GHSA-rj75-hqrm-r3gf`)                                                         | available / via `tailwindcss`  |

**Action:** `npm audit fix` resolves the runtime-relevant `next` finding and the postcss chain without breaking changes; the remaining highs require major upgrades (`eslint-config-next`, `tailwindcss`) and are dev/build-time only. Treat the `next` upgrade (M-1) as the priority. **Status: resolved per §7** (the `next` advisory is cleared; 9 dev-only advisories remain).

---

## 5. What is done well (verified controls)

- **Admin authorization is a single server-side choke point.** `app/admin/require-admin.ts` reads `role`/`suspended_at` from the DB on every call; non-admins get `notFound()` (404, not 403). Called from the admin layout **and** every admin page/action (`app/admin/*/actions.ts` all `await requireAdmin()`). Role is never taken from client input.
- **Stripe webhook is signature-verified and fails closed.** `app/webhook/stripe/route.ts` requires `STRIPE_WEBHOOK_SECRET` (500 if missing), rejects missing/invalid signatures with 400, never logs payloads, and performs idempotent plan updates.
- **Credential integrity.** `utils/credentials.ts` computes `sha256-v1` over a canonical serialization and compares with `timingSafeEqual`; invalid hashes render as "invalid" (`app/certificates/[id]/page.tsx`).
- **Open-redirect prevention.** `lib/safe-next.ts` restricts post-auth `?next=` to same-origin relative paths (rejects `//`, backslashes, absolute URLs, >512 chars).
- **Referral handling.** `app/ref/[code]/route.ts` validates against the DB and never reveals whether a code exists; cookie is `httpOnly`, `sameSite=lax`, `secure` in production (`lib/referral-cookie.ts`); self-referral blocked in app and DB.
- **SQL injection resistance.** All DB access goes through Drizzle parameterization; the only `sql` templates (`app/learn/actions.ts`, `utils/referrals.ts`) interpolate server-derived values. Admin search input is escaped for `ILIKE` metacharacters (`utils/db/like.ts`).
- **Anti-forgery watch progress.** `app/dashboard/actions.ts` reconciles client spans server-side with a wall-clock budget and row-level locking, so progress cannot be forged by a single payload.
- **Server-side validation everywhere.** Signup/onboarding/password/settings all re-validate on the server (lengths, regex, ranges, consent timestamps); the client is never trusted.
- **Plan purchase is allow-listed.** `app/subscribe/actions.ts` maps a client-supplied `planKey` through a fixed `PRICE_ENV` allow-list before touching `process.env`/Stripe.
- **CSRF is mitigated by default and was considered.** Mutating operations are Next.js Server Actions (built-in Origin/Host validation) or route handlers behind `sameSite=lax` session cookies; no hand-rolled cross-site state-changing GET exists. No dedicated CSRF token is used, which is consistent with the framework's protections.
- **Secrets hygiene.** No `.env` is tracked or present in git history (only `.env.example`); `.gitignore` ignores `.env*` except the example and ignores `*.pem`; no server-secret literals (`sk_live`, `service_role`, etc.) appear in app code; `.env.example` explicitly warns never to place secret keys in `NEXT_PUBLIC_*`. No secret is exposed to the browser.
- **Session/error hardening.** Malformed auth cookies are treated as signed-out (never a 500) in `utils/supabase/middleware.ts` and `require-admin.ts`; public route matching uses exact/segment matches so `/verify-internal` cannot inherit `/verify`.

---

## 6. Prioritized remediation checklist

> The checklist below is the as-found plan; see §7 for what has since been applied.

1. **Upgrade `next` to ≥ 16.3.8** (`npm audit fix`) and re-run `npm run build`, `typecheck`, `lint`, `test`. _(H-1)_
2. **Add security headers** via `next.config.mjs` `headers()` or `vercel.json` (M-1).
3. **Add rate limiting** on `loginUser`, `forgotPassword`, `signup`, `checkUsernameAvailability`, and `/ref/[code]` (M-2).
4. Rate-limit or budget **assessment generation** per user (L-1).
5. Replace **`x-forwarded-host`** with a configured/validated origin in the OAuth callback (L-2).
6. Guard **`generateStripeBillingPortalLink`** against a missing user row (L-3).
7. Optional: **crypto-random referral codes** (L-4); **fail-fast env validation** for Stripe/site URL (L-5).
8. Schedule the **dev-dependency major upgrades** (`tailwindcss`, `eslint-config-next`, `drizzle-kit`) (§4).

---

## 7. Remediation applied (2026-10-10)

Fixes were applied in a follow-up pass. Behaviour is preserved: the full production build succeeds, type check + lint pass, and all 144 unit tests pass; the built production CSS was confirmed to emit the custom palette and the drag/drop `animate-in` utilities.

| Finding                          | Status                      | What changed                                                                                                                                                                                                                                                              |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1 (outdated Next.js)           | **Fixed**                   | `next` upgraded 16.3.6 to 16.4.0 (`npm audit fix`), clearing the SSRF / cache-poisoning / info-disclosure advisories.                                                                                                                                                     |
| M-1 (no security headers)        | **Fixed**                   | `next.config.mjs` now sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and a conservative CSP (`frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`).                                  |
| M-2 (no rate limiting)           | **Mitigated (best-effort)** | New `lib/rate-limit.ts` (in-memory fixed-window) wired into `loginUser`, `signup`, `forgotPassword`, `resetPassword`, `checkUsernameAvailability`, `/ref/[code]`, and `startAssessment`. Per-instance only; edge/proxy limiting is still recommended for hard guarantees. |
| L-1 (unbudgeted generation)      | **Fixed**                   | `startAssessment` charges a per-user budget (20/hour) immediately before generation, after the reuse-existing-assessment redirect.                                                                                                                                        |
| L-2 (`x-forwarded-host` trust)   | **Fixed**                   | The OAuth callback only trusts `X-Forwarded-Host` when it matches `NEXT_PUBLIC_WEBSITE_URL`'s host, else uses the configured site origin.                                                                                                                                 |
| L-3 (billing-portal throw)       | **Fixed**                   | `generateStripeBillingPortalLink` now throws a clear error on a missing account row (all callers already catch it).                                                                                                                                                       |
| L-4 (predictable referral codes) | **Fixed**                   | `generateReferralCode` now uses `globalThis.crypto.getRandomValues`.                                                                                                                                                                                                      |
| L-5 (weak Stripe config failure) | **Deferred**                | Non-null assertion left as-is to avoid import-time failures; no security impact.                                                                                                                                                                                          |
| I-6 (`/auth/*` prefix)           | **Open (info)**             | Unchanged; no exploit path with the current routes.                                                                                                                                                                                                                       |

Dependency upgrades attempted:

- `next` to 16.4.0 and `tailwindcss` v3.4 to v4.3.3 (plus `@tailwindcss/postcss`). `postcss.config.mjs`, `app/globals.css` and `tailwind.config.ts` were migrated; `shadow-sm` to `shadow-xs` and `rounded-sm` to `rounded-xs` were remapped to preserve v3 visuals. This removed the `postcss-selector-parser` / `postcss-nested` advisory chain.
- `eslint-config-next` was already at 16.4.0, so the bump was a no-op.

Remaining `npm audit` results (9: 4 moderate, 5 high) are **development/build-time only** and ship no runtime code: `drizzle-kit` -> `@esbuild-kit/*` -> `esbuild` (dev server) and `eslint-config-next` -> `@next/eslint-plugin-next` -> `fast-glob` -> `micromatch` -> `braces` (lint tooling). No non-breaking upstream fix exists; the `next` runtime advisory is cleared.

---

## 8. Limitations

- This was a static review plus dependency/machinery checks. No authenticated end-to-end testing, no dynamic scanning (DAST), and no review of the production infrastructure (proxy header handling, WAF/rate limits, secrets manager, database network exposure) was performed.
- **Not reviewed and materially affecting M-2 and L-2:** the live Supabase project configuration (Auth Redirect-URL allow-list, JWT/session lifetime, provider rate limits, whether the DB port is publicly reachable) and the Stripe dashboard configuration (webhook endpoints, API key restrictions).
- Dependency findings reflect the audit database at the date above; re-run `npm audit` before each release.
- Severity ratings are the assessor's judgement based on static evidence and the documented intent in code comments; they are not CVSS-scored.
