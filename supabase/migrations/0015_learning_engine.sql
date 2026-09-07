-- 0015_learning_engine.sql
--
-- MOTEUR D'APPRENTISSAGE (quantitatif, bayésien) — distinct de la mémoire
-- stratégique textuelle (sh_strategy_memory, RAG-lite pour les prompts LLM).
-- Ici, on apprend statistiquement quelle option ("bras") performe le mieux
-- par tenant et par dimension (ex. dimension='ad_campaign', arm_key=id de
-- campagne), via Thompson Sampling sur une loi Beta(alpha, beta).
--
-- Prior neutre Beta(1,1) : alpha=1, beta=1 (équivalent loi uniforme, aucune
-- donnée). Chaque résultat mesuré (reward dans [0,1]) incrémente alpha de
-- `reward` et beta de `1-reward` — alpha+beta-2 est donc exactement le nombre
-- d'échantillons ayant contribué à ce bras (pas de colonne n_samples séparée
-- à garder synchronisée).
--
-- Accès SERVEUR uniquement (service-role) : RLS activée sans policy, comme
-- sh_render_jobs — aucun accès client direct, tout passe par nos routes API.

create table if not exists public.sh_learning_arms (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  dimension   text not null,   -- 'time_slot' | 'ad_campaign' | 'creative_format' | 'ad_audience' | 'ad_budget_tier' | …
  arm_key     text not null,   -- identifiant de l'option apprise (ex. id de campagne, "tue-18")
  alpha       double precision not null default 1,
  beta        double precision not null default 1,
  updated_at  timestamptz not null default now()
);

create unique index if not exists sh_learning_arms_unique
  on public.sh_learning_arms(company_id, dimension, arm_key);

alter table public.sh_learning_arms enable row level security;
-- Pas de policy : seul le client service-role (serveur) accède à la table.

-- Journal d'audit immuable de chaque résultat mesuré ayant nourri l'apprentissage.
-- Permet de reconstituer/auditer a posteriori pourquoi un bras a la valeur
-- alpha/beta qu'il a (traçabilité — même exigence que pour un flux financier).
create table if not exists public.sh_learning_events (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null,
  dimension    text not null,
  arm_key      text not null,
  reward       double precision not null,
  raw_metrics  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists sh_learning_events_lookup_idx
  on public.sh_learning_events(company_id, dimension, arm_key, created_at desc);

alter table public.sh_learning_events enable row level security;
-- Pas de policy : seul le client service-role (serveur) accède à la table.
