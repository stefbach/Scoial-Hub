# Social Hub — Frontend Data Inventory

> Read-only mapping of every entity the frontend reads, writes, or fakes. Use this as input for backend schema design. All field names below are the **exact** TypeScript identifiers used in the code (camelCase) — adjust to snake_case at the database layer per the existing Supabase schema reference if needed.

The screen layer lives under `app/`, mock data under `lib/`, and per-feature mutation helpers in `lib/*-store.ts`. The shared `lib/types.ts` is the single source of truth for entity shapes; `lib/mock-data.ts` is the seeded in-memory store.

---

## 1. Storage layout (where the mock data lives)

| File | Exports | Purpose |
|---|---|---|
| `lib/types.ts` | All entity interfaces and enum string unions | Single source of truth for shapes |
| `lib/mock-data.ts` | `ORG_NAME`, `COMPANIES`, `COMPANY_DATA`, `TEAM`, `ANALYTICS_SERIES`, `ANALYTICS_PLATFORM_SHARE`, `ANALYTICS_SUMMARY`, `ANALYTICS` (legacy), `AI_GENERATION_LOGS`, `AUDIT_LOG`, `makeEmptyCompanyData()`, `registerCompany()` | Seeded mock store |
| `lib/company-context.tsx` | `CompanyProvider`, `useCompany()` | React context that holds the active company id + `companies`/`addCompany`/`updateCompany` |
| `lib/draft-store.ts` | `saveDraft`, `findDraft`, `findPost`, `deletePost`, `publishPost`, `reschedulePost` | Mutations against `COMPANY_DATA[id].scheduled[]` |
| `lib/template-store.ts` | `findTemplate`, `addTemplate`, `updateTemplate`, `deleteTemplates`, `retagTemplates`, `duplicateTemplate` | Mutations against `COMPANY_DATA[id].library.templates[]` |
| `lib/automation-store.ts` | `addAutomation`, `updateAutomation`, `deleteAutomation`, `toggleAutomation`, `runAutomationNow` | Mutations against `COMPANY_DATA[id].automations.rules[]` |
| `lib/campaign-store.ts` | `hydrateCampaigns`, `buildCampaignSeries`, `findCampaign`, `updateCampaign`, `deleteCampaign`, `duplicateCampaign`, `toggleCampaign`, `findAdSet`, `addAdSet`, `updateAdSet`, `deleteAdSet`, `duplicateAdSet`, `toggleAdSet`, `findAd`, `updateAd`, `deleteAd`, `duplicateAd`, `toggleAd` | Mutations against `COMPANY_DATA[id].campaigns.list[]` (and its nested `adSets[]` + `ads[]`) |
| `lib/audience-store.ts` | `addAudience`, `findAudience`, `updateAudience`, `deleteAudience`, `duplicateAudience` | Mutations against `COMPANY_DATA[id].audiences.list[]` |
| `lib/history-store.ts` | `deleteHistoryItem`, `findHistoryItem`, `toCsv`, `toJson`, `downloadFile` | Mutations against `COMPANY_DATA[id].history[]` + shared CSV/JSON export helpers reused by Ad Performance, Analytics, Audit log |
| `lib/connection-store.ts` | `getMeta`, `setMeta`, `disconnectMeta` | Mutations against `COMPANY_DATA[id].meta` |

`COMPANY_DATA` is keyed by `company.id` and shaped as `CompanyData` (see §2 below). The `Company` summary list lives separately in the module-level `COMPANIES` array.

---

## 2. Entities — fields, types, scope, relationships

For every entity below: `(O)` = organization-scoped, `(C)` = company-scoped. Optional fields are marked `?`.

### Organization-scoped

#### `Organization`
Currently a single hard-coded value, not a structured object.
| Field | Type | Notes |
|---|---|---|
| `ORG_NAME` | `string` | Lives in `lib/mock-data.ts` as a top-level const ("DDS Group") |
| `industry` | enum: `Healthcare` / `Marketing` / `Retail` / `Education` / `Other` | Local UI state only |
| `logo` | image (object-URL) | Local UI state only — no persistence |

There is no `organizations` table object in the frontend yet; the backend should introduce one and `Company` will reference it via `org_id`.

#### `Company` (O — belongs to the org)
Defined in `lib/types.ts`, seeded in `COMPANIES`. Created/edited via `CompanyProvider.addCompany` / `updateCompany`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `"occ"`, `"tibok"`, `"cvmi"` |
| `code` | `string` | Display abbreviation: `OCC`, `TI`, `CV` |
| `name` | `string` | "Obesity Care Clinic" |
| `brandVoice` | `string` | Free text used by AI text generation |
| `accent` | `string` | Hex color used for the avatar chip |
| `logoUrl?` | `string` | Object URL — fake; real storage would be a path in the `logos` bucket |
| `defaultPlatforms?` | `Platform[]` | Subset of `facebook / instagram / linkedin` |
| `defaultPostingTime?` | `string` | `HH:mm` |
| `defaultNeedsReview?` | `boolean` | Default value applied to new posts |

#### `TeamMember` (O)
Lives in `TEAM` in `lib/mock-data.ts`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `u1` … |
| `name` | `string` | |
| `email` | `string` | |
| `role` | enum: `admin` / `editor` / `viewer` | |
| `status` | enum: `active` / `pending` | "pending" = invited but not accepted |
| `companyAccess` | `string[]` | Array of `company.id`s the user can see |

