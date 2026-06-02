# ARCHITECTURE — Vue d'ensemble de Social Hub

---

## 1. Schéma des couches

```
┌─────────────────────────────────────────────────────────────────────┐
│  COUCHE UI — Next.js 14 App Router (TypeScript + Tailwind)          │
│                                                                     │
│  app/(general)/   : dashboard, companies, analytics, settings       │
│  app/(organic)/   : compose, library, scheduled, history, automations│
│  app/(paid)/      : campaigns, ad-sets, audiences, ad-performance   │
│                                                                     │
│  components/      : composants UI réutilisables                     │
│  lib/             : stores (Zustand/état local), context, helpers   │
└────────────────────┬────────────────────────────────────────────────┘
                     │ fetch / Server Actions
┌────────────────────▼────────────────────────────────────────────────┐
│  COUCHE API — Next.js Route Handlers (app/api/)                     │
│                                                                     │
│  /api/companies          CRUD companies (multi-tenant)              │
│  /api/scheduled-posts    CRUD posts planifiés                       │
│  /api/campaigns          CRUD campagnes paid                        │
│  /api/ai/generate-post   Copywriter (Claude)                        │
│  /api/ai/compliance      Conformité santé (Claude)        [en place]│
│  /api/ai/orchestrate     Orchestrateur multi-agent        [à créer] │
│  /api/ai/generate-image  Creative images (fal.ai)         [à créer] │
│  /api/ai/generate-video  Creative vidéo (fal.ai/Runway)   [à créer] │
│  /api/ai/analyze         Analyste métriques               [à créer] │
│                                                                     │
│  lib/repositories/       Couche d'accès données                     │
│    campaigns.ts           (mock ou Supabase selon isSupabaseConfigured)│
│    companies.ts                                                     │
│    scheduled-posts.ts                                               │
└────────────────────┬────────────────────────────────────────────────┘
                     │ @supabase/supabase-js
┌────────────────────▼────────────────────────────────────────────────┐
│  COUCHE BACKEND — Supabase                                          │
│                                                                     │
│  Database (PostgreSQL)   : 15 tables, RLS par organisation          │
│  Auth                    : JWT, sessions, memberships               │
│  Storage                 : bucket "media" (images/vidéos générées)  │
│  Edge Functions (Deno)   : crons publication, webhook conformité     │
│  Realtime                : statut des publications en live (WS)     │
│  Vault                   : chiffrement tokens OAuth social_accounts  │
└──────────┬─────────────────────────────────┬───────────────────────┘
           │                                 │
┌──────────▼──────────┐          ┌───────────▼───────────────────────┐
│  CONNECTEURS         │          │  AGENTS IA                        │
│  EXTERNES            │          │                                   │
│                      │          │  Orchestrateur                    │
│  Meta Graph API      │          │  Stratège                         │
│  Meta Marketing API  │◄─────────│  Copywriter (Claude)              │
│  Meta Pixel / CAPI   │          │  Creative (fal.ai / Runway)       │
│  LinkedIn Pages API  │          │  Media Buyer (→ Meta Marketing)   │
│  LinkedIn Ads API    │          │  Analyste (→ GA4 + Meta insights) │
│  Google Analytics 4  │          │  Conformité (Claude, bloquant)    │
│  Anthropic (Claude)  │          │                                   │
│  fal.ai (Flux/Kling) │          │  (voir docs/AGENTS.md)            │
│  Runway / Luma       │          └───────────────────────────────────┘
│  Apollo.io (MCP)     │
│  Canva (MCP)         │
│  Google Drive (MCP)  │
│  Gmail (MCP)         │
└──────────────────────┘
```

---

## 2. Coexistence mode mock / mode réel

Le fichier `lib/env.ts` expose deux flags qui contrôlent la dégradation gracieuse :

```typescript
export const isSupabaseConfigured =
  Boolean(env.supabaseUrl) && Boolean(env.supabaseAnonKey);

export const isAiConfigured = Boolean(env.anthropicKey);
```

### Comportement par flag

| Flag | False (mock) | True (réel) |
|---|---|---|
| `isSupabaseConfigured` | Les repositories (`lib/repositories/`) retournent des données statiques depuis `lib/mock-data.ts` | Accès PostgreSQL via Supabase client avec RLS |
| `isAiConfigured` | Les endpoints `/api/ai/*` retournent des textes hardcodés ou des erreurs explicites | Appels réels à l'API Anthropic |
| (implicite) `REPLICATE_API_TOKEN` / `FAL_KEY` vide | L'endpoint image/vidéo retourne une erreur 503 ou un placeholder | Génération réelle via le provider configuré |

### Pattern dans les repositories

