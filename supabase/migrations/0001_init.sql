-- ============================================================
-- Social Hub — schéma initial
-- Multi-tenant : organization → companies (marques) → entités
-- RLS activé partout, accès via appartenance à l'organisation.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Organisations & membres ─────────────────────────────────
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','admin','editor','viewer')),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Helper : l'utilisateur courant est-il membre de l'org ?
create or replace function is_org_member(target_org uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

-- ── Marques (companies) ─────────────────────────────────────
create table companies (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  code                  text not null,
  name                  text not null,
  brand_voice           text default '',
  accent                text default '#2563eb',
  logo_url              text,
  default_platforms     text[] default '{}',
  default_posting_time  text,
  default_needs_review  boolean default false,
  created_at            timestamptz not null default now()
);
create index on companies(org_id);

-- ── Comptes sociaux connectés ───────────────────────────────
create table social_accounts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  platform      text not null check (platform in ('facebook','instagram','linkedin')),
  account_name  text not null,
  status        text not null default 'active' check (status in ('active','expired','revoked')),
  -- jetons OAuth chiffrés au repos (à gérer via Vault / colonne chiffrée)
  access_token  text,
  refresh_token text,
  token_expires_at timestamptz,
  external_id   text,
  created_at    timestamptz not null default now()
);
create index on social_accounts(company_id);

-- ── Bibliothèque de templates ───────────────────────────────
create table templates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  platform    text not null,
  tags        text[] default '{}',
  body        text not null default '',
  status      text not null default 'unused' check (status in ('unused','used','archived')),
  media       jsonb default '{"kind":"none","ready":false}'::jsonb,
  added_date  date default current_date,
  created_at  timestamptz not null default now()
);
create index on templates(company_id);

-- ── Posts planifiés / brouillons ────────────────────────────
create table scheduled_posts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  platform        text not null,
  title           text not null default '',
  body            text default '',
  date            date,
  time            text,
  source          text not null default 'manual' check (source in ('automation','manual')),
  status          text not null default 'scheduled' check (status in ('draft','scheduled','publishing','published','failed')),
  needs_review    boolean default false,
  automation_name text,
  media           jsonb,
  published_at    timestamptz,
  external_id     text,
  created_at      timestamptz not null default now()
);
create index on scheduled_posts(company_id, status);

-- ── Automations ─────────────────────────────────────────────
create table automations (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  name              text not null,
  social_account_id uuid references social_accounts(id) on delete set null,
  platform          text not null,
  days              text[] default '{}',
  time              text,
  library_name      text,
  tag_filter        text[] default '{}',
  on_empty          text default 'pause_and_alert' check (on_empty in ('pause_and_alert','loop','auto_generate')),
  status            text not null default 'active' check (status in ('active','library_low','paused')),
  enabled           boolean not null default true,
  config            jsonb default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index on automations(company_id);

-- ── Historique de publication ───────────────────────────────
create table history_items (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  platform        text not null,
  body            text default '',
  full_body       text,
  source          text,
  automation_name text,
  status          text not null check (status in ('published','failed')),
  scheduled_at    timestamptz,
  published_at    timestamptz,
  metrics         jsonb,
  external_url    text,
  media           jsonb,
  error           jsonb,
  created_at      timestamptz not null default now()
);
create index on history_items(company_id, status);

-- ── Audiences (Paid) ────────────────────────────────────────
create table audiences (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  type              text not null check (type in ('saved','custom','lookalike')),
  name              text not null,
  description       text default '',
  detail            text default '',
  reach             text,
  in_use            int default 0,
  config            jsonb default '{}'::jsonb,
  meta_audience_id  text,
  created_by        text,
  created_at        timestamptz not null default now(),
  last_synced_at    timestamptz
);
create index on audiences(company_id);

-- ── Campagnes / AdSets / Ads (Paid) ─────────────────────────
create table campaigns (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  objective       text,
  platforms       text[] default '{}',
  status          text not null default 'paused' check (status in ('active','paused')),
  enabled         boolean not null default true,
  spend           numeric default 0,
  budget          numeric default 0,
  daily_budget    numeric,
  lifetime_budget numeric,
  start_date      date,
  end_date        date,
  metrics         jsonb default '{}'::jsonb,
  meta_campaign_id text,
  created_at      timestamptz not null default now()
);
create index on campaigns(company_id, status);

create table ad_sets (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  name            text not null,
  placement       text,
  targeting       text,
  audience_id     uuid references audiences(id) on delete set null,
  daily_budget    numeric,
  lifetime_budget numeric,
  budget_type     text default 'daily' check (budget_type in ('daily','lifetime')),
  optimization_goal text,
  status          text default 'paused' check (status in ('active','paused')),
  enabled         boolean default true,
  start_date      date,
  end_date        date,
  metrics         jsonb default '{}'::jsonb,
  meta_ad_set_id  text,
  created_at      timestamptz not null default now()
);
create index on ad_sets(campaign_id);

create table ads (
  id              uuid primary key default gen_random_uuid(),
  ad_set_id       uuid not null references ad_sets(id) on delete cascade,
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  name            text not null,
  headline        text,
  body_text       text,
  cta             text,
  destination_url text,
  source          text check (source in ('ai_generated','uploaded')),
  ai_model        text,
  format          text,
  dimensions      text,
  status          text default 'paused' check (status in ('active','paused')),
  metrics         jsonb default '{}'::jsonb,
  meta_ad_id      text,
  created_by      text,
  created_at      timestamptz not null default now(),
  last_synced_at  timestamptz
);
create index on ads(campaign_id);
create index on ads(ad_set_id);

-- ── Réglages sécurité pub & connexions ──────────────────────
create table ad_safety (
  company_id            uuid primary key references companies(id) on delete cascade,
  monthly_cap           numeric default 5000,
  used_this_month       numeric default 0,
  require_budget_cap    boolean default true,
  confirm_ai_spend      boolean default true,
  double_confirm_threshold numeric default 500,
  daily_digest          boolean default true
);

create table connections (
  company_id  uuid primary key references companies(id) on delete cascade,
  meta        jsonb,
  linkedin    jsonb
);

-- ── Journal d'audit (traçabilité agents IA + humains) ───────
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id) on delete cascade,
  actor       text not null,            -- 'user:<id>' ou 'agent:<name>'
  action      text not null,
  entity      text,
  entity_id   text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);
