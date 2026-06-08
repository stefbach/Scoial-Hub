-- 0006_rbac.sql — RBAC Social Hub
-- Accès PAR SOCIÉTÉ (édition/lecture), invitations d'utilisateurs, statut
-- d'organisation (validation par l'admin générale / pilotage) + statut membre.
-- 100% additif, tables sh_ uniquement. RLS activée sans policy publique : seul le
-- service-role (routes API) y accède, comme le reste de l'app Social Hub.
-- Appliqué sur le projet Supabase via apply_migration (sh_rbac_company_access).

-- 1) Accès PAR SOCIÉTÉ (cœur du RBAC : édition vs lecture)
create table if not exists public.sh_company_access (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.sh_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'view' check (mode in ('edit','view')),
  granted_by uuid,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index if not exists sh_company_access_user_idx on public.sh_company_access(user_id);
create index if not exists sh_company_access_company_idx on public.sh_company_access(company_id);
alter table public.sh_company_access enable row level security;

-- 2) Invitations d'utilisateurs (par organisation)
create table if not exists public.sh_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.sh_organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  company_access jsonb not null default '[]'::jsonb,
  token text unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists sh_invitations_org_idx on public.sh_invitations(org_id);
create index if not exists sh_invitations_email_idx on public.sh_invitations(lower(email));
alter table public.sh_invitations enable row level security;

-- 3) Statut & abonnement d'organisation (validation par l'admin générale / pilotage)
alter table public.sh_organizations add column if not exists status text not null default 'approved' check (status in ('pending','approved','suspended'));
alter table public.sh_organizations add column if not exists plan text not null default 'trial';
alter table public.sh_organizations add column if not exists approved_at timestamptz;
alter table public.sh_organizations add column if not exists approved_by uuid;

-- 4) Statut d'appartenance (suspension d'un membre)
alter table public.sh_memberships add column if not exists status text not null default 'active' check (status in ('active','suspended'));
