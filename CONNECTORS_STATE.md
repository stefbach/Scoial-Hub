# Social Hub — Connectors Page State

> **Bottom line first:** the page you described (`/parametres-connecteurs`) — and every connector card it contains — **does not exist in this repository or in the deployed application**. This document explains how I verified that, what the closest analogues are, and what would need to happen for the feature you described to exist.

If you saw this page in a running app, it is either (a) a different application running against the same Supabase project, (b) a branch / fork that hasn't been pushed here, or (c) a sibling repo. The Tibok / closer-app side of the same Supabase project owns the `public` schema and a different code base entirely — see §1 of `CURRENT_STATE.md` — so it's plausible this page lives there.

---

## 1. How I verified the page does not exist

### File-tree check
The Next.js app router routes (every directory under `app/`):

```
app/
├── (general)/  → /accounts, /analytics, /settings
├── (organic)/  → /automations, /compose, /history, /library, /scheduled
├── (paid)/     → /ad-performance, /ad-sets/[id], /audiences, /campaigns, /campaigns/[id]
├── auth/       → /auth/callback, /auth/check-email
├── login/      → /login
├── signup/     → /signup
└── (root)      → /
```

There is no `parametres-connecteurs` directory anywhere under `app/`, and the Next.js App Router is the only way a route can exist. URLs that aren't backed by a directory return 404.

### Text-search check
Searched every tracked file across every branch (`accounts-interactivity`, `ad-performance`, `analytics-interactivity`, `audiences-basics`, `audiences-c2`, `auth-supabase` ← current, `campaign-detail-page`, `campaigns-fixes`, `compose-scheduled-fixes`, `dashboard-nav`, `data-inventory`, `history-interactivity`, `library-interactivity`, `scheduled-detail-modal`, `settings-complete`, `wizardly-lovelace-d5z6a`, `main`) for the strings you used (`parametres-connecteurs`, `Configurer`, `Enregistrer`, `Mode simulé`, `Échec`, `Connecteur MCP`, `connecteur`). **Zero matches.**

The only hits for individual connector names are model labels — "Anthropic Claude" appears as a string in `components/settings/AiPrefs.tsx:64` and inside the seeded `AI_GENERATION_LOGS` array in `lib/mock-data.ts` (rows like `model: "Anthropic Claude"`). These are AI model identifiers in the AI Preferences UI, not connector configuration cards.

### Language check
The entire frontend is in English. There is no French text anywhere — no `fr` locale, no i18n setup, no language-switching framework. The Settings → Profile screen has a *Language* dropdown with English / Français but it only writes the value to `sh.sh_users.language`; the UI never re-renders in French.

### Database check
Queried the live Supabase project (`kgohjmivilsfoewrcovn`) for any table whose name contains *connector*, *connecteur*, *integration*, *tiktok*, *telegram*, *replicate*, *youtube*, *pixel*, *ga4*, *analytics_4*, or *mcp*. **Zero results.**

### Edge function check
`list_edge_functions` against the project returns an empty list. There is no server-side connector-saving code anywhere on the Supabase side either.

---

## 2. The closest things that *do* exist

For everything in your spec, the closest analogue in the current codebase:

| You asked about | What exists today |
|---|---|
| `/parametres-connecteurs` page | No equivalent. The Accounts screen (`/accounts`) is the only thing that surfaces social-platform connection state, and it's pure UI on top of mock data. |
| **Facebook** connector card with Configurer / Enregistrer | The `Accounts` page (`app/(general)/accounts/page.tsx`) shows a "Meta Business Manager" card that covers Facebook + Instagram together. It exposes a **Disconnect** button (mock confirm), a **Reconnect** button (**disabled with tooltip** "Connection management will be enabled when Meta integration is wired"), and a **Manage** modal for the read-only safety toggle. There is no "Configurer" / form-fields / "Enregistrer" pattern anywhere in this code. |
| **Instagram** connector | Same Meta card — Instagram is rolled into the single Meta connection by design, per the SCHEMA_REFERENCE the project was built against. |
| **LinkedIn** connector | The Accounts page shows a LinkedIn card. Its only action is a **Connect** button that opens a "coming soon" info modal with a "Notify me when ready" toast and an external link to LinkedIn's developer docs. No form, no save. |
| **TikTok**, **Meta Ads**, **Meta Pixel**, **Google Analytics 4**, **YouTube Data API**, **Telegram**, **Replicate**, **Anthropic Claude**, **Connecteur MCP** | None of these have any UI, configuration form, save flow, or database backing in this codebase. |
| Token columns / secret storage | `sh.sh_social_accounts` has `access_token`, `refresh_token`, `token_expires_at`, `external_id` columns — defined but **unused**. No row has ever been inserted. Storage would be plaintext as defined; Supabase Vault is not configured. |
| Per-company scoping | The schema model exists (`company_id` foreign keys on `sh_social_accounts`, `sh_meta_connections`, `sh_linkedin_connections`), but since nothing writes to those tables, no scoping is happening yet. |

---

## 3. Field-by-field answers to your questions

Each row below is the most honest answer given the codebase as it stands.

