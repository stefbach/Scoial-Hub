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
-- bloquerait alors tout accès, y compris légitime. On applique donc la même
-- isolation par organisation que les autres tables sh_* rattachées à une
-- société (0005_tenant_isolation_identity.sql).

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
create policy sh_editor_projects_rw on public.sh_editor_projects for all
  using (public.company_in_my_org(company_id))
  with check (public.company_in_my_org(company_id));