Maps to `public.users` in the existing Supabase schema. `companyAccess` is a frontend abstraction; backend can represent it as either a join table or a JSONB column.

#### `AuditEvent` (O)
Lives in `AUDIT_LOG` in `lib/mock-data.ts`. Read-only in the UI.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `a1` … |
| `timestamp` | `string` (ISO) | |
| `userId` | `string` | FK → `TeamMember.id`, or `"system"` |
| `userName` | `string` | Denormalized for display |
| `companyId` | `string \| null` | `null` = organization-wide event |
| `companyCode?` | `string \| null` | Denormalized abbreviation |
| `entity` | enum (`AuditEntity`): `post` / `campaign` / `audience` / `ad_safety` / `team` / `settings` | |
| `description` | `string` | Plain-English summary |
| `severity` | enum (`AuditSeverity`): `info` / `warning` / `danger` | |
| `before?` | JSON object | Mutation diff (e.g. `{ daily_budget: 60 }`) |
| `after?` | JSON object | |
| `ipAddress` | `string` | |
| `userAgent` | `string` | |

#### `Profile` (O — per current user)
Implemented as local state on Settings → Profile only — **no persistence object** in mock data. Fields currently captured in the UI: `name`, `email`, `avatar` (object URL), `tz` (one of 6 hard-coded zones), `lang` (`English` / `Français`), `twoFa` (boolean), plus a Change-password modal that takes `current / new / confirm`. Backend needs `users.full_name`, `users.email`, `users.avatar_url`, `users.time_zone`, `users.language`, `users.two_factor_enabled`, plus auth-managed credentials.

#### `NotificationPreferences` (O — per user)
Local state only on Settings → Notifications. Backend should persist as a `user_notification_prefs` row.

| Field | Type | Notes |
|---|---|---|
| `prefs` | `Record<string, { email: boolean; inApp: boolean }>` | Keys: `spend_digest`, `weekly`, `library_low`, `failed_post`, `anomaly`, `team_new`, `audience_sync` |
| `freq` | enum: `realtime` / `hourly` / `daily` | |
| `quietHours` | `boolean` | |
| `quietFrom` | `string` (`HH:mm`) | |
| `quietTo` | `string` (`HH:mm`) | |

#### `Subscription` (O)
Hard-coded placeholders in Settings → Organization. Fields shown: `plan` ("Free trial"), `trialDaysRemaining` (30), `nextBillingDate` (—), `paymentMethod` (not set). Backend phase; ignored for now.

---

### Company-scoped — top-level `CompanyData` keyed by `company.id`

Defined as `CompanyData` in `lib/types.ts`; each company in `COMPANY_DATA` carries an instance.

`CompanyData` is a *container* with these nested groups:
- `dashboard` — derived metric snapshot (display-only; see §3)
- `accounts` — `SocialAccount[]`
- `scheduled` — `ScheduledPost[]` (includes drafts and published shadows)
- `library` — `{ unused, runway, aiBudgetUsed, aiBudgetCap, imageSpend, videoSpend, templates[] }`
- `automations` — `{ active, paused, postsThisWeek, rules[] }`
- `history` — `HistoryItem[]`
- `campaigns` — `{ activeCampaigns, spendMtd, conversions, avgCpc, list[] }`
- `audiences` — `{ total, inUse, combinedReach, list[] }`
- `adPerformance` — `AdPerf` aggregate (display-only series; see §3)
- `adSafety` — Ad-safety settings
- `meta?` — `MetaConnection`
- `linkedin?` — `LinkedinConnection`

The "counter" wrappers (`{active, paused, total, inUse, unused, …}`) are denormalized derivations from the underlying list — see §3.

#### `SocialAccount` (C — belongs to company)
| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `occ-fb`, `ti-ig` |
| `platform` | enum (`Platform`): `facebook` / `instagram` / `linkedin` | |
| `accountName` | `string` | Display label ("OCC Facebook Page", "@occ_mauritius") |
| `status` | enum: `active` / `expired` / `revoked` | |

> Maps to the `social_accounts` table in the existing schema. Tokens (`access_token`, `refresh_token`, `token_expires_at`, `external_id`) exist in the schema but the frontend never touches them.

#### `ScheduledPost` (C)
Used as the canonical "post" entity in this codebase — it covers drafts, scheduled posts, and the published shadow created via the modal's "Publish now". Real history is stored separately as `HistoryItem` (see below).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `platform` | enum (`Platform`) | |
| `title` | `string` | Display label, often the first line of body |
| `date` | `string` (ISO `YYYY-MM-DD`) | |
| `time` | `string` (`HH:mm`) | |
| `source` | enum (`PostSource`): `automation` / `manual` | |
| `needsReview?` | `boolean` | |
| `status?` | enum: `scheduled` / `draft` / `published` (defaults to `scheduled`) | Matches the schema's broader `PostStatus`: `draft / scheduled / publishing / published / failed` |
| `body?` | `string` | Full post text |
| `automationName?` | `string` | Denormalized when `source = automation`; FK → `Automation.name` |
| `media?` | `{ kind: "image" \| "video" }` | Display-only — no link to a media row yet |
| `publishedAt?` | `string` (ISO) | Set when the user clicks "Publish now" in the detail modal |

> The schema's full `posts` table also has: `social_account_id`, `template_id`, `automation_id`, `created_by`, `reviewed_by`, `reviewed_at`, `scheduled_at`, `external_post_id`, `created_at`. The frontend does not surface them yet.