```typescript
// lib/repositories/scheduled-posts.ts (exemple)
import { isSupabaseConfigured } from '@/lib/env';
import { mockPosts } from '@/lib/mock-data';

export async function getScheduledPosts(companyId: string) {
  if (!isSupabaseConfigured) {
    return mockPosts.filter(p => p.company_id === companyId);
  }
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('company_id', companyId);
  if (error) throw error;
  return data;
}
```

Ce pattern garantit que l'app reste démontrable sans backend configuré, et passe en mode réel simplement en renseignant les variables d'env.

---

## 3. Schéma de données (résumé)

Schéma complet dans `supabase/migrations/0001_init.sql`. Relations principales :

```
organizations
  └── memberships (users ↔ orgs)
  └── companies (OCC / Tibok / CVMI)
        ├── social_accounts (tokens OAuth FB/IG/LI)
        ├── templates (bibliothèque de contenus)
        ├── scheduled_posts (file de publication)
        ├── automations (règles de planification automatique)
        ├── history_items (archive + métriques)
        ├── audiences (saved / custom / lookalike)
        ├── campaigns
        │     └── ad_sets
        │           └── ads
        ├── ad_safety (plafonds budget)
        ├── connections (tokens Meta/LinkedIn de la company)
        └── audit_log (traçabilité agents + humains)
```

RLS active sur toutes les tables : un utilisateur ne voit que les données de son organisation via la fonction `is_org_member()`.

---

## 4. Roadmap par phases

### Phase 0 — Fondations (en cours)

- [x] Schéma Supabase complet (`0001_init.sql`)
- [x] App Next.js avec mode mock fonctionnel
- [x] Génération de texte Claude (endpoint `/api/ai/generate-post`)
- [x] Variables d'env structurées (`.env.example`)
- [x] Documentation technique (`docs/`)
- [ ] Authentification Supabase Auth activée et connectée à l'UI
- [ ] RLS testée et validée sur un jeu de données réel

### Phase 1 — Connexions réelles

- [ ] OAuth Meta : flux complet (code → token → stockage chiffré `social_accounts`)
- [ ] Publication organique Meta : posts Facebook et Instagram depuis l'UI
- [ ] OAuth LinkedIn : même pattern
- [ ] Upload médias vers Supabase Storage
- [ ] Cron de publication : Supabase Edge Function ou Vercel Cron (`vercel.json` existe)
- [ ] Meta Marketing API : sync campagnes/ad sets/ads existants
- [ ] Chiffrement tokens OAuth via Supabase Vault

### Phase 2 — IA assistive (agents niveau 1)

- [ ] Génération images via fal.ai (Flux Pro 1.1)
- [ ] Génération vidéo via fal.ai (Kling 2.0) — asynchrone
- [ ] Agent Conformité santé opérationnel (endpoint `/api/ai/compliance` enrichi)
- [ ] Agent Analyste : collecte métriques GA4 + Meta Insights
- [ ] Agent Stratège : rapport hebdomadaire automatique (niveau 1)
- [ ] Agent Copywriter avec brand voice par marque + variantes A/B
- [ ] Prompt caching Anthropic sur les contextes de marque

### Phase 3 — Multi-agent (agents niveau 2)

- [ ] Orchestrateur multi-agent opérationnel (`/api/ai/orchestrate`)
- [ ] Pipeline complet : brief → texte → conformité → image → planification
- [ ] Media Buyer agent : création de campagnes Meta en semi-auto
- [ ] Intégration Apollo.io MCP : enrichissement audiences B2B
- [ ] Intégration Canva MCP : génération créas depuis templates de marque
- [ ] Digest quotidien Gmail MCP : alertes budget + performance

### Phase 4 — Autonomie (agents niveau 3)

- [ ] Automations entièrement autonomes avec garde-fous durs actifs
- [ ] Ajustements de budget temps réel par l'agent Media Buyer
- [ ] A/B testing automatique avec sélection du winner par l'Analyste
- [ ] Optimisation du planning éditorial par le Stratège en autonomie
- [ ] Reporting client automatique mensuel (Analyste → PDF → Gmail)
- [ ] Audit RGPD automatique de tous les contenus publiés

---

## 5. Sécurité et gouvernance

| Point de contrôle | Implémentation |
|---|---|
| Isolation multi-tenant | RLS Supabase par organisation (`is_org_member()`) |
| Tokens OAuth | Supabase Vault (chiffrement au repos dans `social_accounts`) |
| Clés serveur | `SUPABASE_SERVICE_ROLE_KEY` jamais en `NEXT_PUBLIC_*` |
| Budget pub | `ad_safety.monthly_cap` vérifié avant tout appel Meta Marketing API |
| Kill-switch agents | `automations.enabled = false` + `ad_safety.require_budget_cap` |
| Traçabilité | `audit_log` complet : tout acteur (humain ou agent), toute action |
| Conformité santé | Agent Conformité bloquant avant toute publication |
| Timeout IA | Edge Functions pour les tâches > 10s (vidéo, batch) |
