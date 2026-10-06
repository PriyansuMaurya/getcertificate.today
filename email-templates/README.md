# getcertificate.today — email templates

Production-ready, responsive HTML emails that match the getcertificate.today UI:
cream page, paper card with a hairline rule, Fraunces headlines, Manrope body,
ink buttons, and the "Learn Today. Go Further." voice.

Every template is a single self-contained HTML file — table-based layout, inline
CSS, Outlook VML buttons, a hidden preheader, and mobile styles. No build step.

## What's here

```
email-templates/
├── README.md                            ← you are here
├── index.html                           ← local preview gallery (dev only)
├── supabase/                            ← paste into Supabase Auth → Email Templates
│   ├── confirm-signup.html              Email verification
│   ├── reset-password.html              Password reset
│   ├── magic-link.html                  One-time sign-in link
│   ├── change-email.html                Confirm a new email address
│   ├── reauthentication.html            Verification code
│   └── invite.html                      Invitation
└── resend/                              ← upload to Resend (or send as raw HTML)
    ├── certificate-earned.html          Credential issued
    ├── assessment-ready.html            Assessment unlocked at 80% watched
    ├── assessment-results-passed.html
    ├── assessment-results-not-passed.html
    ├── notification.html                Generic automated notification
    └── credential-revoked.html          Admin revocation notice
```

## Which provider for which email