#### `Template` (C — belongs to company; nested in `library.templates`)
Lives in `COMPANY_DATA[id].library.templates`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `platform` | enum (`Platform`) | |
| `tags` | `string[]` | |
| `body` | `string` | |
| `status` | enum (`TemplateStatus`): `unused` / `used` / `archived` | |
| `addedDate` | `string` (ISO date) | |
| `media` | `TemplateMedia` | `{ kind: "image" \| "video" \| "none", ready: boolean, seconds?: number, url?: string }` |

> Maps to `post_templates`. Schema also has `social_account_id`, `tags` (comma-string), `created_by`, `used_at`. Plus `template_media` link table. Frontend currently embeds media inline.

#### `Automation` (C — belongs to company; nested in `automations.rules`)
| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `name` | `string` | |
| `account` | `string` | Denormalized display: "OCC Facebook" |
| `socialAccountId` | `string` | FK → `SocialAccount.id` |
| `platform` | enum (`Platform`) | |
| `days` | `WeekDay[]` (`mon` / `tue` / `wed` / `thu` / `fri` / `sat` / `sun`) | |
| `time` | `string` (`HH:mm`) | |
| `libraryName` | `string` | Display label |
| `tagFilter` | `string[]` | Filters which templates feed the automation |
| `onEmpty` | enum (`OnEmptyBehavior`): `pause_and_alert` / `loop` / `auto_generate` | |
| `schedule` | `string` | Display label ("Mon, Wed, Fri at 09:00") |
| `status` | enum: `active` / `library_low` / `paused` | |
| `libraryNote` | `string` | Display label |
| `next?` | `string` | Display label of next-run timestamp |
| `last?` | `string` | Display label of last-run timestamp |
| `publishedCount?` | `number` | |
| `lastRunAt?` | `string` (ISO) | Set by "Run now" |
| `pausedSince?` | `string` | |
| `warning?` | `string` | Inline alert text |
| `enabled` | `boolean` | |

#### `HistoryItem` (C; nested in `history[]`)
Render-time record. Distinct from `ScheduledPost` because the UI doesn't unify them yet. (Backend likely collapses both into the `posts` table.)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `platform` | enum (`Platform`) | |
| `body` | `string` | Truncated/teaser |
| `fullBody?` | `string` | Full text for the detail modal |
| `when` | `string` | Display label |
| `source` | `string` | `automation` or `manual` (kept as free string for flexibility) |
| `scheduledAt?` | `string` (ISO timestamp) | |
| `publishedAt?` | `string` (ISO timestamp) | |
| `automationName?` | `string` | |
| `status` | enum (`HistoryStatus`): `published` / `failed` | |
| `stats?` | `string` | Display label ("47 reactions · 3 comments") |
| `metrics?` | `{ reactions: number; comments: number; shares: number; linkClicks: number }` | Used in the Published detail modal |
| `externalUrl?` | `string` | Real public URL on the platform (mock is `#`) |
| `media?` | `{ kind: "image" \| "video" }` | |
| `error?` | `{ title: string; detail: string }` | Only when `status === "failed"` |

> Roughly matches the schema's `publish_logs` + `posts` join. Backend will likely keep history as a query view over `posts`.

#### `Campaign` (C; nested in `campaigns.list`)
Top of the ad-spend hierarchy. Populated lazily by `hydrateCampaigns()` which fills the detail-page fields with deterministic mock series.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `name` | `string` | |
| `objective` | `string` | Free text: `Awareness` / `Traffic` / `Engagement` / `Leads` / `Sales` / `Conversions` / `App promotion` |
| `platforms` | `("FB" \| "IG")[]` | |
| `status` | enum: `active` / `paused` | |
| `spend` | `number` | EUR |
| `budget` | `number` | EUR (the larger of daily or lifetime, contextually) |
| `metricsLabel` | `string` | Display label |
| `metricsValue` | `string` | Display label |
| `cplLabel?` | `string` | Display label |
| `enabled` | `boolean` | Mirrors `status === active` |
| `adSets` | `AdSet[]` | Children |
| `dailyBudget?` | `number` | Detail page |
| `lifetimeBudget?` | `number` | Detail page |
| `startDate?` | `string` (ISO date) | |
| `endDate?` | `string \| null` | `null` = no end date |
| `impressions?` | `number` | |
| `clicks?` | `number` | |
| `spendTrend?`, `impressionsTrend?`, `clicksTrend?`, `conversionsTrend?` | `string` | Display labels like `"UP 12%"` |
| `series?` | `CampaignSeries` | Per-day 30-element arrays for spend / impressions / clicks / conversions / ctr / cpc |
| `ads?` | `Ad[]` | All ads across child ad sets, flattened |