| Question | Answer |
|---|---|
| **The form fields the Configurer button reveals** | No "Configurer" button exists. The Accounts page's Meta card has no form. |
| **What Enregistrer does in code** | No "Enregistrer" button exists. |
| **Which handler does Save call?** | N/A — no such handler exists. |
| **Does it write to the database?** | No write code exists. The Accounts page only mutates `CompanyData.meta` and `CompanyData.linkedin` *in memory* via `lib/connection-store.ts` (`setMeta`, `disconnectMeta`). Mock store only — nothing reaches Supabase. |
| **Does it validate credentials against the platform API first?** | No external API call is made by any code in the repo. There is no Facebook Graph, Instagram Basic Display, LinkedIn Marketing, TikTok, GA4, YouTube, Telegram, Anthropic, Replicate, or MCP client library imported in `package.json`. (`dependencies`: `@supabase/ssr`, `@supabase/supabase-js`, `date-fns`, `next`, `react`, `react-day-picker`, `react-dom`.) |
| **Are tokens encrypted before storage?** | N/A — no tokens are stored. If the unused `sh_social_accounts.access_token` / `.refresh_token` columns were ever populated, they are plain `text` columns: no `pgcrypto`-wrapped value, no Vault key reference, no application-level encryption code. |
| **What does it return on success vs. failure?** | N/A. The Accounts page never produces an "Échec de l'enregistrement." error message — that string is **not in the codebase**. If you saw that exact French error, it came from a different app. |
| **Why did Enregistrer fail when I clicked it on the Facebook card with empty fields?** | I cannot answer from this repo — this button does not exist here. **The error you observed is generated by some other application or service.** Best guesses: another Next.js app on the same Vercel project, a different repository sharing the same Supabase backend, or a now-deleted/local prototype. Worth searching by the literal "Échec de l'enregistrement." string in whichever app you were actually viewing. |
| **Status display logic — Non configuré / Mode simulé / Configuré** | None of these three status strings exist in the codebase. `git grep` across every branch returns no matches. The Accounts page shows `Connected` / `Not connected` (English), driven by a boolean `meta?.connected` from the in-memory mock. |
| **Disconnect / re-enter flow** | The Meta card has a Disconnect → confirmation modal flow that updates mock state only (commit `74354a4` *Wire Accounts screen interactivity*). After disconnect, the card flips to a dashed "Not connected" variant with a **disabled** Connect button. There is no re-credential-entry form. |
| **Token expiry / refresh handling** | None. There is no token refresh logic, no scheduled job, no edge function, no client-side timer. The `sh_social_accounts.token_expires_at` column is unused. |
| **Per-company scoping** | The Accounts page is per-company in the UI sense — it reads from the active company context in the top-bar switcher and writes to that company's mock `meta` / `linkedin` slot. But because nothing is persisted, scoping has no real effect across sessions. The DB columns that *would* establish scoping (`sh_social_accounts.company_id`, `sh_meta_connections.company_id`, `sh_linkedin_connections.company_id`) are defined and FK-constrained, just unused. |
| **Readiness assessment per connector** | All 12 are **not implemented** in this repository. The Accounts page covers Meta (Facebook + Instagram together) and LinkedIn only, and both are at the "UI exists but purely cosmetic / no backend" level — closer to (c) in your taxonomy. The remaining 10 connectors aren't present at any level. |

---

## 4. Tables in the live database that would back this feature (if it existed here)

Per `CURRENT_STATE.md` §3, the database already has six tables that could anchor a connectors feature, none touched by the frontend:

| Table | Schema | Rows | Used? |
|---|---|---|---|
| `sh_social_accounts` | `public` | 0 | No |
| `sh_connections` | `public` | 0 | No |
| `sh_channel_connections` | `public` | 0 | No |
| `sh_social_accounts` | `sh` | 0 | No |
| `sh_meta_connections` | `sh` | 0 | No |
| `sh_linkedin_connections` | `sh` | 0 | No |
| `sh_api_keys` | `public` | 0 | No |

None contain rows. None has a write code path in this repository. If the "Échec de l'enregistrement." error came from a different app that *does* try to write here, look at the dev-open RLS posture on the `public.sh_*` set (`USING (true)`, see `CURRENT_STATE.md` §3) — that wouldn't reject inserts on its own, so the error would have to come from a missing column, a wrong-type value, an external API call timing out, or client-side validation.

---

## 5. What it would take to actually have this page

If `/parametres-connecteurs` is the page you want to *build* (vs. the page you thought existed), here's the rough shape, given how the rest of the repo is organized:

1. A route: `app/(general)/parametres-connecteurs/page.tsx`, listed under the Sidebar's "General" group (`components/shell/Sidebar.tsx`).
2. A per-connector definition table (the 12 you listed) — most natural in the code as a small constants file, since each is distinct.
3. A per-connector form modal — fields differ per provider (e.g., LinkedIn needs OAuth, GA4 needs a service-account JSON, Telegram needs a bot token + chat ID, Anthropic / Replicate need API keys, "Connecteur MCP" presumably wants an endpoint URL + auth token).
4. A backend store: pick **one** of the existing tables and retire the others (decision flagged in `CURRENT_STATE.md` §3). Most likely candidate is `sh.sh_social_accounts` for token-bearing platforms and a new `sh.sh_api_keys`-equivalent for raw-API connectors like Anthropic/Replicate/Telegram.
5. Secret handling: switch to Supabase Vault for token columns before writing real secrets.
6. Edge functions: at least one per OAuth provider to handle the redirect callback (the in-app `/auth/callback` is for Supabase Auth and is not reusable).
7. Localization: if the page should be French-only, decide whether you also want full app i18n; right now there's none.

---

## 6. Honest disclaimer

I worked exclusively from this repository's `main` plus all 16 outstanding branches, the live Supabase database, and the deployed edge-function list. If the application you were testing is hosted elsewhere or uses a different repo, this document does not describe it.

If you can share where you saw the "Échec de l'enregistrement." error — a URL, a screenshot showing the host, a deploy log, or the repo it came from — I can do a real connector-state audit against that codebase.

---

*Generated 2026-06-02 from branch `claude/auth-supabase` HEAD (`f8c3443`). No code was modified to produce this document.*
