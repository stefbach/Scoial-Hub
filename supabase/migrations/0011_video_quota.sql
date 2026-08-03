-- 0011_video_quota.sql
--
-- QUOTA DE VIDÉO GÉNÉRÉE PAR IA — verrou de coût.
--
-- Pourquoi : la génération vidéo (Veo 3 & co, via Replicate) est le SEUL poste
-- au coût unitaire significatif du produit — de l'ordre de plusieurs euros pour
-- 8 secondes, quand une publication complète (texte + visuel) coûte quelques
-- centimes. Sans plafond appliqué côté serveur, une seule société peut dépasser
-- le montant de son abonnement en une journée. Les publications, visuels et
-- montages restent volontairement illimités : ils ne le justifient pas.
--
-- L'unité décomptée est la SECONDE PRODUITE, pas le nombre de vidéos : un quota
-- « 8 vidéos » serait contourné en demandant des vidéos de 30 s.

-- ── Plan de la société ───────────────────────────────────────────────────────
-- `plan` porte la formule commerciale ; `video_seconds_quota` permet de forcer
-- un plafond spécifique (geste commercial, test) sans changer de plan.
alter table public.sh_companies
  add column if not exists plan text not null default 'presence';
alter table public.sh_companies
  add column if not exists video_seconds_quota int;

-- Les sociétés DÉJÀ en base sont antérieures à la tarification : les laisser
-- basculer sur le défaut 'presence' (quota 0) leur retirerait du jour au
-- lendemain un accès dont elles disposent. On les place en 'studio' ; les
-- formules réelles seront affectées au cas par cas à la souscription.
update public.sh_companies set plan = 'studio' where plan = 'presence';

-- ── Compteur mensuel ─────────────────────────────────────────────────────────
-- Une ligne par société et par mois (période 'YYYY-MM', en UTC).
create table if not exists public.sh_video_usage (
  company_id   uuid not null references public.sh_companies(id) on delete cascade,
  period       text not null,
  seconds_used int  not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (company_id, period)
);

-- ── Réservations ─────────────────────────────────────────────────────────────
-- Mémorise ce qui a été débité pour une prédiction donnée, afin de pouvoir
-- rembourser EXACTEMENT une fois si la génération échoue. La clé primaire est
-- l'identifiant de prédiction : le remboursement est idempotent et ne peut pas
-- viser la société d'un autre (l'appelant ne fournit jamais le company_id).
create table if not exists public.sh_video_reservations (
  prediction_id text primary key,
  company_id    uuid not null references public.sh_companies(id) on delete cascade,
  period        text not null,
  seconds       int  not null,
  refunded      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Accès exclusivement service_role (routes serveur) — aucune policy, comme 0008.
alter table public.sh_video_usage        enable row level security;
alter table public.sh_video_reservations enable row level security;

-- ── Réservation ATOMIQUE ─────────────────────────────────────────────────────
-- Le `for update` sérialise les demandes concurrentes d'une même société : sans
-- lui, deux requêtes simultanées liraient le même total et dépasseraient toutes
-- deux le plafond. Renvoie l'autorisation ET l'état du compteur, pour que
-- l'appelant puisse afficher un message exact sans seconde requête.
create or replace function public.sh_reserve_video_seconds(
  p_company uuid,
  p_period  text,
  p_seconds int,
  p_quota   int
)
returns table (allowed boolean, used int, quota int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  insert into public.sh_video_usage (company_id, period, seconds_used)
  values (p_company, p_period, 0)
  on conflict (company_id, period) do nothing;

  select seconds_used into v_used
    from public.sh_video_usage
   where company_id = p_company and period = p_period
     for update;

  if v_used + p_seconds > p_quota then
    return query select false, v_used, p_quota;
    return;
  end if;

  update public.sh_video_usage
     set seconds_used = seconds_used + p_seconds,
         updated_at   = now()
   where company_id = p_company and period = p_period
  returning seconds_used into v_used;

  return query select true, v_used, p_quota;
end;
$$;

-- ── Remboursement idempotent ─────────────────────────────────────────────────
-- Rend les secondes d'une prédiction qui a échoué, une seule fois.
create or replace function public.sh_refund_video_seconds(p_prediction text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select * into r
    from public.sh_video_reservations
   where prediction_id = p_prediction and not refunded
     for update;

  if not found then
    return 0;
  end if;

  update public.sh_video_usage
     set seconds_used = greatest(0, seconds_used - r.seconds),
         updated_at   = now()
   where company_id = r.company_id and period = r.period;

  update public.sh_video_reservations
     set refunded = true
   where prediction_id = p_prediction;

  return r.seconds;
end;
$$;

create index if not exists sh_video_reservations_company_idx
  on public.sh_video_reservations (company_id, created_at desc);
