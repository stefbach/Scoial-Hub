-- 0014_approval_workflow.sql
--
-- WORKFLOW DE VALIDATION (retour client Rosiane, point #5).
--
-- Optionnel, par société : « le Community Manager crée et programme les
-- publications, puis le responsable marketing les vérifie et les approuve
-- avant publication ». Repose sur le rôle déjà existant (sh_memberships.role
-- owner/admin/member) — aucune nouvelle notion de rôle : un « responsable »
-- est simplement un owner/admin de l'organisation, un « Community Manager »
-- un member.
--
-- Pas de nouveau statut à contrainte stricte : `sh_scheduled_posts.status`
-- est une colonne text libre (aucun check constraint en base), la valeur
-- 'pending_approval' s'y ajoute donc sans migration de schéma pour la
-- colonne elle-même — seule la logique applicative (routes API) sait la
-- produire/interpréter.

alter table public.sh_companies
  add column if not exists approval_workflow_enabled boolean not null default false;

-- Motif du refus (ou note d'approbation), affiché au Community Manager pour
-- qu'il sache quoi corriger sans devoir redemander en Slack/email.
alter table public.sh_scheduled_posts
  add column if not exists approval_note text;
