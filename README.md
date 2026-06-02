# Social Hub — DDS Group

Outil de gestion de campagnes social media pour **DDS Group**, couvrant 3 marques médicales :
- **OCC** — Obesity Care Clinic
- **TBK** — Tibok
- **CVMI** — Cabo Verde Medical International

Pilotage des campagnes organiques (Facebook, Instagram, LinkedIn) et payantes (Meta Ads, LinkedIn Ads) avec un dispositif **multi-agent IA** intégré : génération de contenu, conformité santé, media buying assisté, analyse de performance.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 14 App Router |
| Langage | TypeScript |
| Style | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| IA texte | Anthropic Claude (`@anthropic-ai/sdk`) |
| IA images | fal.ai (Flux Pro 1.1), Replicate, OpenAI Images |
| IA vidéo | fal.ai (Kling 2.0), Runway, Luma |
| Hébergement | Vercel |

L'application fonctionne en **mode mock** tant que les variables d'environnement ne sont pas configurées, ce qui permet de développer et démontrer sans backend.

---

## Prérequis

- Node.js >= 18
- npm >= 9
- Compte Supabase (pour le mode réel)
- Clé API Anthropic (pour la génération IA)

---

## Setup

### 1. Cloner et installer les dépendances

```bash
git clone <repo-url>
cd Social-Hub
npm install
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Renseigner les valeurs dans `.env.local`. L'application démarre en mode mock si les clés Supabase et Anthropic sont absentes. Voir `.env.example` pour la liste complète et les commentaires.

### 3. Initialiser la base de données Supabase (mode réel)

```bash
# Depuis le dashboard Supabase ou avec la CLI :
supabase db push
# ou appliquer manuellement :
# copier le contenu de supabase/migrations/0001_init.sql dans l'éditeur SQL Supabase
```

### 4. Lancer en développement

```bash
npm run dev
```

L'app est disponible sur [http://localhost:3000](http://localhost:3000).

---

## Commandes

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement (hot reload) |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production (après build) |
| `npm run lint` | Lint TypeScript / ESLint |

---

## Documentation technique

| Document | Contenu |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Vue d'ensemble des couches, mode mock/réel, schéma de données, roadmap par phases |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Spécification du dispositif multi-agent IA : rôles, entrées/sorties, autonomie graduée, boucle de pilotage |
| [`docs/AI-STACK.md`](docs/AI-STACK.md) | Quel modèle IA pour quoi : texte (Claude), images (Flux/Ideogram), vidéo (Kling/Veo/Runway), pipeline de production complet |
| [`docs/CONNECTORS.md`](docs/CONNECTORS.md) | Liste complète des API et connecteurs : Meta, LinkedIn, GA4, Supabase, Vercel, outils MCP — avec priorités et pièges |

---

## Structure du projet

```
app/
  (general)/     # Dashboard, companies, analytics, settings
  (organic)/     # Compose, bibliothèque, planification, historique, automations
  (paid)/        # Campagnes, ad sets, audiences, performance
  api/           # Route handlers (CRUD + IA)
components/      # Composants UI réutilisables
lib/
  repositories/  # Couche d'accès données (mock ou Supabase)
  env.ts         # Variables d'env + flags isSupabaseConfigured / isAiConfigured
  types.ts       # Types TypeScript partagés
  mock-data.ts   # Données de démonstration
supabase/
  migrations/
    0001_init.sql  # Schéma complet multi-tenant avec RLS
docs/            # Documentation technique
```
