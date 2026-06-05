-- ── Inbox & agents conversationnels ────────────────────────────────────────
-- Agents qui répondent aux messages (commentaires, DM, mentions) sur les réseaux.
-- Un agent « pour tout » (scope='all') ou un agent par canal (scope='channel').
-- Chaque agent répond dans la voix de la marque (« son maître ») et SAIT
-- escalader vers un humain quand c'est nécessaire.
--
-- Cohérence avec le reste du schéma sh_* : policy permissive `sh_dev_all`
-- (l'autorisation réelle est appliquée à la couche API via requireCompanyAccess,
-- qui passe par le service_role). Voir docs/AUDIT.md (RLS = dette connue).

-- 1) Configuration des agents de réponse
create table if not exists public.sh_inbox_agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.sh_companies(id) on delete cascade,
  name text not null,
  -- 'all' : un seul agent gère tous les canaux. 'channel' : agent dédié à des canaux.
  scope text not null default 'all',
  -- Canaux couverts quand scope='channel' (facebook, instagram, linkedin, telegram…).
  channels text[] not null default '{}',
  enabled boolean not null default true,
  -- 'suggest' : rédige un brouillon à valider. 'auto' : envoie seul si confiant.
  autonomy text not null default 'suggest',
  -- Persona / instructions du « maître » : ton, do/don't, périmètre de réponse.
  persona text,
  -- 'auto' (langue du message) | 'fr' | 'en'.
  language text not null default 'auto',
  -- Seuil de confiance en dessous duquel on bascule vers un humain (0..1).
  confidence_threshold numeric not null default 0.7,
  -- Mots/sujets qui forcent toujours la main humaine (plainte, juridique, remboursement…).
  escalation_keywords text[] not null default '{}',
  -- Signature ajoutée en fin de réponse (optionnelle).
  signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sh_inbox_agents_company_idx on public.sh_inbox_agents(company_id);

-- 2) Messages entrants à traiter
create table if not exists public.sh_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.sh_companies(id) on delete cascade,
  channel text not null,
  -- Id natif du message/commentaire côté plateforme (idempotence d'ingestion).
  external_id text,
  -- 'comment' | 'dm' | 'mention' | 'review'.
  kind text not null default 'comment',
  author_name text,
  author_handle text,
  text text not null default '',
  permalink text,
  -- 'pending' | 'answered' | 'needs_human' | 'ignored'.
  status text not null default 'pending',
  -- 'positive' | 'neutral' | 'negative' | 'question' (estimé par l'IA).
  sentiment text,
  received_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sh_inbox_messages_company_idx
  on public.sh_inbox_messages(company_id, status, received_at desc);
-- Ingestion idempotente : un même message natif n'entre qu'une fois.
create unique index if not exists sh_inbox_messages_external_uniq
  on public.sh_inbox_messages(company_id, channel, external_id)
  where external_id is not null;

-- 3) Réponses (suggérées par l'agent ou écrites par un humain)
create table if not exists public.sh_inbox_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.sh_inbox_messages(id) on delete cascade,
  company_id uuid not null references public.sh_companies(id) on delete cascade,
  agent_id uuid references public.sh_inbox_agents(id) on delete set null,
  body text not null default '',
  -- 'ai' | 'human'.
  generated_by text not null default 'ai',
  confidence numeric,
  -- L'IA estime qu'un humain doit reprendre la main.
  needs_human boolean not null default false,
  -- Justification (pourquoi escalade, ou note sur la réponse).
  reason text,
  -- 'suggested' | 'sent' | 'rejected'.
  status text not null default 'suggested',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists sh_inbox_replies_message_idx on public.sh_inbox_replies(message_id);
create index if not exists sh_inbox_replies_company_idx on public.sh_inbox_replies(company_id);

-- RLS : aligné sur les autres tables sh_* (policy permissive, gate réel à l'API).
alter table public.sh_inbox_agents enable row level security;
alter table public.sh_inbox_messages enable row level security;
alter table public.sh_inbox_replies enable row level security;

drop policy if exists sh_dev_all on public.sh_inbox_agents;
drop policy if exists sh_dev_all on public.sh_inbox_messages;
drop policy if exists sh_dev_all on public.sh_inbox_replies;

create policy sh_dev_all on public.sh_inbox_agents for all using (true) with check (true);
create policy sh_dev_all on public.sh_inbox_messages for all using (true) with check (true);
create policy sh_dev_all on public.sh_inbox_replies for all using (true) with check (true);