#### `AdSet` (C; child of `Campaign`)
| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `name` | `string` | |
| `placement` | `string` | Display label ("FB Feed + IG Feed + IG Stories") |
| `targeting` | `string` | Display label ("Lookalike: OCC patients") |
| `ads` | `number` | Count of child `Ad` rows |
| `dailyBudget` | `number` | EUR |
| `enabled?` | `boolean` | |
| `audienceId?` | `string` | FK → `Audience.id` |
| `audienceName?` | `string` | Denormalized |
| `audienceReach?` | `string` | Display label ("180K-220K") |
| `placementMode?` | enum: `automatic` / `advanced` | |
| `placements?` | `string[]` | Subset of `fb_feed / ig_feed / ig_stories / ig_reels / fb_reels` when `placementMode = advanced` |
| `budgetType?` | enum: `daily` / `lifetime` | |
| `lifetimeBudget?` | `number` | |
| `startDate?` | `string` (ISO) | |
| `endDate?` | `string \| null` | |
| `optimizationGoal?` | enum: `conversions` / `link_clicks` / `reach` / `impressions` | |
| `status?` | enum: `active` / `paused` | Mirrors `enabled` |
| `spend?`, `impressions?`, `clicks?`, `conversions?` | `number` | Aggregates over the window |
| `series?` | `CampaignSeries` | Per-day arrays |

#### `Ad` (C; child of `AdSet`)
| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `campaignId` | `string` | FK → `Campaign.id` |
| `adSetId` | `string` | FK → `AdSet.id` |
| `adSetName` | `string` | Denormalized |
| `name` | `string` | |
| `thumb` | `string` | Tailwind utility class for the placeholder block |
| `spend` | `number` | |
| `ctr` | `string` | e.g. `"3.8%"` |
| `conversions` | `number` | |
| `status` | enum: `active` / `paused` | |
| `headline?` | `string` | Ad copy |
| `bodyText?` | `string` | |
| `cta?` | `string` | "Book now" |
| `destinationUrl?` | `string` | |
| `source?` | enum (`AdSource`): `ai_generated` / `uploaded` | Hides the AI badge when `uploaded` |
| `aiModel?` | `string` | One of `Flux 2 Pro` / `Ideogram v3` / `GPT Image Mini` (image) or `Kling 3.0` / `Veo 3.1 Fast` (video) |
| `format?` | `string` | "FB Feed · 1.91:1" |
| `dimensions?` | `string` | "1200 × 628" |
| `createdAt?` | `string` (ISO date) | |
| `createdBy?` | `string` | Denormalized user name |
| `metaAdId?` | `string` | External ID |
| `metaAdSetId?` | `string` | External ID |
| `lastSyncedAt?` | `string` (ISO timestamp) | |

> Schema parity: `ads`, `ad_sets`, `ad_campaigns` already cover these. `ad_media` link table is not surfaced here (the frontend uses an inline `thumb` color block).

#### `Audience` (C; nested in `audiences.list`)
| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `type` | enum (`AudienceType`): `saved` / `custom` / `lookalike` | |
| `name` | `string` | |
| `description` | `string` | Display label ("Female · 35-55 · Mauritius") |
| `detail` | `string` | Display label ("Interests: weight loss, wellness, nutrition") |
| `reach` | `string` | Display label ("180K-220K") |
| `created` | `string` | Display label ("Created 12 May") |
| `inUse` | `number` | Count of ad sets currently targeting this audience |
| `config?` | object — type-specific fields below | |
| ↳ Saved | `gender`, `ageRange`, `locations[]`, `interests[]`, `behaviors[]` | All strings/string-arrays |
| ↳ Custom | `source`, `fileName`, `uploadDate` (ISO), `matchRate`, `refreshedAt` (ISO), `duplicatedFrom` | |
| ↳ Lookalike | `sourceAudienceId` (FK → `Audience.id`), `sourceAudienceName`, `similarity` ("Top 1%"), `countries[]` | |
| `lastSyncedAt?` | `string` (ISO timestamp) | |
| `usedByAdSetIds?` | `string[]` | FK array → `AdSet.id` |
| `metaAudienceId?` | `string` | |
| `createdAt?` | `string` (ISO date) | |
| `createdBy?` | `string` | |

> Maps to `ad_audiences` (`type`, `definition` JSONB, `meta_audience_id`, `estimated_reach_min/max`). The frontend's `reach` is currently a string; the schema's min/max numbers are more useful for the live estimator.

#### `MetaConnection` (C)
| Field | Type | Notes |
|---|---|---|
| `connected` | `boolean` | |
| `connectedAt?` | `string` (ISO date) | Drives the 7-day read-only safety window |
| `businessManagerName?` | `string` | |
| `facebookPageName?` | `string` | |
| `instagramHandle?` | `string` | |
| `readOnly` | `boolean` | |
| `keepReadOnlyAfterSafety` | `boolean` | User preference |

#### `LinkedinConnection` (C)
| Field | Type | Notes |
|---|---|---|
| `connected` | `boolean` | Always `false` in mock data |

#### `AdSafety` settings (C)
Lives at `COMPANY_DATA[id].adSafety`.

| Field | Type | Notes |
|---|---|---|
| `monthlyCap` | `number` | EUR |
| `usedThisMonth` | `number` | EUR — display-derived |
| `requireBudgetCap` | `boolean` | |
| `confirmAiSpend` | `boolean` | |
| `doubleConfirmThreshold` | `number` | EUR/day |
| `dailyDigest` | `boolean` | |
| `recentAudit` | `string` | Display label of the most recent audit event |

> Maps to `company_ad_safety` in the existing schema, with backend fields `read_only_mode`, `read_only_until`, `anomaly_pause_threshold_pct`, `weekly_summary_enabled` that the frontend does not yet expose.

#### `AiPreferences` (C) — partial
Local state on Settings → AI preferences; **no top-level mock object**. Fields the UI captures: `imageModel`, `videoModel`, `brandVoiceDefault` (boolean), `textCap`, `imageCap`, `videoCap` (all EUR/month). Backend has `ai_usage_limits` already covering caps + spend.

