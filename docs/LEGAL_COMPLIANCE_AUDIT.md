# Legal Compliance Audit — getcertificate.today

_Date: October 2026. This is an engineering-oriented compliance review, not
legal advice. Items marked **⚠️ LAWYER** need a qualified attorney before
you rely on them._

## Summary of what was implemented

| Item                           | Status                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy                 | ✅ Expanded: per-item data inventory with purposes, lawful-basis notes, rights, retention, children                                                  |
| Terms & conditions             | ✅ Expanded: age rules, refund/cancellation, disclaimers, AI content, acceptable use                                                                 |
| Cookie policy                  | ✅ New page at `/cookie-policy`, linked from footer/privacy/terms, in sitemap                                                                        |     | Cookie consent required? | ✅ Yes (GA4 via GTM needs ePrivacy/GDPR opt-in). Consent banner added; GTM does not load until "Accept analytics"; the old GTM `<noscript>` fallback (which loaded analytics without consent) was removed |
| Consent form for personal data | ✅ Required Terms+Privacy checkbox at signup (password) and onboarding (OAuth), timestamp stored in `users_table.terms_consented_at` + auth metadata |
| Data deletion                  | ✅ "Delete my account" in dashboard settings (deletes profile, learning, attempts, credentials; blocks if subscription active)                       |
| Data access/correction         | ✅ Profile editable in settings; access/portability requests documented + mailto in settings & privacy policy                                        |
| Third-party API terms          | ✅ Reviewed — see below                                                                                                                              |
| AI-generated content IP        | ✅ Reviewed — see below                                                                                                                              |
| OSS dependency licenses        | ✅ Full scan of installed tree: permissive only; `THIRD-PARTY-NOTICES.md` added                                                                      |
| Copyrighted assets             | ✅ Reviewed — fonts (SIL OFL), icons (own Figma/ISC/MIT), images (own Figma export)                                                                  |
| Attribution                    | ✅ `THIRD-PARTY-NOTICES.md` (no license required in-UI attribution for these packages)                                                               |
| Age restrictions               | ✅ 13+ enforced server-side; EU/UK consent-age wording added to Terms                                                                                |
| High-risk advice disclaimers   | ✅ Added to Terms (not professional/medical/legal/financial/career advice; certificates are completion records)                                      |
| Refund & cancellation policy   | ✅ Dedicated section in Terms (cancel anytime, 14-day refund, original payment method)                                                               |
| Marketing claims accuracy      | ✅ Testimonials removed; "Guaranteed Authenticity"→"Verifiable records"; unverifiable claims rewritten                                               |
| Financial/legal compliance     | ✅ Reviewed — **⚠️ LAWYER items listed below**                                                                                                       |

## Third-party API terms review

| Provider                     | Key obligations                                                                                             | Our status                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe**                   | Disclose billing/refund terms before checkout; no resale of Stripe services; prohibited-business rules      | ✅ Terms list billing, cancellation, refunds. Prices/checkout shown on `/subscribe`. **⚠️ LAWYER**: confirm your entity's Stripe merchant descriptor & tax handling                                                                                                                                        |
| **Supabase**                 | Disclose processors in privacy policy; no resale                                                            | ✅ Disclosed in privacy policy                                                                                                                                                                                                                                                                             |
| **OpenAI (API)**             | You own output; may not misrepresent AI output as human; human review before high-impact uses               | ✅ Terms disclose AI-generated assessments; assessments are low-stakes educational quizzes. **⚠️ LAWYER**: verify which provider `OPENAI_BASE_URL` actually points to (OpenRouter/Azure/etc.) in production and that its terms are met                                                                     |
| **YouTube / Google**         | Privacy policy must disclose YouTube API Services, link Google privacy policy, allow users to revoke access | ✅ Added Google privacy-policy link to privacy policy. **⚠️ LAWYER**: Google's YouTube API Services ToS also ask for a link to the YouTube ToS and a Google security-settings revocation link — add if you use the official YouTube Data API (currently transcripts come via TranscriptAPI, a third party) |
| **TranscriptAPI**            | Commercial API; caching allowed per their terms                                                             | ✅ Transcripts cached in our DB (documented in privacy policy). **⚠️ LAWYER**: confirm their ToS permit long-term caching of transcripts                                                                                                                                                                   |
| **Google Tag Manager / GA4** | Requires a privacy policy + consent for analytics cookies in EU/UK; no PII in tags                          | ✅ Consent-gated; no PII passed to tags                                                                                                                                                                                                                                                                    |
| **Vercel Analytics**         | Cookieless; disclose in privacy policy                                                                      | ✅ Disclosed; no consent needed                                                                                                                                                                                                                                                                            |

## AI-generated content IP

- Under OpenAI's terms, **we own the AI output** (assessment questions).
- The **inputs** are transcripts of public YouTube videos. We do not claim
  ownership of video content; Terms state this. **⚠️ LAWYER**: assess
  transcript-caching copyright exposure (there is ongoing litigation in this
  space; a fair-use/fair-dealing argument exists but is not settled).
- AI output may not be uniquely copyrightable; do not rely on copyright for
  the assessments — rely on Terms + server-side answer protection instead.
- Certificates embed user names and video titles; users grant the license
  needed to operate the service (stated in Terms).

## Open-source licenses

