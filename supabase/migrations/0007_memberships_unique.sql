-- 0007_memberships_unique.sql
-- Unicité (org, utilisateur) sur sh_memberships : requise par les upserts
-- d'équipe/invitations (ON CONFLICT (org_id, user_id)). Additif.
alter table public.sh_memberships
  add constraint sh_memberships_org_user_key unique (org_id, user_id);