create index on audit_log(company_id, created_at desc);

-- ============================================================
-- RLS — accès réservé aux membres de l'organisation propriétaire
-- ============================================================
alter table organizations  enable row level security;
alter table memberships    enable row level security;
alter table companies      enable row level security;
alter table social_accounts enable row level security;
alter table templates      enable row level security;
alter table scheduled_posts enable row level security;
alter table automations    enable row level security;
alter table history_items  enable row level security;
alter table audiences      enable row level security;
alter table campaigns      enable row level security;
alter table ad_sets        enable row level security;
alter table ads            enable row level security;
alter table ad_safety      enable row level security;
alter table connections    enable row level security;
alter table audit_log      enable row level security;

-- Organisations : visibles par leurs membres
create policy org_member_read on organizations
  for select using (is_org_member(id));

create policy membership_self on memberships
  for select using (user_id = auth.uid() or is_org_member(org_id));

-- Companies : membres de l'org
create policy companies_rw on companies
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- Helper : retrouver l'org d'une company pour les tables enfants
create or replace function company_in_my_org(target_company uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from companies c
    where c.id = target_company and is_org_member(c.org_id)
  );
$$;

-- Politiques génériques pour les tables liées à une company
create policy social_accounts_rw on social_accounts for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy templates_rw on templates for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy scheduled_posts_rw on scheduled_posts for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy automations_rw on automations for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy history_items_rw on history_items for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy audiences_rw on audiences for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy campaigns_rw on campaigns for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy ad_safety_rw on ad_safety for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy connections_rw on connections for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));
create policy audit_log_rw on audit_log for all
  using (company_in_my_org(company_id)) with check (company_in_my_org(company_id));

-- ad_sets / ads : via la campagne parente
create policy ad_sets_rw on ad_sets for all using (
  exists (select 1 from campaigns c where c.id = ad_sets.campaign_id and company_in_my_org(c.company_id))
) with check (
  exists (select 1 from campaigns c where c.id = ad_sets.campaign_id and company_in_my_org(c.company_id))
);
create policy ads_rw on ads for all using (
  exists (select 1 from campaigns c where c.id = ads.campaign_id and company_in_my_org(c.company_id))
) with check (
  exists (select 1 from campaigns c where c.id = ads.campaign_id and company_in_my_org(c.company_id))
);
