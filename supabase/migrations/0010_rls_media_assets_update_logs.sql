-- 0010_rls_media_assets_update_logs.sql
--
-- SÉCURITÉ : deux tables restaient exposées à quiconque possède la clé anon de
-- l'app (advisor Supabase « rls_disabled », niveau critique) :
--   - public.sh_media_assets : bibliothèque de médias, 345 lignes, contient
--     company_id, URLs de fichiers et prompts de génération ;
--   - public.update_logs     : journal résiduel (table_name, user_id, action).
-- Sans RLS, n'importe qui pouvait les LIRE et les MODIFIER avec la seule clé
-- publique. Ces deux tables ont été créées hors migration, ce qui explique
-- qu'elles aient échappé à 0008_security_rls.sql.
--
-- Aucune policy n'est créée, volontairement — même convention que 0008 :
-- l'accès reste possible pour le rôle service_role, qui contourne la RLS.
-- Vérifié avant activation : tout le code applicatif touchant sh_media_assets
-- (lib/repositories/media.ts) passe exclusivement par createAdminClient()
-- (service_role) ; update_logs n'est référencée nulle part dans le code.
-- Activer la RLS ici ne coupe donc aucun accès légitime.
--
-- Retour arrière si besoin :
--   alter table public.sh_media_assets disable row level security;
--   alter table public.update_logs     disable row level security;

alter table public.sh_media_assets enable row level security;
alter table public.update_logs     enable row level security;
