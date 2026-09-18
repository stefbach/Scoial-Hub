-- 0018_video_credit_packs.sql
--
-- CRÉDITS VIDÉO ACHETÉS — additifs au quota mensuel de la formule (0011).
--
-- Structure de prix uniquement : aucun paiement réel n'est branché ici (pas de
-- Stripe). Cette migration pose la mécanique — colonne de solde + journal
-- auditable + fonction d'octroi atomique — pour qu'un futur webhook de
-- paiement n'ait qu'à appeler `sh_grant_video_credits`, sans toucher au reste
-- du pipeline de quota.
--
-- Pourquoi ADDITIF et pas un override : `sh_companies.video_seconds_quota`
-- (0011) REMPLACE le quota de la formule (geste commercial, essai). Un crédit
-- payé ne doit jamais effacer ce qui est déjà inclus dans l'abonnement — d'où
-- une colonne séparée, purement additive (cf. lib/quota/video-seconds.ts).
--
-- Tarif appliqué (lib/plans.ts, VIDEO_CREDIT_RATE_*) : 75 Rs / 1,50 € la
-- seconde-crédit, UNIQUE quel que soit le modèle (inclus ou premium) —
-- vérifié contre les coûts réels fournisseurs en septembre 2026, marge ≥ ×4
-- sur le cas le plus cher du catalogue (Veo 3 avec son). Réservé aux formules
-- Studio et Agence (PLAN_ALLOWS_PREMIUM_VIDEO) pour débrider les modèles
-- premium ; les crédits eux-mêmes s'appliquent à toute génération.

alter table public.sh_companies
  add column if not exists purchased_video_credits int not null default 0;

-- ── Journal des octrois ──────────────────────────────────────────────────────
-- Une ligne par octroi (achat, geste commercial, remboursement…) — jamais
-- écrasée, pour que le solde de `sh_companies` reste toujours reconstituable
-- et vérifiable a posteriori (audit, litige de facturation).
create table if not exists public.sh_video_credit_grants (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.sh_companies(id) on delete cascade,
  credits     int  not null,
  source      text not null,           -- 'pack:<id>' | 'manual' | 'goodwill' | 'refund'…
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists sh_video_credit_grants_company_idx
  on public.sh_video_credit_grants (company_id, created_at desc);

alter table public.sh_video_credit_grants enable row level security;

-- ── Octroi ATOMIQUE ──────────────────────────────────────────────────────────
-- Incrémente le solde ET journalise dans la même transaction : un octroi ne
-- peut jamais être enregistré sans que le solde bouge, ni l'inverse.
create or replace function public.sh_grant_video_credits(
  p_company uuid,
  p_credits int,
  p_source  text,
  p_note    text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'sh_grant_video_credits: p_credits doit être strictement positif (reçu %)', p_credits;
  end if;
  if p_source is null or length(trim(p_source)) = 0 then
    raise exception 'sh_grant_video_credits: p_source requis';
  end if;

  insert into public.sh_video_credit_grants (company_id, credits, source, note)
  values (p_company, p_credits, p_source, p_note);

  update public.sh_companies
     set purchased_video_credits = purchased_video_credits + p_credits
   where id = p_company
  returning purchased_video_credits into v_balance;

  if not found then
    raise exception 'sh_grant_video_credits: société % introuvable', p_company;
  end if;

  return v_balance;
end;
$$;

-- Accès service_role uniquement — même raisonnement que 0012 : Postgres
-- accorde EXECUTE à PUBLIC par défaut sur une fonction nouvellement créée, et
-- PostgREST l'exposerait en RPC appelable avec la clé publique sinon (un
-- appelant pourrait alors s'octroyer des crédits lui-même).
revoke execute on function public.sh_grant_video_credits(uuid, int, text, text)
  from public, anon, authenticated;
grant execute on function public.sh_grant_video_credits(uuid, int, text, text)
  to service_role;
