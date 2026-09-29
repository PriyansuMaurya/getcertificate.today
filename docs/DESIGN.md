# DESIGN — Design system of record for getcertificate.today

| | |
|---|---|
| Document status | Extracted system of record — **describes what exists; do not invent replacements** |
| Last updated | 2026-09-28 |
| Sources | Figma file `ifCw9JuE00PMiaOHgtBxRp`, landing-page frame `6:9` (1440×4477) — audit trail in `.media/` (`figma-bindings.jsonl`, `manifest.jsonl`, `figma-cache/`); implementation in `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `components/icons.tsx` |
| Related docs | `RULES.md` (§13 generated files, §16.8), `ARCHITECTURE.md` §8.3, `PRD.md` |

**Two coexisting visual systems — read this first.** The repository carries (1) the **Figma brand system** (cream/ink/sand palette, Fraunces + Manrope) implemented on the **landing page** as custom Tailwind color tokens, and (2) the **shadcn/ui default system** (slate HSL variables; the dashboard shell additionally loads Inter) used by all **authenticated surfaces** (login, signup, onboarding, dashboard, subscribe). Both are real and documented below. Do not "unify" them without an explicit design decision; do use Figma tokens for any new marketing-facing surface and the shadcn system for authenticated app surfaces until that decision is made.

---

## 1. Visual principles (as evidenced in the implementation)

1. **Editorial warmth, not SaaS neon.** Warm paper tones (`cream`/`paper`), near-black `ink` text, muted `sand` accents — a print-like feel matching the "credential" metaphor.
2. **Serif display + humanist body.** Fraunces (a display serif) carries headings and prices; Manrope carries everything else.
3. **Flat with hairlines.** Sections are separated by background alternation (cream ↔ paper) and 1px `sandline` borders; shadows are extremely soft (5–8% opacity clay tint) and reserved for hero image and Pro card.
4. **Restrained motion.** Only two animations exist (accordion keyframes, unused in markup) plus Tailwind animate utilities in shadcn components; no scroll effects, no parallax.
5. **Figma is the contract.** `app/page.tsx` implements frame `6:9` 1:1 — section comments cite Figma padding/gap/radii, icons are byte-exact generated SVGs, and copy strings match `figma-texts.txt` verbatim.

## 2. Colour system

### 2.1 Figma brand tokens (defined in `tailwind.config.ts` → `theme.extend.colors`)

| Token | Hex | Role (from Figma comments) |
|---|---|---|
| `cream` | `#F5F0EB` | Page background + light card background |
| `paper` | `#FAF8F5` | Alternating section background |
| `ink` | `#1A1A1A` | Primary text, dark card (Pro pricing), dark buttons |
| `clay` | `#6B6059` | Secondary text |
| `sand` | `#B5A08E` | Eyebrow text, check icons, accent (Pro CTA button, POPULAR badge) |
| `linen` | `#EAE3DC` | Feature icon tile background |
| `sandline` | `#E3DCD5` | Hairline borders |

Semantic usage on the landing page:
- Section rhythm: `bg-cream` → `bg-paper` → `bg-cream` → `bg-paper` → `bg-cream` → `bg-paper` (CTA) → `bg-cream` (footer).
- Primary button: `bg-ink text-cream`; secondary/outline: `border-[1.5px] border-ink text-ink` on cream; Pro-tier accent button: `bg-sand text-cream`; Pro card: `bg-ink` with `text-cream`/`text-sand` and `shadow-figma-pro`.
- Eyebrow labels ("The Process", "Pricing Plans"…): `text-[13px] font-bold text-sand`.
- Shadows: `shadow-figma-hero` = `0 2px 8px 0 rgba(107,96,89,0.05)`; `shadow-figma-pro` = `0 8px 24px 0 rgba(107,96,89,0.08)` (both exact Figma effects).

Contrast notes (verified values): `ink` on `cream` ≈ 15.9:1; `clay` on `cream` ≈ 5.6:1; `cream` on `ink` ≈ 15.9:1 — all pass WCAG AA. `sand` is used for large/bold accent text and icons only; do not use it for body copy.

### 2.2 shadcn/ui HSL variables (defined in `app/globals.css`, consumed via `tailwind.config.ts`)

The default shadcn palette (slate-based) drives `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-input`, etc. used by auth pages, onboarding, and the dashboard. Values:

- Light: background `0 0% 100%`, foreground `222.2 84% 4.9%`, primary `222.2 47.4% 11.2%`, muted `210 40% 96.1%`, muted-foreground `215.4 16.3% 46.9%`, border/input `214.3 31.8% 91.4%`, ring `222.2 84% 4.9%`, destructive `0 84.2% 60.2%`, radius `0.5rem`, plus chart-1…5 tokens.
- Dark (`.dark` class strategy): full slate-dark set defined but **no theme toggle exists**; `darkMode: ["class"]` in Tailwind config.