#### `AiGenLog` (C — audit-style read-only)
Lives in `AI_GENERATION_LOGS` in `lib/mock-data.ts`. Shown on Settings → AI preferences.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `companyId` | `string` | FK → `Company.id` |
| `type` | enum: `text` / `image` / `video` | |
| `description` | `string` | Display label |
| `model` | `string` | Free text |
| `prompt` | `string` | Full prompt for the detail modal |
| `costEur` | `number` | |
| `createdAt` | `string` (ISO timestamp) | |

> Maps to `ai_generation_logs` in the schema (`status`, `duration_ms`, `result_media_id`, `error_message`, `raw_response`, `style`, `request_type`, `user_id`, `ai_model`, `cost_eur` — frontend uses a flatter subset).

---

### Analytics-specific (C — daily series for the Analytics screen)

#### `AnalyticsSeries`
Lives in `ANALYTICS_SERIES` (keyed by `company.id`), defined in `lib/mock-data.ts`.

| Field | Type | Notes |
|---|---|---|
| `postsPublished` | `number[]` (30) | One value per day, most-recent last |
| `engagement` | `number[]` (30) | |
| `adSpend` | `number[]` (30) | EUR |
| `conversions` | `number[]` (30) | |

#### `ANALYTICS_PLATFORM_SHARE` (C)
| Field | Type | Notes |
|---|---|---|
| `facebook` | `number` (0..1) | Fraction of engagement attributed to FB |
| `instagram` | `number` (0..1) | |
| `linkedin` | `number` (0..1) | Always 0 (not connected) |

`ANALYTICS_SUMMARY` is a single string used as the read-only AI summary callout.

---

## 3. Screen-by-screen map

Each entry lists the entities **read** (R) or **written** (W) by that screen, plus any sub-modals it opens.

### Dashboard — `app/page.tsx`
- **Reads:** `Company` (current), `CompanyData.dashboard` (entirely display-derived)
- **Writes:** —
- **Notes:** Every card and row navigates to another screen via URL params; no mutations. All numbers come from the static `dashboard` snapshot — see §4.

### Compose — `app/(organic)/compose/page.tsx`
- **Reads:** `Company`, `CompanyData.accounts` (for the platform pills), and one of `ScheduledPost` (when `?draft=<id>` or `?post=<id>`), `Template` (when `?template=<id>`), or `HistoryItem` (when `?duplicate=<id>`) for prefill.
- **Writes:** `ScheduledPost` via `saveDraft()` (creates a row with `status: "draft"`).
- **Sub-modals:** None native; the AI text/visuals panels are display-only inputs.

### Scheduled — `app/(organic)/scheduled/page.tsx`
- **Reads:** `ScheduledPost[]` (all statuses, filtered to non-`published` by the page).
- **Writes:** via `ScheduledDetailModal` → `publishPost()`, `deletePost()`, `reschedulePost()`. Draft rows are click-throughs to Compose; non-draft rows open the modal.

### Library — `app/(organic)/library/page.tsx`
- **Reads:** `Template[]` plus the `library` wrapper (`unused`, `runway`, `aiBudgetUsed`, `aiBudgetCap`, `imageSpend`, `videoSpend`).
- **Writes:** `addTemplate()`, `updateTemplate()`, `deleteTemplates()` (bulk), `retagTemplates()` (bulk), `duplicateTemplate()`. The "Generate" CTA on an image-less card opens a sub-modal that calls `updateTemplate()` with a manual upload's object URL.
- **Sub-modals:** `BulkGenerateModal` (no writes — AI gated), `NewTemplateModal`, `TemplateDetailModal`, `GenerateImageModal`.

### Automations — `app/(organic)/automations/page.tsx`
- **Reads:** `Automation[]`, plus the `automations` wrapper (`active`, `paused`, `postsThisWeek`).
- **Writes:** `addAutomation()`, `updateAutomation()`, `deleteAutomation()`, `toggleAutomation()`, `runAutomationNow()` (the last one increments `publishedCount` and bumps `lastRunAt`/`last`).
- **Sub-modals:** `AutomationModal` (matching templates derived live from `library.templates` filtered by `tagFilter` + `platform`).

### History — `app/(organic)/history/page.tsx`
- **Reads:** `HistoryItem[]`.
- **Writes:** `deleteHistoryItem()` from the detail modal.
- **Sub-modals:** `HistoryDetailModal`. Footer "Duplicate as new post" routes to Compose with `?duplicate=<id>`.

### Campaigns (list) — `app/(paid)/campaigns/page.tsx`
- **Reads:** `Campaign[]`, plus the `campaigns` wrapper (`activeCampaigns`, `spendMtd`, `conversions`, `avgCpc`).
- **Writes:** `toggleCampaign()`, `deleteCampaign()`; the modal calls `addCampaign`-equivalent through `updateCampaign` in edit mode (the new-campaign primary in this listing currently navigates rather than persisting — kept consistent with the existing seed list).
- **Sub-modals:** `NewCampaignModal` (also reused for edit), `CreateAdModal`.

