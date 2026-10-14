# Row Level Security Ownership

## Overview

Row Level Security (RLS) policies in `getcertificate.today` are **owner-scoped**: each authenticated user can only read/write their own data. The application connects as the `postgres` role, which owns all tables and therefore bypasses RLS. This means app behavior is unchanged while direct/anon access is locked down.

## Policy Matrix

All policies apply to the `authenticated` role. The `anon` role gets no policies, resulting in zero rows being returned.

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `users_table` | Own row (`id = auth.uid()`) | Own row (`id = auth.uid()`) | Own row (`id = auth.uid()`) | N/A |
| `learning_items` | Own rows (`user_id = auth.uid()`) | Own rows (`user_id = auth.uid()`) | Own rows (`user_id = auth.uid()`) | Own rows (`user_id = auth.uid()`) |
| `assessments` | Via owning `learning_item` | N/A | N/A | N/A |
| `attempts` | Own rows (`user_id = auth.uid()`) | N/A | N/A | N/A |
| `credentials` | Own rows (`user_id = auth.uid()`) | N/A | N/A | N/A |
| `referrals` | Own referrals (`referrer_user_id = auth.uid()`) | N/A | N/A | N/A |
| `referral_credits` | Own credits (`user_id = auth.uid()`) | N/A | N/A | N/A |
| `transcripts` | No policy (server-only cache) | N/A | N/A | N/A |

## Key Design Decisions

- **No `anon` policies**: The `anon` role receives no RLS policies, meaning client-side anonymous access returns zero rows. This is intentional — sensitive data (progress, credentials, assessments) is not exposed to unauthenticated users.

- **Ownership via `user_id`**: For `learning_items`, `attempts`, `credentials`, `referrals`, and `referral_credits`, ownership is determined by a `user_id` column that references `auth.uid()`. The policy `USING (user_id = (auth.uid())::text)` ensures users can only access their own data.

- **Assessments ownership**: The `assessments` table has no `user_id` column. Ownership is resolved through the parent `learning_item` — a user can select assessments only if they own the associated `learning_item` (`EXISTS (SELECT 1 FROM learning_items li WHERE li.id = assessments.learning_item_id AND li.user_id = (auth.uid())::text)`).

- **Referral and credit ledger**: The `referrals` and `referral_credits` tables have select policies for authenticated users, but no INSERT/UPDATE policies. Attribution is recorded server-side in `utils/referrals.ts`, keeping the credential ledger authoritative.

- **Transcripts**: No RLS policy exists because transcripts are a server-side cache and are never read from the client.

## Enabling RLS

RLS is enabled via:

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
```

A guard in the migration pipeline refuses to enable RLS if table ownership does not match the `postgres` role, rather than silently breaking the app.

## Ownership Transfer

If tables need to be transferred to the `postgres` role (e.g., after a fresh Supabase provision), use:

```sql
ALTER TABLE public.<table> OWNER TO postgres;
```

This must be done before enabling RLS, otherwise the application (which connects as `postgres`) would be locked out by its own RLS policies.