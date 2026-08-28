-- 0013_editor_projects.sql
-- Table du banc de montage — public.sh_editor_projects.
--
-- POURQUOI CETTE MIGRATION EXISTE
-- Le dépôt utilise cette table depuis l'itération 2 du banc de montage
-- (lib/repositories/editor-projects.ts), mais aucune migration ne la créait :
-- elle n'existait donc que hors versionnement, ou pas du tout selon
-- l'environnement. `create table if not exists` la rend sûre à rejouer, que la
-- table soit déjà là ou non.
--
-- Elle est accédée via le client SESSION (lib/supabase/server.ts#createClient,
-- clé anon + cookies), pas le client service-role : sans policy, RLS activée
-- bloquerait alors tout accès, y compris légitime.
--
-- La policy reprend le modèle d'accès PAR SOCIÉTÉ posé par 0006_rbac.sql —
-- pas le simple `company_in_my_org` des tables antérieures au RBAC — parce que
-- c'est celui que suit réellement `requireCompanyAccess`/`getEffectiveMode`
-- (lib/auth/guard.ts, lib/repositories/access.ts) à la porte des routes API :
-- un octroi explicite dans sh_company_access, ou l'appartenance active à
-- l'organisation de la société. Utiliser l'ancien helper ici aurait bloqué en
-- RLS un accès que la garde applicative venait d'autoriser.

create table if not exists public.sh_editor_projects (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  name        text not null default '',
  format      text not null default '9:16'
                check (format in ('9:16', '1:1', '4:5', '16:9')),
  -- Le document de projet (lib/editor/project.ts#EditorProject) fait
  -- autorité ; les colonnes name/format ne sont qu'une copie indexable.
  doc         jsonb not null default '{}'::jsonb,
  render_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sh_editor_projects_company_idx
  on public.sh_editor_projects(company_id, updated_at desc);

alter table public.sh_editor_projects enable row level security;

drop policy if exists sh_editor_projects_rw on public.sh_editor_projects;
drop policy if exists sh_editor_projects_access on public.sh_editor_projects;
create policy sh_editor_projects_access on public.sh_editor_projects for all
  using (
    exists (
      select 1 from public.sh_company_access a
      where a.company_id = sh_editor_projects.company_id and a.user_id = auth.uid()
    )
    or exists (
      select 1 from public.sh_companies c
      join public.sh_memberships m on m.org_id = c.org_id
      where c.id = sh_editor_projects.company_id and m.user_id = auth.uid() and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.sh_company_access a
      where a.company_id = sh_editor_projects.company_id and a.user_id = auth.uid()
    )
    or exists (
      select 1 from public.sh_companies c
      join public.sh_memberships m on m.org_id = c.org_id
      where c.id = sh_editor_projects.company_id and m.user_id = auth.uid() and m.status = 'active'
    )
  );