### Campaign detail — `app/(paid)/campaigns/[id]/page.tsx`
- **Reads:** one `Campaign` (with full hydrated `series` and `ads`) including nested `AdSet[]` and the rolled-up `Ad[]`.
- **Writes:** `toggleCampaign()`, `duplicateCampaign()`, `deleteCampaign()`, `updateCampaign()` (via the Edit modal), `addAdSet()`, `updateAdSet()`, `duplicateAdSet()`, `deleteAdSet()`, plus Ad mutations through the Ad detail modal (`updateAd`, `toggleAd`, `duplicateAd`, `deleteAd`).
- **Sub-modals:** `NewCampaignModal` (edit), `AdSetModal`, `AdDetailModal`.

### Ad Set detail — `app/(paid)/ad-sets/[id]/page.tsx`
- **Reads:** one `AdSet` + the subset of its parent campaign's `ads` matching `adSetId`.
- **Writes:** `toggleAdSet()`, `duplicateAdSet()`, `deleteAdSet()`, `updateAdSet()`, `toggleAd()`. The "+ New ad" CTA opens `CreateAdModal` locked to this ad set.
- **Sub-modals:** `AdSetModal`, `AdDetailModal`, `CreateAdModal`.

### Ad detail (modal — opens from Campaign detail, Ad Set detail, or Ad Performance)
- **Reads/Writes:** see `Ad` entity. Edit mode allows changing `headline`, `bodyText`, `cta`, `destinationUrl`. Footer actions: `toggleAd`, `duplicateAd`, `deleteAd`. Breadcrumb links navigate to parent campaign / ad set.

### Audiences — `app/(paid)/audiences/page.tsx`
- **Reads:** `Audience[]` plus the `audiences` wrapper (`total`, `inUse`, `combinedReach`). Filters URL-sync as `?type=`, `?status=`, `?q=`.
- **Writes:** `addAudience()`, `updateAudience()`, `deleteAudience()`, `duplicateAudience()`. The detail modal's Used-by section navigates to `/ad-sets/[id]`.
- **Sub-modals:** `AudienceDetailModal`, `NewAudienceModal` (2-step: type picker → type-specific form, with an inline "+ Create new audience" sub-flow used from `AdSetModal`).

### Ad Performance — `app/(paid)/ad-performance/page.tsx`
- **Reads:** `Campaign[]` (after `hydrateCampaigns()`) and derives a flat `AdRow[]` from every `Ad`, scaled by the active date range. The legacy `CompanyData.adPerformance` aggregate is not used here.
- **Writes:** via `AdDetailModal` (see Ad detail). The "Increase budget" CTA opens `AdSetModal` for the top performer's parent ad set.
- **Exports:** CSV/JSON of the visible rows with columns `ad_name, ad_set_name, campaign_name, platform, status, spend, impressions, clicks, ctr, cpc, conversions, cpa, period_start, period_end`.

### Analytics — `app/(general)/analytics/page.tsx`
- **Reads:** `ANALYTICS_SERIES` per company (the only place that consumes it), `ANALYTICS_PLATFORM_SHARE`, `ANALYTICS_SUMMARY`, and `COMPANIES` for the scope dropdown / bar chart.
- **Writes:** —
- **Exports:** CSV/JSON keyed on `company, posts_published, engagement, ad_spend, conversions, period_start, period_end` (+ a synthetic `Total` row in the "All companies" view).
- **Navigation:** Engagement-by-company bars re-scope the page; platform bars navigate to `/ad-performance?platform=` or `/accounts`.

