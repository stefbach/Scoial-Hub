# Social Hub — Current State (as of 2026-06-02)

> A pragmatic snapshot of what actually exists *right now*, for someone who can read the database but hasn't seen the code. Stops short of speculating about intent; flags every gap, divergence, and stub.

The single biggest finding lives in §1 and §3: **the schema layout in the database does not match what the frontend talks to.** Read those first.

---

## 0. The repository at a glance

- One Next.js (App Router) + TypeScript + Tailwind frontend, 19 routes, mostly built against in-process mock data.
- Frontend phase: **complete and rich** — Dashboard, Compose, Scheduled, Library, Automations, History, Campaigns + drill-downs, Audiences, Ad Performance, Analytics, Accounts, and the 8 Settings sub-pages all work, but every screen except identity uses the in-memory mock store.
- Backend phase: **just started** — only Supabase Auth is wired (login, signup, route protection, real user identity). No screen yet reads or writes business data through Supabase.
- All Supabase wiring is on the open branch `claude/auth-supabase` (PR #17, not merged). The latest commits land on that branch.

---

## 1. Backend target — which Supabase project, and which schema?

### Project
- **Project ref:** `kgohjmivilsfoewrcovn`
- **URL:** `https://kgohjmivilsfoewrcovn.supabase.co` (Postgres 15, us-east-1)
- This project is **shared** with another, unrelated application that owns the `public` schema (an inbound-leads / telephony / patient-management app — tables like `patients`, `cloudtalk_calls`, `appels_csv_import`, etc.).

### Schema the frontend actually queries — `sh`
The frontend Supabase clients are pinned to the `sh` schema:

```ts
// lib/supabase/client.ts, lib/supabase/server.ts, lib/supabase/middleware.ts
createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: "sh" } }
);
```

So when application code writes `supabase.from("sh_users").select(...)`, it resolves to `sh.sh_users` — **never** `public.sh_users`. Env vars (redacted here):

| Variable | Where set |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` (git-ignored) + must be added to Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel; legacy JWT-format anon key (not service role) |

`.env.example` lives in the repo with `NEXT_PUBLIC_SUPABASE_URL` filled and the anon-key value blank.

### ⚠️ Schema divergence — the critical finding
There are **two parallel sets of Social-Hub-named tables** in the database:

| Stack | Schema | Tables | What it is |
|---|---|---|---|
| **A** (the frontend reads/writes this) | `sh.*` | 22 `sh_*` tables | Org-scoped RLS via `sh.sh_current_user_org_id()`. Strict, multi-tenant. Where the live frontend lands. |
| **B** (frontend ignores) | `public.*` | 19 `sh_*` tables | Mostly empty, but contains the OCC/Tibok/CVMI seed companies and a dev-open `using (true)` RLS policy on the connection tables. Origin unclear from the frontend codebase — appears to predate the Auth phase. |

Both stacks have been **partially populated for the same auth user**:
- `auth.users` has one real signup (`62d2a98d-…`, email `user@socialhub.com`).
- `sh.sh_users` has one row for that auth user, role `admin`, org_id linked to `sh.sh_organizations` ("DDS Group"). ← created by my provisioning trigger.
- `public.sh_organizations` has **two** "DDS Group" rows; `public.sh_memberships` has one row linking the same auth user as `owner`. **These rows were not created by the current frontend codebase** — `public.handle_new_user` only writes to `public.profiles`, not to `public.sh_*`. They were likely created out-of-band (Studio? earlier prototype?). Confirm with whoever did that work.
- `public.sh_companies` already contains the seed OCC / Tibok / CVMI rows. **The frontend does not see these** because it never queries `public`.

If both stacks are kept, every Phase-3 screen wiring needs to pick a side once and stay there. The current code path is `sh.*`.

---

## 2. Database tables — what exists vs. what the code touches

### What the code touches today
There is exactly **one** SQL touchpoint in the frontend so far:

| Table | Operation | Where (file:line) | Purpose |
|---|---|---|---|
| `sh.sh_users` | `select` | `lib/auth-context.tsx:43` | Load the signed-in user's profile row by `auth_user_id` |
| `sh.sh_users` | `update` | `lib/auth-context.tsx:97` | Save profile edits (full_name / time_zone / language / two_factor_enabled / avatar_url) |

Plus Supabase Auth (`auth.users`) via `auth.signUp`, `signInWithPassword`, `signOut`, `getSession`, `getUser`, `exchangeCodeForSession`, `onAuthStateChange`.

That's it. Every other screen still reads in-process mock data from `lib/mock-data.ts`.

### Tables that exist but the frontend doesn't yet use
All other `sh.*` tables exist with full column definitions and RLS policies but receive no traffic from the app yet. Listed for completeness:

| `sh.*` table | Rows | Purpose (per the schema design) |
|---|---|---|
| `sh.sh_organizations` | 1 | Tenant root |
| `sh.sh_users` | 1 | ✅ **used** — see above |
| `sh.sh_companies` | 0 | Brands within an org (OCC, Tibok, CVMI when wired) |
| `sh.sh_user_company_access` | 0 | Per-user company access list |
| `sh.sh_user_notification_prefs` | 0 | Per-user notification matrix + frequency + quiet hours |
| `sh.sh_social_accounts` | 0 | Per-platform connection (FB / IG / LinkedIn) with `access_token`, `refresh_token`, `token_expires_at`, `external_id` |
| `sh.sh_meta_connections` | 0 | Per-company Meta connection state (read_only, business_manager_name, etc.) |
| `sh.sh_linkedin_connections` | 0 | Per-company LinkedIn connection flag |
| `sh.sh_post_templates` | 0 | Library content templates |
| `sh.sh_automations` | 0 | Recurring posting rules |
| `sh.sh_posts` | 0 | Scheduled / draft / published / failed posts |
| `sh.sh_publish_logs` | 0 | Per-attempt platform response + engagement metrics |
| `sh.sh_media_assets` | 0 | Image / video media records |
| `sh.sh_ad_campaigns` | 0 | Campaign hierarchy root |
| `sh.sh_ad_sets` | 0 | Audience + placement + budget level |
| `sh.sh_ads` | 0 | Individual ads + creative copy |
| `sh.sh_ad_audiences` | 0 | Saved / Custom / Lookalike targeting |
| `sh.sh_ad_insights` | 0 | Per-day per-ad metrics |
| `sh.sh_company_ad_safety` | 0 | Per-company spend caps + confirmation gates |
| `sh.sh_ai_usage_limits` | 0 | Per-company AI spend caps + current usage |
| `sh.sh_ai_generation_logs` | 0 | Audit-style log of AI generations |
| `sh.sh_audit_log` | 0 | Org-wide audit trail |

### Tables in `public.sh_*` (the parallel stack)
Frontend does not touch any of these.

| `public.sh_*` table | Rows | Notes |
|---|---|---|
| `public.sh_organizations` | 2 | Two "DDS Group" rows — not created by the current code |
| `public.sh_companies` | 3 | Seed: OCC, Tibok, CVMI — not created by the current code |
| `public.sh_memberships` | 1 | Same auth user as `sh.sh_users`, role `owner` |
| `public.sh_social_accounts` | 0 | See §3 |
| `public.sh_connections` | 0 | See §3 |
| `public.sh_channel_connections` | 0 | See §3 |
| `public.sh_competitors` | 0 | See §6 |
| `public.sh_benchmark_runs` | 0 | See §6 |
| `public.sh_api_keys` | 0 | No corresponding `sh.*` table; likely external-integration keys |
| `public.sh_ad_safety` / `sh_ad_sets` / `sh_ads` / `sh_audiences` / `sh_audit_log` / `sh_automations` / `sh_campaigns` / `sh_history_items` / `sh_scheduled_posts` / `sh_templates` | 0 each | Flat (no nested ad-set hierarchy on this side, e.g. `sh_audiences` here vs `sh_ad_audiences` in `sh`) |

The two stacks **do not share keys**: a `company_id` from `public.sh_companies` cannot be used in any `sh.*` foreign key, and vice versa. Each stack is internally consistent but isolated.

---

## 3. Connection-related tables — three exist, frontend uses none

This is the section the document was specifically asked about. Three distinct connection-table designs exist in the database. The frontend currently **writes none of them** — the Settings → Accounts screen still operates entirely on the in-memory `meta` / `linkedin` mock blobs hanging off `CompanyData`.

### 3a. `public.sh_social_accounts` (the legacy / dev stack)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid → `public.sh_companies(id)` | |
| `platform` | text | No enum — free string |
| `account_name` | text | |
| `status` | text | |
| `access_token`, `refresh_token` | text | **Plaintext** — Vault not in use here |
| `token_expires_at` | timestamptz | |
| `external_id` | text | Platform-side account ID |
| `created_at` | timestamptz | |

- **RLS:** `sh_dev_all` with `USING (true)` — wide-open dev policy. Should not be used as-is in production.
- **Rows:** 0.
- **Code references:** none.

### 3b. `public.sh_connections` (a single-row-per-company blob)
| Column | Type | Notes |
|---|---|---|
| `company_id` | uuid → `public.sh_companies(id)` (PK) | |
| `meta` | jsonb | Loose blob — schema undefined |
| `linkedin` | jsonb | Loose blob — schema undefined |

- **RLS:** `sh_dev_all` with `USING (true)`.
- **Rows:** 0.
- **Code references:** none.

### 3c. `public.sh_channel_connections` (generic per-channel record)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid → `public.sh_companies(id)` | |
| `channel` | text | e.g. `facebook` / `instagram` / `linkedin` — free string |
| `status` | text | |
| `config` | jsonb | Free-form per-channel settings |
| `connected_at`, `updated_at`, `created_at` | timestamptz | |

- **RLS:** `sh_dev_all` with `USING (true)`.
- **Rows:** 0.
- **Code references:** none.

### 3d. The `sh.*` equivalents (the schema the frontend talks to)
Different shape and properly scoped:

- **`sh.sh_social_accounts`** — like §3a but with proper enums (`sh.sh_platform`, `sh.sh_social_account_status`) and an org-scoped RLS policy that filters via `sh.sh_current_user_org_id()`.
- **`sh.sh_meta_connections`** — per-company singleton: `connected`, `connected_at`, `business_manager_name`, `facebook_page_name`, `instagram_handle`, `read_only`, `keep_read_only_after_safety`. RLS: org-scoped.
- **`sh.sh_linkedin_connections`** — per-company singleton: `connected`, `connected_at`, `page_name`. RLS: org-scoped.
- **Code references:** none yet. (Phase 3 will wire Settings → Accounts to these.)

### Summary table

| Table | Schema | Purpose | Rows | RLS | Code uses it? |
|---|---|---|---|---|---|
| `sh_social_accounts` | `public` | Legacy/dev all-platforms record | 0 | dev-open `true` | ❌ |
| `sh_connections` | `public` | Blob per company (meta/linkedin jsonb) | 0 | dev-open `true` | ❌ |
| `sh_channel_connections` | `public` | Generic per-channel record | 0 | dev-open `true` | ❌ |
| `sh_social_accounts` | `sh` | Token-bearing per-platform record | 0 | org-scoped | ❌ (planned) |
| `sh_meta_connections` | `sh` | Per-company Meta singleton | 0 | org-scoped | ❌ (planned) |
| `sh_linkedin_connections` | `sh` | Per-company LinkedIn singleton | 0 | org-scoped | ❌ (planned) |

**Decision pending:** pick one set and retire the others before any "Connect Facebook/Instagram/LinkedIn" code is written.

---

## 4. OAuth / social-account-connection logic that exists

Short answer: **the Accounts screen is all UI. There is no real OAuth flow.**

What the code *does* contain (all on the merged main branch, file `app/(general)/accounts/page.tsx` + `lib/connection-store.ts`):

| Affordance | Status |
|---|---|
| Meta "Reconnect" button | **Disabled with tooltip** "Connection management will be enabled when Meta integration is wired." |
| Meta "Disconnect" confirmation modal | Wired — but only mutates the in-memory `CompanyData.meta` (mock store) |
| Meta "Manage ads access" modal — toggle "Keep read-only after safety period" | Wired — writes to the in-memory `meta` blob |
| LinkedIn "Connect" button | Opens a modal with "Coming soon" + "Notify me when ready" (mock toast) + an external link to `https://developer.linkedin.com/product-catalog/marketing` |
| Read-only safety window math | Computed live from `meta.connected_at + 7 days` against a hard-coded "today" anchor (2026-05-30) |

What is **not** built:

- No OAuth redirect handler for Facebook, Instagram, or LinkedIn — the only route handler that exists is `app/auth/callback/route.ts`, which is the **Supabase Auth** PKCE callback (email-confirmation exchange), not a platform OAuth.
- No Meta Business Login flow, no Graph API token exchange, no LinkedIn Marketing Developer Platform flow.
- No edge function for token refresh.
- Token storage columns (`access_token`, `refresh_token`, `token_expires_at`) sit unused in both `public.sh_social_accounts` and `sh.sh_social_accounts`.

The Accounts mock includes seeded per-company state so the UI variants are testable: OCC is "connected 4 days into safety", Tibok is "expired but kept read-only", CVMI is "not connected".

---

## 5. Edge functions / server-side code

### Supabase Edge Functions
**None.** `list_edge_functions` against the project returns an empty list.

### Server-side code in the Next.js app
Only auth-related routes — no business-logic API routes exist.

| Path | Type | What it does |
|---|---|---|
| `middleware.ts` | Next.js middleware | Calls `lib/supabase/middleware.ts:updateSession`, which uses the cookie-based server client to refresh the auth session on every request. Then: redirects unauthenticated traffic to `/login` (preserving the original path via `?next=`), and bounces logged-in users away from `/login` and `/signup`. Public-path whitelist: `/login`, `/signup`, `/auth/callback`, `/auth/check-email`, `_next/*`, `/api/auth/*`. |
| `app/auth/callback/route.ts` | App Router route handler | Exchanges a one-time PKCE `code` (sent by Supabase Auth in the email-confirmation link) for a session cookie via `exchangeCodeForSession`, then 302s to `/`. |
| `lib/supabase/server.ts` | Helper | RSC / route-handler Supabase client. Pinned to `sh`. Uses `next/headers`'s `cookies()` for session reads (writes succeed in route handlers and silently no-op in RSC, as intended by `@supabase/ssr`). |
| `lib/supabase/middleware.ts` | Helper | Middleware-side Supabase client that rotates the refresh token cookie. Returns `{ response, user }`. Pinned to `sh`. |
| `lib/supabase/client.ts` | Helper | Browser client. Pinned to `sh`. |

### Postgres functions and triggers in `sh`

| Function | Purpose | Notes |
|---|---|---|
| `sh.sh_current_user_org_id()` | Returns the signed-in user's `org_id` for use inside RLS policies | `SECURITY DEFINER`, `search_path=sh, pg_temp`. Pre-existed. |
| `sh.sh_provision_user_on_signup()` | Trigger function on `auth.users AFTER INSERT` | `SECURITY DEFINER`, `search_path=sh, pg_temp`. Reads `raw_user_meta_data->>'full_name'` and `'org_name'` and creates the matching `sh.sh_organizations` + `sh.sh_users` rows. Idempotent if an `sh.sh_users` row already exists for that `auth_user_id`. Added on branch `claude/auth-supabase` (commit `43db5f8`). |

### Other triggers on `auth.users` worth knowing about

| Trigger | Function | Notes |
|---|---|---|
| `sh_provision_user_on_signup` | `sh.sh_provision_user_on_signup` | Mine (Social Hub). |
| `on_auth_user_created` | `public.handle_new_user` | Inserts into `public.profiles` — belongs to the other app. Does **not** touch the `public.sh_*` tables. |
| `closer_login` | `public.http_request` | Fires an HTTP request on every auth user insert — also the other app's. |

That means each Social Hub signup also writes to `public.profiles` and pings the other app's webhook. Worth flagging if either of those is sensitive.

### Security advisor
After applying the provisioning migration, the advisor reports **no findings on `sh.*` objects**. The advisor's existing findings are all in `public.*` and belong to the other app.

---

## 6. Tables for features beyond the original Social Hub scope

Two extra tables exist in `public` that aren't part of the original Social Hub design and aren't referenced from the frontend at all:

### `public.sh_competitors`
| Column | Type |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid → `public.sh_companies(id)` |
| `network` | text — likely `facebook` / `instagram` / `linkedin` |
| `handle` | text — competitor's handle on that network |
| `name` | text |
| `source` | text — provenance (likely `manual` vs scraped) |
| `metrics` | jsonb — latest snapshot |
| `created_at` | timestamptz |

### `public.sh_benchmark_runs`
| Column | Type |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid → `public.sh_companies(id)` |
| `params` | jsonb — what to benchmark, against whom |
| `status` | text — likely `queued / running / done / failed` |
| `results` | jsonb |
| `created_at` | timestamptz |
| `finished_at` | timestamptz |

### Status of these features
- **Frontend code:** zero references. `grep -rn "competitor\|benchmark" lib app` returns no matches.
- **Rows in DB:** zero.
- **Edge functions to populate them:** none.
- **Most likely intent (inferred from column shapes):** a competitor-benchmarking add-on — register the competitor handles you want to track per company, kick off a benchmark run (presumably via an edge function or external job), and store the rolled-up metrics on the run + the latest snapshot on `competitors.metrics`. Could be the start of a "How does my brand compare to peers on engagement / growth / posting cadence" view.
- **Concretely how far along:** schema only. Tables, no policies of interest beyond the wide-open `sh_dev_all`, no code paths, no UI, no jobs.

---

## 7. Authentication state — how it actually works today

### Where it lives in the code
- `lib/supabase/{client,server,middleware}.ts` — three clients pinned to `db.schema = 'sh'`.
- `middleware.ts` — global route gate.
- `app/login/page.tsx` — email + password sign-in (`signInWithPassword`). Show/hide password toggle. Friendly error mapping (`lib/auth-errors.tsx`).
- `app/signup/page.tsx` — full name + org name + email + password + confirm-password. Strength meter. Sends `{ data: { full_name, org_name }, emailRedirectTo: '/auth/callback' }` to `supabase.auth.signUp`.
- `app/auth/check-email/page.tsx` — landing page shown after signup, telling the user to click the confirmation link.
- `app/auth/callback/route.ts` — PKCE exchange + 302 to `/`.
- `lib/auth-context.tsx` — `AuthProvider` lifts the session and the matching `sh.sh_users` row into React context. `useAuth()` exposes `session`, `profile`, `signOut`, `refreshProfile`, `updateProfile`.
- `app/layout.tsx` — reads the initial session server-side and conditionally renders the app shell only when signed in. Otherwise renders just `{children}` (so `/login` / `/signup` don't get an app-shell frame).
- `components/shell/UserMenu.tsx` — the top-bar avatar dropdown. Shows initials/avatar, "Profile & settings", "Sign out".
- `components/settings/Profile.tsx` — Settings → Profile is the **only** non-mock screen. Reads from and writes to `sh.sh_users` via `updateProfile()`. Email is read-only (managed by Supabase Auth).

### What happens on signup (verified end-to-end against the live project)
1. `supabase.auth.signUp(...)` creates the `auth.users` row with `raw_user_meta_data = { full_name, org_name }`.
2. Trigger `sh_provision_user_on_signup` fires `AFTER INSERT` on `auth.users`:
   - Creates one `sh.sh_organizations` row (using `org_name`).
   - Creates one `sh.sh_users` row linked via `auth_user_id`, role `admin`, status `active`.
   - Function is `SECURITY DEFINER` with `search_path=sh, pg_temp` and is idempotent: if an `sh.sh_users` row for that auth user already exists, it returns without rewriting.
3. The supabase-auth side also fires `on_auth_user_created` → `public.handle_new_user`, which inserts the same auth user into `public.profiles`. (Cross-app side effect — not Social Hub's doing.)
4. Because email confirmation is **required** by the project's Supabase Auth settings, the user is **not** logged in until they click the link. The link routes back to `/auth/callback`, which exchanges the PKCE code for a session cookie, then redirects to `/`.

### What login does
- `supabase.auth.signInWithPassword({ email, password })` against `auth.users`. On success the session cookie is set and the browser is sent to the requested `?next=` path (or `/` if none).
- Auth state is mirrored to React via `onAuthStateChange` inside `AuthProvider`.

### What logout does
- `UserMenu` → "Sign out" calls `supabase.auth.signOut()` and routes to `/login` via `router.replace`. The middleware's redirect rules take over on the next navigation.

### What is **not** wired
- Google OAuth — not built.
- Real 2FA enforcement — the toggle in Settings → Profile persists a `two_factor_enabled` boolean on `sh.sh_users` but does not enforce anything.
- Password reset email flow — not built.
- Service-role usage from the browser — explicitly disallowed; never present in committed code.

---

## 8. Recent changes (active work)

Branch state as of writing: `main` was last touched on **2026-06-02** by the Settings merge. There is one open PR not yet merged.

### Open work
- **Branch `claude/auth-supabase`** (PR #17, not merged). Two commits in chronological order:
  1. `43db5f8` *Wire Supabase Auth and gate the app behind login* (2026-06-02). Added the migration, the three Supabase clients, middleware route protection, `/login` + `/signup` + `/auth/check-email` + `/auth/callback`, `AuthProvider`, the new `UserMenu`, and made Settings → Profile read/write `sh.sh_users`.
  2. `16e08d1` *Polish signup + login: show/hide passwords, confirm field, friendlier errors* (2026-06-02). Added `PasswordInput`, `PasswordStrengthMeter`, the confirm-password row on signup (with mismatch validation), and the `lib/auth-errors.tsx` mapper that rewrites duplicate-email / rate-limit / invalid-credential errors into plain language. Email is now trimmed + lowercased on submit.

### What just merged into `main`
- **2026-06-02** PR #16 *Complete Settings — all 8 sub-pages wired* (`fffdfd6`). Big one: Profile, Notifications, Organization, Companies, Team & roles, AI preferences, Ad Safety (incl. lower-cap + AI-confirm-off warnings), and Audit log (35 mock entries + filters + export + pagination). The Companies sub-page got the `addCompany` / `updateCompany` context fix and the shared `ImageUpload` component the same day.
- **2026-06-01** PR #15 *Accounts screen interactivity* (`3fabe82`). Disconnect / Manage / LinkedIn modals — all mock-state mutations. This is the screen that will need real OAuth wiring next.

### Direction signal
Reading the log: through June 1st the focus was finishing the frontend screens. Beginning June 2nd the work pivoted to backend wiring, starting with Auth. Every screen except identity is still mock-data-driven.

---

## 9. TL;DR for the next person picking this up

1. **Read §1.** The frontend talks to `sh.*`. There's a parallel `public.sh_*` set with seed data and three different connection-table designs — they are not what the frontend uses.
2. **Read §3.** Decide whether `sh.sh_social_accounts` + `sh.sh_meta_connections` + `sh.sh_linkedin_connections` are the canonical connection model, or whether one of the `public.*` designs wins. Then retire the rest.
3. **Read §7.** Only Auth is wired. Every other screen is mock data.
4. **Read §8.** The active branch is `claude/auth-supabase`. Backend phase has just started.

---

*Document generated from the live database (`kgohjmivilsfoewrcovn`), the `claude/auth-supabase` branch HEAD (`16e08d1`), and `git log`. No code was modified to produce it. Numbers and row counts are from the moment of writing and will drift.*
