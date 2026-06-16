-- 0009_render_jobs.sql
-- File d'attente / suivi des rendus longs (vidéo, avatar…) côté Supabase.
-- Un job est créé au lancement du rendu ; le webhook du provider (Replicate/
-- Shotstack) le passe à 'done' (avec l'URL persistée) ou 'failed' dès que le
-- résultat est prêt — même si l'utilisateur a fermé l'onglet.
-- Accès SERVEUR uniquement (service-role) : RLS activée sans policy → aucun
-- accès client direct ; le front lit l'état via nos routes API.

create table if not exists public.sh_render_jobs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  kind           text not null,                 -- 'avatar' | 'video' | …
  provider       text not null,                 -- 'replicate' | 'shotstack'
  prediction_id  text,                          -- id de la prédiction provider
  status         text not null default 'processing'
                   check (status in ('processing','done','failed')),
  result_url     text,                          -- URL persistée du média final
  error          text,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists sh_render_jobs_company_idx    on public.sh_render_jobs(company_id, status);
create index if not exists sh_render_jobs_prediction_idx on public.sh_render_jobs(prediction_id);

alter table public.sh_render_jobs enable row level security;
-- Pas de policy : seul le client service-role (serveur) accède à la table.
