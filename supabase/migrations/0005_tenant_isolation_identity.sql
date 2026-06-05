-- ── Isolation multi-tenant (phase 1) — tables d'IDENTITÉ ────────────────────
-- Problème : les tables sh_* avaient une policy permissive `sh_dev_all USING (true)`,
-- donc la clé `anon` (publique, présente dans le navigateur) pouvait lire/énumérer
-- TOUTES les sociétés/organisations/profils de TOUS les clients en contournant l'API.
--
-- Correctif : RLS stricte par organisation sur les tables d'identité. Le service_role
-- (client serveur « admin ») contourne la RLS — les chemins serveur (console admin,
-- création de société, bootstrap) continuent donc de fonctionner ; l'autorisation
-- multi-tenant y est imposée par les routes (app/api/companies).
--
-- Le navigateur (rôle authenticated) ne lit en direct que sh_memberships (sa propre
-- ligne) ; la policy ci-dessous l'autorise via auth.uid().

-- Fonctions d'aide (security definer → contournent la RLS en interne, pas de récursion)
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.sh_memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.company_in_my_org(target_company uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.sh_companies c
    join public.sh_memberships m on m.org_id = c.org_id
    where c.id = target_company and m.user_id = auth.uid()
  );
$$;

-- sh_companies : seules les sociétés de MON organisation
drop policy if exists sh_dev_all on public.sh_companies;
create policy sh_org_scoped on public.sh_companies for all
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- sh_organizations : seulement MON organisation
drop policy if exists sh_dev_all on public.sh_organizations;
create policy sh_org_scoped on public.sh_organizations for all
  using (public.is_org_member(id)) with check (public.is_org_member(id));

-- sh_memberships : ma propre appartenance (ou celles de mon org)
drop policy if exists sh_dev_all on public.sh_memberships;
create policy sh_org_scoped on public.sh_memberships for all
  using (user_id = auth.uid() or public.is_org_member(org_id))
  with check (user_id = auth.uid() or public.is_org_member(org_id));

-- sh_brand_profiles : profil rattaché à une société de mon org
drop policy if exists sh_dev_all on public.sh_brand_profiles;
create policy sh_org_scoped on public.sh_brand_profiles for all
  using (public.company_in_my_org(company_id)) with check (public.company_in_my_org(company_id));

-- sh_onboarding_state : idem
drop policy if exists sh_dev_all on public.sh_onboarding_state;
create policy sh_org_scoped on public.sh_onboarding_state for all
  using (public.company_in_my_org(company_id)) with check (public.company_in_my_org(company_id));
