-- ── Leads Meta (Lead Ads) ────────────────────────────────────────────────────
-- Remplace Zapier : les leads Facebook/Instagram (leads_retrieval) arrivent en
-- temps réel via /api/inbox/webhook (field "leadgen") et sont stockés ici.
-- Cohérence avec sh_inbox_messages : policy permissive `sh_dev_all` (l'autorisation
-- réelle est appliquée à la couche API via requireCompanyAccess).

create table if not exists public.sh_leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.sh_companies(id) on delete cascade,
  -- Id natif Meta du lead (leadgen_id) : idempotence d'ingestion.
  leadgen_id text not null,
  page_id text,
  form_id text,
  ad_id text,
  adgroup_id text,
  -- Champs du formulaire aplatis en clé/valeur (nom, email, téléphone…).
  field_data jsonb not null default '{}'::jsonb,
  -- Charge brute Graph API (created_time, field_data non aplati, etc.).
  raw jsonb not null default '{}'::jsonb,
  lead_created_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sh_leads_company_idx
  on public.sh_leads(company_id, created_at desc);

-- Ingestion idempotente : un même lead natif n'entre qu'une fois.
create unique index if not exists sh_leads_leadgen_id_uniq
  on public.sh_leads(leadgen_id);

alter table public.sh_leads enable row level security;

drop policy if exists sh_dev_all on public.sh_leads;
create policy sh_dev_all on public.sh_leads for all using (true) with check (true);