### 2.3 Rules for new surfaces

- Marketing/public pages: use §2.1 tokens only. Never introduce new hex values; extend `tailwind.config.ts` with a commented Figma source if (and only if) the Figma frame provides one.
- Authenticated app pages: use shadcn semantic classes (`bg-card`, `text-muted-foreground`…) so theming keeps working.
- Form error text currently uses raw `text-red-500` in client forms (inconsistent with tokens) — keep consistent with existing forms unless a design decision changes it.

## 3. Typography

| Role | Font | Classes (as used) |
|---|---|---|
| Display/headings, prices, big numerals ("01") | **Fraunces** (Google, weights 400/600/700/900) | `font-fraunces`, e.g. `text-[64px] font-black leading-[1.233]` (hero h1), `text-[32px] font-bold` (section h2) |
| Everything else | **Manrope** (Google, weights 400–800) | body default via `font-manrope` on `<body>`; weights `font-bold`/`font-semibold` |

Type scale observed on the landing page (all with `leading-[1.366]` for Manrope, `leading-[1.233]` for Fraunces):
- Hero h1: 40px → 48px (sm) → 56px (md) → 64px (lg), `font-black`.
- Section h2: 32px → 40px (sm), `font-bold`; CTA h2: 36 → 48px `font-black`.
- Card h3: `text-lg font-bold`. Body: `text-base`/`sm:text-lg`. Card body: `text-[15px]`. Small: `text-sm`. Eyebrow: `text-[13px] font-bold`. Footer legal: `text-[13px]`.
- Prices: `text-[48px] font-black` Fraunces with `/ month` in `text-[15px]`.
- Step numerals: Fraunces `text-[32px] text-sand font-normal`.

Fonts load via `next/font/google` with CSS variables `--font-manrope` / `--font-fraunces` (self-hosted; no runtime font requests). New pages MUST use these variables through the `font-manrope`/`font-fraunces` utilities — no other font stacks.

## 4. Spacing & layout

