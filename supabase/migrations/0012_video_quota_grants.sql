-- 0012_video_quota_grants.sql
--
-- FERMETURE D'UN CONTOURNEMENT DU QUOTA VIDÉO introduit par 0011.
--
-- Postgres accorde EXECUTE à PUBLIC sur toute fonction nouvellement créée, et
-- PostgREST expose les fonctions du schéma `public` en RPC. Les deux fonctions
-- de 0011 étaient donc appelables depuis le navigateur avec la clé publique,
-- alors qu'elles sont `security definer` et écrivent dans les compteurs :
--
--   • sh_reserve_video_seconds(company, période, secondes, QUOTA) — le plafond
--     est un ARGUMENT. Un client pouvait passer le sien et s'autoriser lui-même.
--   • sh_refund_video_seconds(prédiction) — remboursait un compteur sans autre
--     contrôle que la connaissance d'un identifiant de prédiction.
--
-- Le verrou de coût le plus soigneusement écrit ne vaut rien s'il s'appelle
-- depuis la console du navigateur. L'application n'utilise ces fonctions QUE via
-- le client service_role (lib/quota/video-seconds.ts) : les retirer aux rôles
-- publics ne retire aucune capacité réelle.
--
-- Les fonctions is_org_member / company_in_my_org de 0001 et 0005 restent, elles,
-- accessibles à `authenticated` : les politiques RLS les évaluent pour le compte
-- de l'appelant, et elles ne font que lire une appartenance qui le concerne.

revoke execute on function public.sh_reserve_video_seconds(uuid, text, int, int)
  from public, anon, authenticated;
revoke execute on function public.sh_refund_video_seconds(text)
  from public, anon, authenticated;

grant execute on function public.sh_reserve_video_seconds(uuid, text, int, int)
  to service_role;
grant execute on function public.sh_refund_video_seconds(text)
  to service_role;

-- Défense en profondeur : une réservation NÉGATIVE créditerait le compteur.
-- L'appelant applicatif borne déjà à 1 seconde minimum ; la base ne doit pas
-- dépendre de la politesse de son appelant.
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
  if p_seconds is null or p_seconds <= 0 then
    raise exception 'sh_reserve_video_seconds: p_seconds doit être strictement positif (reçu %)', p_seconds;
  end if;

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

-- `create or replace` conserve les privilèges existants : ce second retrait est
-- redondant en temps normal. Il rend la migration sûre à rejouer, et couvre le
-- cas où la fonction aurait été recréée entre-temps par un `drop` + `create`.
revoke execute on function public.sh_reserve_video_seconds(uuid, text, int, int)
  from public, anon, authenticated;
grant execute on function public.sh_reserve_video_seconds(uuid, text, int, int)
  to service_role;