### Accounts — `app/(general)/accounts/page.tsx`
- **Reads:** `MetaConnection`, `LinkedinConnection`, `TEAM` (for the toast's user-email lookup).
- **Writes:** `disconnectMeta()`, `setMeta()` (the Manage modal's `keepReadOnlyAfterSafety` toggle).
- **Sub-modals:** Disconnect confirm, Manage ads access, LinkedIn "coming soon" info.

### Settings — `app/(general)/settings/page.tsx`

Routes via `?section=` and (for audit only) `?filter / ?user / ?company / ?range`.

#### Settings → Profile — `components/settings/Profile.tsx`
- **Reads/Writes:** `Profile` (O — local state, no mock object yet). The shared `ImageUpload` writes the avatar as an object URL.
- **Sub-modals:** Change password, 2FA placeholder.

#### Settings → Notifications — `components/settings/Notifications.tsx`
- **Reads/Writes:** `NotificationPreferences` (O — local state only).

#### Settings → Organization — `components/settings/Organization.tsx`
- **Reads/Writes:** `Organization` (O — local state for name/industry/logo), reads `COMPANIES` + `TEAM` for the composition cards.
- **Sub-modals:** Delete organization (type-to-confirm) — no actual mutation.

#### Settings → Companies — `components/settings/Companies.tsx`
- **Reads:** `companies` from `CompanyProvider`.
- **Writes:** `addCompany()` and `updateCompany()` via context. The delete-name confirmation is a mock no-op.
- **Sub-modals:** Edit/New Company.

#### Settings → Team & roles — `components/settings/Team.tsx`
- **Reads/Writes:** `TeamMember[]` (mutates the shared `TEAM` array). Invite creates a row with `status: "pending"`. Edit mode disallows changing `email`. Remove deletes the row.
- **Sub-modals:** Invite, Edit member.

#### Settings → AI preferences — `components/settings/AiPrefs.tsx`
- **Reads:** `AiGenLog[]` filtered to current company, the `library` wrapper for `imageSpend`/`videoSpend`. Local state for `imageModel` / `videoModel` / `brandVoiceDefault` and the three caps.
- **Writes:** Caps update local state only (toast confirms — no mock store).
- **Sub-modals:** Per-log detail modal.

#### Settings → Ad Safety — `components/settings/AdSafety.tsx`
- **Reads/Writes:** `CompanyData.adSafety` (local form state mirrors it; explicit Save commits but currently into local state only — backend will persist). The Read-only mode toggle reads `data.meta?.readOnly`. View audit log routes to `?section=audit&filter=ad_safety`.

#### Settings → Audit log — `components/settings/AuditLog.tsx`
- **Reads:** `AUDIT_LOG`, `TEAM`, `COMPANIES`. Filters and pagination URL-sync as `?filter / ?user / ?company / ?range`.
- **Writes:** —
- **Exports:** CSV/JSON with columns `timestamp, user, company, entity, severity, description, ip_address, user_agent`.

---

## 4. Fields the UI displays but mock data fakes

These values are **computed**, **derived**, or **placeholder** in the current frontend. They should be either computed in queries/views on the backend or recorded as first-class rows — flagged here so the schema doesn't accidentally store them twice.

| Surface | Field / metric | Source |
|---|---|---|
| Dashboard top strip | `dashboard.organic.scheduled / published7d / inLibrary / failed` | Static snapshot in `COMPANY_DATA[id].dashboard`. Should be computed live from `posts` + `templates` |
| Dashboard paid strip | `dashboard.paid.spendMtd / spendCap / conversions / aiBudgetUsed / aiBudgetCap` | Static snapshot. Should come from `ad_insights` + `company_ad_safety` + `ai_usage_limits` |
| Dashboard "Top performing ad" | Single denormalized `{ platform, name, spend, ctr, conversions }` | Static. Should be a query over `ad_insights` for the rolling window |
| Library | `library.unused / runway` ("~2.5 wks") | Computed strings. `runway` is purely fictional (no formula in code) |
| Library AI budget meter | `library.aiBudgetUsed / aiBudgetCap / imageSpend / videoSpend` | Static numbers — should be `ai_usage_limits.current_period_*_spend` |
| Automations counters | `automations.active / paused / postsThisWeek` | `active`/`paused` are derived live from `rules[]`; `postsThisWeek` is static |
| Campaigns list | `metricsLabel`, `metricsValue`, `cplLabel` | Display strings only — derive from `ad_insights` on the backend |
| Campaign detail chart | `Campaign.series.{spend,impressions,clicks,conversions,ctr,cpc}` | Synthesized by `buildCampaignSeries()` using a deterministic PRNG seeded by `campaign.id`. Replace with real daily `ad_insights` joined and aggregated to the campaign |
| Ad Set detail chart | `AdSet.series` | Same as above, seeded by `adSet.id` |
| Ad rows | `Ad.ctr` (string), `Ad.spend`, `Ad.conversions` | Generated by `hydrateCampaigns()` |
| Ad Performance metrics | `totalSpend / totalImpressions / totalClicks / totalConversions / avgCpc / trend %` | All derived from the flattened ad rows × the active date window |
| Ad Performance "AI insight" | Plain-English string referencing the lowest-CPA ad | Computed in the page from the visible rows; backend should expose insights as a separate signal |
| Audiences | `Audience.reach` ("180K-220K") | Free string; the `NewAudienceModal` computes a live estimate via a formula in `components/paid/audience-form.tsx` (`estimateSavedReach`, `estimateLookalikeReach`). Backend should store `estimated_reach_min/max` numbers (schema already has them) |
| Audiences | Custom audience "row count" ("~1,200 emails detected") and "Estimated Meta match · 83%" | Mock based on file size; real values come from Meta on upload |
| Audiences combined reach | `audiences.combinedReach` ("~480K") | Static display string |
| Analytics overview cards | `postsPublished / engagement / adSpend / conversions` plus trend % | Derived in the page from `ANALYTICS_SERIES` |
| Analytics company bars | `byCompany` percentage shares | Computed live |
| Analytics platform bars | LinkedIn always renders "Not connected" | Hard-coded; should derive from `social_accounts` linkedin row state |
| Accounts page | `readOnly until` date | Computed as `meta.connectedAt + 7 days` |
| Settings → Ad Safety | `usedThisMonth` | Static value in `adSafety`; should aggregate over `ad_insights` for the current month |
| Settings → AI prefs | `textSpend` placeholder of 1.5 EUR | Hard-coded — no per-type breakdown in mock data. Backend has `ai_usage_limits.current_period_text_spend` |
| Settings → Audit log | `description` plain-English label, `companyCode` | Denormalized for display; backend can either denormalize at write time or compute in the query |
| Compose / Library / Create Ad | All AI generation buttons | Disabled with tooltips; **no real AI calls made yet** |
| Compose / Library / Create Ad | Manual uploads | Stored as `URL.createObjectURL()` in session memory only — nothing reaches the `media` Storage bucket |
| Accounts → LinkedIn | `Notify me when ready` toast | Pure UI affordance — no email actually queued |
| Settings → Subscription & billing | "Free trial · 30 days remaining" | Hard-coded placeholders |

---

## 5. Enums consolidated

Quick reference for backend `CHECK` constraints / Postgres enums:

| Enum | Values |
|---|---|
| `Platform` | `facebook` / `instagram` / `linkedin` |
| `PostStatus` (`ScheduledPost.status`) | `draft` / `scheduled` / `publishing` / `published` / `failed` |
| `PostSource` | `automation` / `manual` |
| `TemplateStatus` | `unused` / `used` / `archived` |
| `WeekDay` | `mon` / `tue` / `wed` / `thu` / `fri` / `sat` / `sun` |
| `OnEmptyBehavior` | `pause_and_alert` / `loop` / `auto_generate` |
| `Automation.status` | `active` / `library_low` / `paused` |
| `HistoryStatus` | `published` / `failed` |
| `Campaign.status` | `active` / `paused` (the schema also has `draft`, `completed`, `archived`) |
| `Campaign.objective` (string) | `Awareness` / `Traffic` / `Engagement` / `Leads` / `Sales` / `Conversions` / `App promotion` |
| `AdSet.placementMode` | `automatic` / `advanced` |
| `AdSet.placements` (multi-select) | `fb_feed` / `ig_feed` / `ig_stories` / `ig_reels` / `fb_reels` |
| `AdSet.budgetType` | `daily` / `lifetime` |
| `AdSet.optimizationGoal` | `conversions` / `link_clicks` / `reach` / `impressions` |
| `Ad.status` | `active` / `paused` |
| `AdSource` | `ai_generated` / `uploaded` |
| `AudienceType` | `saved` / `custom` / `lookalike` |
| `SocialAccount.status` | `active` / `expired` / `revoked` |
| `TeamMember.role` | `admin` / `editor` / `viewer` |
| `TeamMember.status` | `active` / `pending` |
| `AuditEntity` | `post` / `campaign` / `audience` / `ad_safety` / `team` / `settings` |
| `AuditSeverity` | `info` / `warning` / `danger` |
| `AiGenLog.type` | `text` / `image` / `video` |
| `MediaKind` (used inline) | `image` / `video` / (`none` on templates) |
| `Notifications.freq` | `realtime` / `hourly` / `daily` |
| `Industry` (Settings → Organization) | `Healthcare` / `Marketing` / `Retail` / `Education` / `Other` |
| `Language` (Settings → Profile) | `English` / `Français` |

---

## 6. Relationships summary

```
organization
  └─ company (O→C, many)
       ├─ social_account (C, many)               — platform tied to one company
       ├─ template (C, many)
       │     └─ template_media (link, future)
       ├─ automation (C, many)                   — references one social_account
       ├─ post / scheduled_post (C, many)        — optional refs to template + automation + social_account
       │     └─ post_media (link, future)
       ├─ history_item (C, many)                 — likely a query view over posts; refs the same parents
       ├─ campaign (C, many)
       │     └─ ad_set (C, many)                  — refs one audience
       │           └─ ad (C, many)
       │                 └─ ad_media (link, future)
       ├─ audience (C, many)                     — referenced by ad_sets via audience_id
       │     └─ audience.config.sourceAudienceId — self-reference for lookalikes
       ├─ ad_insight (C, many)                   — schema only; not used by the frontend directly
       ├─ company_ad_safety (C, one-per-company) — matches CompanyData.adSafety
       ├─ ai_usage_limits   (C, one-per-company) — matches CompanyData.library budget fields
       ├─ ai_generation_log (C, many)            — matches AiGenLog
       ├─ meta_connection   (C, one)             — embedded in CompanyData.meta
       └─ linkedin_connection (C, one)           — embedded in CompanyData.linkedin

user (org-scoped)
  └─ companyAccess[] → company.id (many-to-many)

audit_event (org-scoped; nullable companyId)    — refs user + entity by id; no FK constraints in the frontend
```

### FK names actually used in the code

| From | Field | Points to |
|---|---|---|
| `Automation` | `socialAccountId` | `SocialAccount.id` |
| `ScheduledPost` | `automationName` (denormalized) | `Automation.name` |
| `AdSet` | `audienceId` | `Audience.id` |
| `Ad` | `campaignId`, `adSetId` | `Campaign.id`, `AdSet.id` |
| `Audience.config` | `sourceAudienceId` | `Audience.id` (lookalike → custom/saved) |
| `Audience` | `usedByAdSetIds[]` | `AdSet.id[]` |
| `TeamMember` | `companyAccess[]` | `Company.id[]` |
| `AuditEvent` | `userId`, `companyId` | `TeamMember.id` (or `"system"`), `Company.id` (or `null`) |
| `AiGenLog` | `companyId` | `Company.id` |

---

## 7. Notable gaps (frontend does not yet model these even though the Supabase schema does)

- **`publish_logs`** (per-attempt log per post) — the frontend collapses success/failure into `HistoryItem.error?`.
- **`ad_insights`** (per-day metrics per ad) — the frontend synthesizes series via `buildCampaignSeries()` and per-row scaling.
- **`post_media`, `template_media`, `ad_media`, `media_assets`** — the frontend uses inline `media: { kind }` placeholders and tailwind tints. Manual uploads use object URLs.
- **`access_token` / `refresh_token` / `token_expires_at` / `external_id`** on `social_accounts` — never touched in the UI.
- **`reviewed_by` / `reviewed_at`** on posts — the UI only surfaces a `needsReview?` flag.
- **`scheduled_at`** as a timestamp (the frontend stores `date` + `time` separately).
- **Per-day `current_period_text_spend`** etc. on `ai_usage_limits` — only image/video are tracked in mock data, text spend is hard-coded.
- **`anomaly_pause_threshold_pct`**, **`weekly_summary_enabled`**, **`read_only_until`** on `company_ad_safety` — exist in the schema, not surfaced.
- **Subscription / billing** — placeholder strings only.