| Folder      | Sender   | Why                                                                                                                                                    |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/` | Supabase | These are Supabase Auth's built-in emails. The app already triggers them (`signUp`, `resetPasswordForEmail`), so they belong in the Supabase dashboard. |
| `resend/`   | Resend   | App-level transactional mail (certificate, assessment, notifications) sent from your own code. This repo does not send these yet — wire up a Resend client where the events happen. |

## Variable syntax

The two providers use **different** variable syntaxes, and the templates in each
folder use the correct one for its provider.

### Supabase — Go template syntax

Written as `{{ .Name }}` and substituted by Supabase when it sends the email.
Available per template: `.ConfirmationURL`, `.Email`, `.Token`, `.TokenHash`,
`.SiteURL`, `.RedirectTo`, `.NewEmail`, `.Data`.

### Resend — triple-brace variables, no logic

Written as `{{{VARIABLE_NAME}}}` — **triple braces, UPPERCASE, no spaces** — and
substituted by Resend from the `variables` object you pass at send time.

Important constraints of Resend templates:

- **No conditionals or loops.** Resend templates do not support `{{#if}}`,
  `{{else}}`, or `{{#each}}`. Every variable is therefore **required** — the
  templates here avoid optional sections for this reason.
- **Reserved names.** `FIRST_NAME`, `LAST_NAME`, `EMAIL`,
  `RESEND_UNSUBSCRIBE_URL`, `contact`, and `this` cannot be used as custom
  variable names. That is why the greeting variable here is `LEARNER_NAME`, not
  `first_name`.
- **No inline fallbacks.** `{{{name | Fallback}}}` is not supported. Set a
  `fallback_value` when you register the variable instead.
- **Values may be inserted verbatim.** The docs do not state whether Resend
  escapes values, so treat them as unescaped: escape any user-provided text
  (holder names, YouTube video titles) before passing it in, or use the raw-HTML
  path below, whose helper escapes for you. If a later check shows Resend already
  escapes, drop that step to avoid double-encoding entities in URLs.

> **Recommendation for this codebase:** the values these emails carry
> (`holder_name`, `item_title`) come from user data, so the **raw-HTML path with
> the escaping helper in this README is the safer default**. Use the Resend
> Templates path if you would rather edit copy in the dashboard without a
> deploy. The template files work with either path.

## Installing the Supabase templates

1. Supabase Dashboard → **Authentication → Email Templates**.
2. Open the matching template, set the **Subject**, and paste the whole file into
   the message body.

| Template file           | Supabase template name | Suggested subject                           |
| ----------------------- | ---------------------- | ------------------------------------------- |
| `confirm-signup.html`   | Confirm signup         | Confirm your email for getcertificate.today |
| `reset-password.html`   | Reset password         | Reset your getcertificate.today password    |
| `magic-link.html`       | Magic Link             | Your sign-in link for getcertificate.today  |
| `change-email.html`     | Change Email Address   | Confirm your new email address              |
| `reauthentication.html` | Reauthentication       | Your getcertificate.today verification code |
| `invite.html`           | Invite user            | You've been invited to getcertificate.today |

The app already passes the `redirectTo` values these templates need via
`{{ .ConfirmationURL }}`. Confirm the redirect allow-list in **Authentication →
URL Configuration** includes your app URLs.

## Sending the Resend templates

### Option A — send as raw HTML (recommended here)

Keep the file as the source of truth and escape values in code:

```ts
import { readFileSync } from 'node:fs';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/** Escapes text before it is injected into the email HTML. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Replaces triple-brace tokens with escaped values (author comment stripped). */
function render(html: string, vars: Record<string, unknown>): string {
  return html
    .replace(/^\s*<!--[\s\S]*?-->/, '') // drop the template authoring comment
    .replace(/\{\{\{\s*([A-Za-z0-9_]+)\s*\}\}\}/g, (_m, key) => escapeHtml(vars[key]));
}

const html = render(
  readFileSync('email-templates/resend/certificate-earned.html', 'utf8'),
  {
    HOLDER_NAME: credential.holder_name,
    ITEM_TITLE: credential.item_title,
    SCORE: credential.score,
    PASS_SCORE: passScore,
    ISSUED_DATE: formatDate(credential.passed_at),
    CREDENTIAL_ID: credential.id,
    CERTIFICATE_URL: `${PUBLIC_URL}/certificates/${credential.id}`,
    VERIFY_URL: `${PUBLIC_URL}/verify/${credential.id}`,
    PREFERENCES_URL: `${PUBLIC_URL}/dashboard/settings`,
  }
);

await resend.emails.send({
  from: 'getcertificate.today <hello@getcertificate.today>',
  to: user.email,
  subject: `Your certificate for ${credential.item_title} is ready`,
  html,
});
```

If you need optional sections, add that logic in your render helper before
sending (the HTML itself has none, so it stays valid on the Resend path too).

### Option B — Resend Templates

Register each variable listed in the template's header comment on a Resend
template (with a `fallback_value`), then send by template id:

```ts
await resend.emails.send({
  from: 'getcertificate.today <hello@getcertificate.today>',
  to: user.email,
  template: {
    id: 'certificate-earned',
    variables: {
      HOLDER_NAME: credential.holder_name,
      ITEM_TITLE: credential.item_title,
      // ...every variable listed for the template
    },
  },
});
```

## Variables per template

### Supabase (`{{ .Go }}` syntax)

| File                    | Variables                                        |
| ----------------------- | ------------------------------------------------ |
| `confirm-signup.html`   | `.ConfirmationURL` `.Email` `.Token` `.SiteURL`  |
| `reset-password.html`   | `.ConfirmationURL` `.Email` `.SiteURL`           |
| `magic-link.html`       | `.ConfirmationURL` `.Email` `.Token` `.SiteURL`  |
| `change-email.html`     | `.ConfirmationURL` `.Email` `.NewEmail` `.SiteURL` |
| `reauthentication.html` | `.Token` `.Email` `.SiteURL`                     |
| `invite.html`           | `.ConfirmationURL` `.Email` `.SiteURL`           |

### Resend (`{{{UPPERCASE}}}` syntax)

| File                                   | Variables (all required)                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `certificate-earned.html`              | `HOLDER_NAME` `ITEM_TITLE` `SCORE` `PASS_SCORE` `ISSUED_DATE` `CREDENTIAL_ID` `CERTIFICATE_URL` `VERIFY_URL` `PREFERENCES_URL`     |
| `assessment-ready.html`                | `LEARNER_NAME` `ITEM_TITLE` `WATCH_PERCENT` `QUESTION_COUNT` `PASS_SCORE` `ASSESSMENT_URL` `PREFERENCES_URL`                      |
| `assessment-results-passed.html`       | `LEARNER_NAME` `ITEM_TITLE` `SCORE` `PASS_SCORE` `CERTIFICATE_URL` `VIEW_RESULT_URL` `PREFERENCES_URL`                            |
| `assessment-results-not-passed.html`   | `LEARNER_NAME` `ITEM_TITLE` `SCORE` `PASS_SCORE` `RETAKE_URL` `PREFERENCES_URL`                                                    |
| `notification.html`                    | `EYEBROW` `NOTIFICATION_TITLE` `NOTIFICATION_MESSAGE` `DETAIL_LABEL` `DETAIL_VALUE` `ACTION_LABEL` `ACTION_URL` `FOOTER_NOTE` `PREFERENCES_URL` |
| `credential-revoked.html`              | `HOLDER_NAME` `ITEM_TITLE` `REVOKED_DATE` `REASON` `VERIFY_URL` `PREFERENCES_URL`                                                  |

### `notification.html` example payloads

One fixed layout covers the app's automated events. Because Resend has no
conditionals, pass every variable each time:

| Trigger                | EYEBROW                | NOTIFICATION_TITLE                | DETAIL_LABEL / ACTION_LABEL                            |
| ---------------------- | ---------------------- | --------------------------------- | ------------------------------------------------------ |
| Subscription confirmed | Subscription confirmed | Your Professional plan is active. | `Plan` / `Manage billing` → `/dashboard/settings`      |
| Payment failed         | Payment issue          | We could not process your payment.| `Card` / `Update payment` → `/subscribe`               |
| Password changed       | Security notice        | Your password was changed.        | `When` / `Review account security` → `/dashboard/settings` |
| Account suspended      | Account notice         | Your account has been suspended.  | `Status` / `Contact support` → mailto support          |

Use `credential-revoked.html` for revocations rather than the generic template.

## Design tokens

Taken directly from `tailwind.config.ts` so the emails match the product.

| Token      | Hex       | Use in email                                 |
| ---------- | --------- | -------------------------------------------- |
| `cream`    | `#F5F0EB` | page background                              |
| `paper`    | `#FAF8F5` | card background                              |
| `ink`      | `#1A1A1A` | text, primary buttons                        |
| `clay`     | `#6B6059` | body copy, footer                            |
| `sand`     | `#B5A08E` | eyebrow labels, step numbers, detail labels  |
| `linen`    | `#EAE3DC` | callout boxes, code tiles                    |
| `sandline` | `#E3DCD5` | hairline borders, dividers, score separators |

**Type:** Fraunces (900/700) for headlines, Manrope (400–800) for everything
else, loaded via Google Fonts with `Georgia` / system-sans fallbacks. Outlook for
Windows ignores web fonts, so an `mso` style block forces Arial there.

## Email-client notes

- **Layout:** 600px max-width, table-based, inline CSS. On screens under 620px
  the card and buttons go full-width and the large numerals (score, pass mark)
  scale down; the compact score panel keeps its two columns, which still fit at
  that size. Add a stacking rule if you introduce a wider two-column block.
- **Buttons:** solid ink buttons use VML `roundrect` for Outlook plus an
  `mso-hide:all` anchor for everyone else.
- **Logo:** `https://getcertificate.today/figma/logo.png` (180×40). Absolute URL —
  email clients never load relative or SVG logos. Keep the PNG in `public/figma/`.
- **Light mode only:** headers declare `color-scheme: only light`. The brand is a
  light cream identity with no dark theme, so full client inversion would break
  fidelity. To add dark mode later, add a `@media (prefers-color-scheme: dark)`
  block and a light-on-dark logo variant.
- **Size:** each template is well under Gmail's ~102 KB clipping threshold.
- **Plain-text part:** none of these ship a `text/plain` alternative. Resend
  generates one from the HTML; for best deliverability on other senders, provide
  a short plain-text version alongside the HTML.
- **Contrast trade-off:** the `sand` labels (`#B5A08E`, 12–13px) match the
  product's own styling but sit around 2.2:1 on cream/paper — below WCAG AA. If
  accessibility outweighs exact brand matching, switch those labels to `clay`
  (`#6B6059`, ~5.9:1). Body text is already clay and passes.

## Previewing locally

Browser `fetch()` is blocked on `file://`, so serve the folder:

```bash
npx serve email-templates      # then open the printed localhost URL
# or
python3 -m http.server 8080 -d email-templates   # open http://localhost:8080
```

`index.html` renders each template in an iframe with sample data substituted. If
it cannot read the files (opened straight from disk), it falls back to showing the
raw templates and tells you to start a local server.

## Adding a template

1. Copy the closest existing file (same folder → same provider/syntax).
2. Update the header comment: provider, subject, and the variable list.
3. Keep the shell identical: `<!DOCTYPE>` + head meta/fonts/MSO block, logo row,
   paper card, footer. Only the card body changes.
4. Add a row to the tables above and a sample entry to `index.html`.
5. Verify in a client test service (Litmus, Email on Acid) or by sending a test
   through Resend before shipping.
