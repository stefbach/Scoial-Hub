-- 0008_security_rls.sql
-- Nettoyage SÉCURITÉ (sans perte de données) demandé après inventaire de la base.
-- Les tables non-sh_ sont des données d'une ancienne application (télémédecine)
-- conservées telles quelles ; on se contente d'activer la Row Level Security sur
-- les tables résiduelles qui étaient exposées (RLS désactivée, signalées par
-- l'advisor Supabase). Aucune policy publique → accès service-role uniquement.
-- spatial_ref_sys (table système PostGIS) est volontairement exclue.
alter table public.patients              enable row level security;
alter table public.insurance_clients     enable row level security;
alter table public.lab_orders            enable row level security;
alter table public.laboratories          enable row level security;
alter table public.radiology_centers     enable row level security;
alter table public.rooms                 enable row level security;
alter table public.org_webhooks          enable row level security;
alter table public.leads_rdv_test_axon   enable row level security;