- Full scan of the installed dependency tree: **MIT (420), ISC (22),
  Apache-2.0 (28), BSD-2/3, 0BSD, Unlicense, CC0, MPL-2.0 (dev/optional)** —
  all permissive. **No GPL/AGPL runtime dependencies.**
- ⚠️ `@supabase/auth-ui-react` has **no license field** in its package.json
  and appears **unused in source** (no imports found). Recommended: remove
  the dependency (`npm uninstall @supabase/auth-ui-react
@supabase/auth-ui-shared`) until its license is confirmed.
- `caniuse-lite` is CC-BY-4.0 (build-time data only; attribution satisfied by
  this repo's notices file).

## Fonts, icons, images, UI assets

- **Fonts**: Manrope, Fraunces, DM Sans/Serif, Mrs Saint Delafield — all
  SIL OFL 1.1 (commercial use OK, self-hosted via `next/font`).
- **Icons**: lucide-react (ISC), @tabler/icons (MIT), react-icons (MIT),
  plus SVGs generated from your own Figma file. All clear.
- **Images**: `/public/figma/*` exported from your own Figma design.
  ⚠️ Confirm the Figma file's assets are yours or licensed (e.g. not
  stock photos copied in).
- **YouTube thumbnails** displayed at runtime remain creators' property —
  covered by YouTube embed terms; noted in `THIRD-PARTY-NOTICES.md`.

## Marketing claims — before/after

- ❌ Removed fabricated-looking testimonials ("Priyanshu Maurya", "Sarah
  Chen") — FTC 2024 fake-reviews rule carries penalties up to ~$51k/violation.
- ❌ Removed "recognized by employers worldwide" (unverifiable).
- ❌ "Guaranteed Authenticity" → "Verifiable records".
- ❌ "non-cheatable questions" → describes actual server-side validation.
- ✅ Kept: "80% completion gate", "1 Cert/month free", "No credit card
  required", "cryptographic hash + QR" — all verified against code
  (`UNLOCK_PERCENT`, `FREE_CREDENTIALS_PER_MONTH`).
- ✅ Pricing feature bullets in `components/SubscribePricingCards.tsx` and
  `stripeSetup.ts` were rewritten to only advertise features that exist in
  the codebase (mentor sessions, webinars, weekly reports, community/priority
  support were removed).
- **✅ PRODUCT (resolved)**: the paid tiers now differentiate by certificate
  allowance: Starter 10/month, Pro 30/month, and Pro yearly unlimited
  (`utils/plans.ts`). Each price maps to a real entitlement.

## ⚠️ Items that need a lawyer

1. **Business identity & governing law** — the site has no registered legal
   entity name, postal address, or governing-law/jurisdiction clause. Most
   jurisdictions require seller identification; Stripe requires a business
   name on statements. Draft entity + venue clause.
2. **Tax (Sales tax/VAT/MOSS)** — subscription sales across borders trigger
   tax obligations (US economic nexus, EU VAT for digital services). Confirm
   Stripe Tax or equivalent is configured.
3. **Auto-renewal laws** — California ARL and EU consumer rules require
   specific pre-checkout disclosures (renewal terms, how to cancel) at the
   point of sale, not just in Terms. Add disclosure text on `/subscribe`.
4. **EU 14-day withdrawal right** — digital-services contracts often carry a
   withdrawal right; our 14-day refund covers this informally, but wording
   should be lawyer-drafted (and waivers after content delivery are
   fact-specific).
5. **Testimonials/pricing claims** — testimonials removed and pricing
   bullets rewritten to real features; confirm the remaining tier-parity
   issue (see Marketing claims) before paid traffic.
6. **YouTube transcript copyright** (see above).
7. **Accessibility (ADA)** — certificate product sold to US consumers:
   WCAG conformance reduces litigation risk.
8. **Credential/degree claims** — Terms now state certificates are not
   accredited; **⚠️ LAWYER** should confirm the wording against your state's
   "academic degree/credential" statutes (several states regulate the word
   "certification").
9. **Data-deletion residual** — `deleteAccount` removes app data and ends
   the session, but **cannot remove the Supabase Auth identity** (admin API
   needs a service-role key, forbidden by AGENTS.md §9). The privacy policy
   tells users to email us for full removal. Decide on an approved admin
   path (manual dashboard deletion or a scoped function) so this is
   operationally reliable.10. **Legacy consent records** — users who completed onboarding before this
   release have `terms_consented_at = NULL` (a legacy user who revisits
   onboarding will be re-prompted, by design; the gap is only users who
   never see that form again). Consider a one-off backfill
   (`UPDATE users_table SET terms_consented_at = now() WHERE
 terms_consented_at IS NULL`) or treat continued use as acceptance and
   note it.
10. **Privacy policy jurisdiction** — policy covers GDPR/CCPA-style rights
    generically. If you have EU/UK users, confirm a lawful basis table and
    an EU representative/DPO assessment with counsel.

## Reproducing the checks

```bash
# License inventory of installed packages
node -e "const fs=require('fs'),path=require('path');const seen={};(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(!e.isDirectory())continue;const p=path.join(d,e.name);if(e.name.startsWith('@')){w(p);continue;}try{const j=JSON.parse(fs.readFileSync(path.join(p,'package.json'),'utf8'));const l=(typeof j.license==='string'?j.license:(j.license&&j.license.type)||'UNKNOWN');(seen[l]=seen[l]||[]).push(j.name);}catch{}}})('node_modules');for(const l of Object.keys(seen).sort())console.log(l,seen[l].length)"
```