- **Page container:** `mx-auto max-w-[1440px]` with horizontal padding `px-4 sm:px-6 xl:px-20` (Figma used 80px gutters at 1440). The design width is 1440px.
- **Section padding:** `py-16` mobile scaling to `md:py-[120px]` (Figma's 120px); sections stack with internal gaps `gap-10 md:gap-16/20`.
- **Navbar:** fixed 80px height (`h-20`) with 1px bottom border; dashboard header is the shadcn-style 56px (`h-14`) sticky bar — a deliberate difference between marketing and app shell.
- **Cards:** HowItWorks `p-8 rounded-xl border border-sandline bg-cream`; Testimonials `p-10 rounded-2xl`; Pricing Free `p-6 sm:p-8 md:p-12 rounded-2xl` max-w 400px; Pro `p-6 sm:p-8 md:p-12 rounded-2xl bg-ink` max-w 420px.
- **Grids:** steps/features `grid-cols-1 md:grid-cols-3`; testimonials `grid-cols-1 lg:grid-cols-2`; pricing cards flex column → row at `lg` with top alignment (`lg:items-start`).
- Auth/app pages use shadcn layout idioms instead: centered `Card` with `w-full max-w-[350px]` (auth) / `max-w-[420px]` (onboarding), `container` for dashboard.

## 5. Breakpoints & responsiveness

Tailwind defaults (`sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1400`) plus container `2xl: 1400px`. Observed strategy:

- **Mobile-first classes everywhere**; the landing hero, grids, and pricing switch at `sm/md/lg` (`MobileNav` appears below `lg`, desktop nav/CTA hidden below `xl`).
- Navbar shows desktop links only at `xl:flex`; hamburger (`MobileNav`) renders `lg:hidden` — both conditions coexist, so between `lg` and `xl` neither desktop links nor… note carefully: the hamburger is inside the header and visible below `lg`; between `lg` and `xl` **no navigation is rendered** on the landing page. This is a real (minor) responsive gap observed in code; flagged in `TASK.md`.
- Auth cards: `max-w-[350px]` with `px-4` page gutters; onboarding form collapses to single column below `sm`.
- Dashboard: `md:flex` nav, `md:hidden` menu button, search input scales `sm:w-[300px] md:w-[200px] lg:w-[300px]`.
- Global CSS enforces `overflow-x: clip` on body and fluid media (`img, video { max-width: 100%; height: auto; }`).

## 6. Component inventory

### 6.1 Figma-styled components (landing)
- **Navbar**: logo (PNG, `h-8 sm:h-10`), text links 15px semibold, `bg-ink` CTA `h-12 rounded-lg px-6`.
- **Buttons (marketing)**: primary `bg-ink text-cream`; outline `border-[1.5px] border-ink text-ink`; accent `bg-sand text-cream`; all `h-12 rounded-lg px-6 py-3.5 text-[15px] font-bold` with optional 16px trailing icon.
- **Step card**: number + title + body, `rounded-xl border-sandline bg-cream p-8`.
- **Feature column**: 48px `rounded-lg bg-linen` icon tile, 24px ink icon, title + body below.
- **Testimonial card**: `rounded-2xl border-sandline bg-cream p-10`, Fraunces quote, name (bold 15px) + role (13px clay).
- **Pricing cards**: as §4; Pro has `POPULAR` pill (`rounded-full bg-sand px-3 py-1 text-[11px] font-bold text-ink`).
- **CTA band**: centered stack, top/bottom `sandline` borders.
- **Footer**: brand blurb (max 300px) + three link columns (placeholders `href="#"`), divider, dual legal line.
- **MobileNav**: hamburger/X toggle (`aria-expanded`), drop panel `absolute inset-x-0 top-full border-b border-sandline bg-cream shadow-figma-pro`.

### 6.2 shadcn/ui primitives (`components/ui/`, style "default")
Button (variants default/destructive/outline/secondary/ghost/link; sizes default/sm/lg/icon), Badge (default/secondary/destructive/outline), Card (Header/Title/Description/Content/Footer), Dropdown Menu (Radix), Input, Label (Radix), Skeleton. These are stock shadcn implementations — treat them as library code: extend via variants/props, don't fork styling.

### 6.3 Generated icons (`components/icons.tsx`)
Six inline SVGs with Figma-exact paths: `ArrowRightIcon` (16), `SparklesIcon` (20), `BrainIcon` (24), `ShieldIcon` (24), `ChartColumnIcon` (24), `CheckIcon` (16). All `fill="none"`, `stroke="currentColor"`, `strokeWidth 2`, `strokeLinecap round`, `aria-hidden`, sized via `className` (`h-* w-*`). Regenerate only via `scripts/figma-icons-gen.py`.

### 6.4 Lucide / react-icons usage
Lucide: `Menu`, `X` (MobileNav); `Bell`, `Menu`, `Search`, `ReceiptText`, `User`, `Settings`, `HelpCircle`, `LogOut` (dashboard). react-icons: `FaGoogle`, `FaGithub` (OAuth buttons). Continue these sources before adding new icon sets.

## 7. Component states

- **Buttons:** hover darkening (`hover:bg-primary/90`, `hover:bg-accent`), `disabled:opacity-50 disabled:pointer-events-none`, focus `focus-visible:ring-2 ring-ring ring-offset-2` (shadcn base).
- **Async submit:** `SignupForm` shows `aria-disabled` + "Submitting..." label via `useFormStatus`; other forms don't yet (follow the better pattern for new forms).
- **Form errors:** server action returns `{ message }`; rendered as `text-sm text-red-500 text-center py-2` below the submit button (all auth/onboarding forms).
- **Loading placeholder:** `Skeleton` used in `DashboardHeader` for the plan badge inside `<Suspense>`.
- **Dropdown:** Radix open/close animations (`fade/zoom/slide` via `tailwindcss-animate`) with `data-[state=open]` styles.
- **Nav disclosure:** boolean `open` state; icon swaps Menu↔X; panel rendered conditionally.
- **Empty/zero states:** dashboard shows the voluntary upgrade card when `plan === 'none'`; no other empty states exist yet.
- **[PLANNED]** states with no design yet: assessment in-progress/result, credential revoked/invalid, verification loading — when built, derive from the closest existing pattern (Card + helper text for app surfaces; Figma cards for marketing).

## 8. Motion

- `tailwindcss-animate` plugin is installed (shadcn dependency) — supplies the dropdown animations actually in use.
- Two keyframes defined but unused: `accordion-down/up` (0.2s ease-out) — part of the shadcn template; harmless, keep unless cleaning up deliberately.
- Marketing page motion: none beyond hover transitions (`transition-colors` on links/buttons). **Do not add scroll animation libraries** without a design decision.

## 9. Iconography

1. Figma-generated stroke icons for landing brand moments (§6.3) — `currentColor`, sized by className.
2. Lucide for app UI chrome (24px stroke icons by default).
3. `react-icons/fa` brand glyphs for OAuth buttons.
Rule: no filled/mixed-style icons on the landing page; no new icon libraries.

## 10. Imagery & assets

| Asset | Path | Notes |
|---|---|---|
| Logo wordmark | `public/figma/logo.png` (bound to Figma nodes 6:11/6:163) | Landing navbar + footer; `width={180} height={40}` intrinsic |
| Hero preview | `public/figma/hero.png` (node 6:35) | 574×407 display box, `rounded-lg shadow-figma-hero`, `priority` |
| Legacy starter logo | `public/logo.png` | Still used by auth pages, dashboard header, subscribe page (square logo, "Acme Inc" sr-only label in subscribe — starter residue) |
| Starter SVGs | `public/next.svg`, `public/vercel.svg` | Unused leftovers |
| Figma exports | `.media/images/*` | Source-of-truth vectors/rasters + provenance manifest; do not edit |

Image rules: `next/image` always; explicit width/height; `priority` only for hero/logo above the fold; `alt` text describing function ("getcertificate.today logo", "product preview").

## 11. Accessibility (design-side)

- Semantic landmarks on landing: `header`/`nav`/`section` (each with `id` anchors)/`footer`; `main` wrappers on app pages (dashboard uses `main`; auth pages rely on divs — acceptable, don't regress new pages).
- `aria-label`/`sr-only` on all icon-only controls; `aria-expanded` on MobileNav; `aria-hidden` decorative icons; labelled inputs everywhere; visible focus rings from shadcn.
- The Figma palette passes AA for text roles (§2.1 notes); `POPULAR` pill (11px bold sand-on-ink) is decorative-adjacent — keep ≥11px bold if reused.
- `lang="en"` on `<html>`; `sr-only` naming for the legacy logo block.
- Known gap: the landing page's between-`lg`-and-`xl` nav hole (§5) is also an accessibility gap (keyboard users lose nav there); fix alongside the responsive fix.

## 12. Certificate presentation [PLANNED — design not yet defined]

No certificate, credential, or verification UI exists in code or Figma (frame `6:9` is landing-only). When designed, they MUST:
1. Use the brand system (§2.1): `paper`/`cream` certificate field on `cream` page, `ink` text, Fraunces for the holder's name and score, `sandline` hairlines — consistent with the product's "document" metaphor.
2. Include the required data set from `PRD.md` FR-E3/FR-F1 (holder, item, score, ID, date, status, QR).
3. Keep the QR monochrome (`ink` on `paper`), quiet zone intact, minimum print-safe size, with the encoded URL as adjacent selectable text (accessibility).
4. Present validity states unambiguously: **valid / revoked / invalid (hash mismatch) / not found** — distinct labels and wording, never colour alone.
5. Print-friendly (browser print → PDF is the MVP export path): `@media print` rules should strip nav/footer, force cream/ink, and keep the QR vector-sharp.

> These five constraints are the only certificate/verification design decisions made to date; everything else awaits a design pass. They are recorded here so implementation cannot drift from the brand.

## 13. Assessment interfaces [PLANNED — design not yet defined]

No assessment UI exists. Target conventions when built (derived from existing app-surface patterns):
- App-shell (shadcn) visual system, single-question-per-screen or one-column form (mobile-first), radio groups with visible labels, per-question error text matching the `{ message }` helper-text pattern, disabled submit until all answered with an explanatory hint (RULES §8.9).
- Timer/attempt info (if any) must be text-visible, not colour-only. Server-scored; result screens show score, pass/fail, and the credential link on pass.

## 14. Verification UI [PLANNED — design not yet defined]

Public, unauthenticated surface. Conventions: brand (marketing) system rather than app shell; minimal chrome (logo + verification card); one Card containing the §12 data set; "not found"/"revoked" states follow §12.4; never render question content or assessor internals.

## 15. Consistency requirements (enforceable)

1. New marketing-facing UI **MUST** use Figma tokens (§2.1), Fraunces/Manrope, and the marketing button/card recipes (§6.1) — no shadcn palette on marketing pages.
2. New authenticated UI **MUST** use shadcn primitives and semantic tokens (§2.2) — no raw hex from the brand palette except via new documented variants.
3. Never edit `components/icons.tsx` by hand; regenerate from Figma exports.
4. Copy strings on the landing page must match the Figma frame (`figma-texts.txt` is the reference) — copy edits require a Figma source or an explicit decision recorded in `MEMORY.md`.
5. Radii: `rounded-lg` (8px, buttons/tiles), `rounded-xl` (12px, step cards), `rounded-2xl` (16px, testimonials/pricing), shadcn `--radius 0.5rem` for app primitives. Don't mix outside these.
6. Borders: 1px `sandline` for marketing surfaces; 1.5px `border-ink` only for outline CTAs (exact Figma treatment).
7. Shadows: only `shadow-figma-hero` and `shadow-figma-pro` on marketing surfaces; `shadow-sm`/shadcn defaults in app.
8. Spacing: stick to Tailwind's 4px scale plus the Figma-exact values already in `app/page.tsx` (`py-[120px]`, 1440 container, 574px hero) — arbitrary values only when citing Figma geometry.
9. Every PR that changes visuals must state which source (Figma frame/node or shadcn default) it implements.
