-- 0016_learning_sync.sql
--
-- Colonne technique pour GET /api/cron/learning-sync : marque un post publié
-- une fois ses métriques réelles lues et injectées dans le moteur
-- d'apprentissage (dimension "time_slot", cf. lib/learning-engine). Évite de
-- ré-interroger indéfiniment le même post à chaque passage du cron (même
-- logique qu'un « déjà traité », sans jamais ré-publier ni re-compter deux
-- fois un même résultat dans l'apprentissage bayésien).

alter table public.sh_scheduled_posts
  add column if not exists learning_synced_at timestamptz;
