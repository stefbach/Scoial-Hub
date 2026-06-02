# CONNECTORS — API & connecteurs Social Hub

Référence complète des intégrations nécessaires. Organisation par domaine.
Cohérence garantie avec `.env.example`.

---

## 1. Publication organique & paid — Meta (Facebook / Instagram)

### 1.1 Meta Graph API (publication organique)

**À quoi ça sert :** publier des posts sur les Facebook Pages et comptes Instagram Business liés, planifier du contenu, lire les insights organiques des publications.

**Permissions OAuth requises (app review obligatoire) :**

| Permission | Usage | App Review |
|---|---|---|
| `pages_manage_posts` | Créer / planifier / supprimer des posts Facebook | Oui |
| `pages_read_engagement` | Lire les métriques organiques (likes, comments, reach) | Oui |
| `pages_show_list` | Lister les Pages gérées par l'utilisateur | Oui |
| `instagram_basic` | Accès de base au compte IG Business | Oui |
| `instagram_content_publish` | Publier des images/videos/reels sur Instagram | Oui |
| `instagram_manage_insights` | Lire les insights des publications IG | Oui |
| `instagram_manage_comments` | Modérer les commentaires | Oui |

**Prérequis Meta :**
- Application Meta déclarée en mode **Live** (pas Development).
- La Page Facebook doit être connectée à un **Business Manager**.
- L'utilisateur OAuth doit avoir le rôle **Admin** ou **Editor** sur la Page.
- **System User** recommandé : créer un System User dans Business Manager et lui générer un token long-lived (60 jours) pour éviter les expirations de token utilisateur.

**Variables d'env :**
```
META_APP_ID=
META_APP_SECRET=
META_API_VERSION=v21.0          # mettre à jour au fil des dépréciations
```
Les tokens OAuth par compte sont stockés dans la table `social_accounts` (colonnes `access_token`, `refresh_token`, `token_expires_at`).

**Effort d'intégration :** Moyen. Le flux OAuth + token refresh + upload media en deux étapes (upload → publish) est documenté mais verbeux.

**Pièges :**
- App Review prend 2–5 jours ouvrés, parfois plus pour les permissions santé — anticiper.
- Instagram exige un container upload → publish asynchrone (polling du status).
- Les tokens utilisateur expirent en 60 jours ; les tokens System User sont long-lived mais doivent être régénérés manuellement.
- La version d'API (`META_API_VERSION`) est dépréciée tous les ~18 mois. Mettre une alerte.
- Les politiques Meta sur la santé (Health & Wellness) peuvent restreindre certaines publicités même avec les permissions accordées.

---

### 1.2 Meta Marketing API (publicités payantes)

**À quoi ça sert :** créer et gérer des campagnes, ad sets, ads (`campaigns`, `ad_sets`, `ads` en DB) ; gérer les audiences (`audiences`, colonne `meta_audience_id`) ; suivre le spend vs budget (`ad_safety`).

**Permissions OAuth requises :**

| Permission | Usage | App Review |
|---|---|---|
| `ads_management` | CRUD complet sur les campagnes/ad sets/ads | Oui |
| `ads_read` | Lecture des métriques paid (CPM, CPC, ROAS, spend) | Oui |
| `business_management` | Accès Business Manager pour System Users | Oui |
| `pages_manage_ads` | Associer une Page à des publicités | Oui |

**Prérequis Meta :**
- Compte publicitaire (`act_XXXXXXX`) actif dans Business Manager.
- Moyen de paiement valide attaché au compte pub.
- System User avec rôle **Admin** sur le compte publicitaire pour les opérations automatisées.

**Variables d'env :**
```
META_APP_ID=
META_APP_SECRET=
META_API_VERSION=v21.0
```
Les tokens par compte et les identifiants externes (`meta_campaign_id`, `meta_ad_set_id`, `meta_ad_id`) sont dans les tables `campaigns`, `ad_sets`, `ads`.

**Effort :** Élevé. La création d'une ad nécessite : campagne → ad set (targeting, budget) → creative (upload image/video) → ad. Chaque étape a ses propres règles de validation.

**Pièges :**
- Les créatives santé/médecine sont soumises à une revue humaine Meta supplémentaire (1–3 jours).
- Le budget cap local (`ad_safety.monthly_cap`) doit être vérifié **avant** chaque appel d'activation — ne pas déléguer ça uniquement à Meta.
- `lifetime_budget` et `daily_budget` sont mutuellement exclusifs au niveau ad set.
- Les audiences Custom Audience nécessitent acceptation des CGU Custom Audience par l'admin du compte pub.

---

### 1.3 Meta Pixel + Conversions API (CAPI)

**À quoi ça sert :** mesurer les conversions web (prises de rdv, formulaires de contact) et alimenter le machine learning Meta pour l'optimisation des campagnes. La CAPI envoie les événements côté serveur (meilleure fiabilité qu'un pixel seul face aux bloqueurs).

**Architecture recommandée :**
```
Navigateur → Meta Pixel (client-side)
                     +
Serveur Next.js → CAPI via Supabase Edge Function ou API route → Meta Graph API /events
```

**Variables d'env :**
```
META_APP_ID=
META_APP_SECRET=
# Pixel ID et token CAPI à ajouter dans .env.example (non encore listés) :
META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
```

**Effort :** Moyen. SDK Meta Pixel côté client + appel Graph API `/pixel_id/events` côté serveur.

**Pièges :**
- En santé, certains événements (ex : `Lead` avec des paramètres sensibles) peuvent être bloqués par les politiques Meta. Utiliser des événements génériques (`PageView`, `Contact`, `Schedule`).
- Déduplication obligatoire entre pixel client et CAPI : utiliser `event_id` identique des deux côtés.
- RGPD : consentement utilisateur requis avant activation du pixel.

---

## 2. Publication organique & paid — LinkedIn

### 2.1 LinkedIn Pages API (publication organique)

**À quoi ça sert :** publier des posts sur les Pages LinkedIn des marques.

**Scopes OAuth requis :**

| Scope | Usage |
|---|---|
| `w_organization_social` | Publier sur une Page Organisation |
| `r_organization_social` | Lire les posts et métriques organiques |
| `rw_organization_admin` | Gérer les paramètres de Page |

**Variables d'env :**
```
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
# Token OAuth par compte dans social_accounts.access_token
```

**Effort :** Moyen. Flux OAuth 3-legged standard. Les tokens expirent en 60 jours, rafraîchissement via refresh token.

**Pièges :**
- L'accès à l'API LinkedIn Pages nécessite un **Partner Program** approuvé pour certaines fonctionnalités avancées — vérifier les niveaux d'accès.
- Les médias doivent être uploadés via un endpoint dédié avant la publication.
- Les taux de quota sont stricts : 100 req/jour par app par défaut.

### 2.2 LinkedIn Marketing API (publicités)

**À quoi ça sert :** créer et gérer des campagnes sponsorisées LinkedIn (Sponsored Content, Message Ads).

**Scopes supplémentaires :**
- `r_ads`, `w_ads`, `r_ads_reporting`

**Effort :** Élevé. API moins mature que Meta. Prioriser en P2 sauf si LinkedIn est un canal paid prioritaire pour Cabo Verde Medical ou Tibok.

---

## 3. Analytics & mesure

### 3.1 Google Analytics 4

**À quoi ça sert :** mesurer le trafic web issu des campagnes organic et paid via UTM, alimenter le reporting (`history_items.metrics`, `campaigns.metrics`).

**Variables d'env :**
```
GA4_PROPERTY_ID=
# Clé de compte de service Google (JSON) — à ajouter :
GOOGLE_SERVICE_ACCOUNT_KEY=
```

**API utilisée :** Google Analytics Data API v1 (`analyticsdata.googleapis.com`).

**Effort :** Faible à moyen. SDK client Google disponible. Requêtes en lecture seule.

**Pièges :**
- Les données GA4 ont un délai de 24–48h pour les rapports standard ; Data API en temps réel disponible mais limitée.
- Service Account à créer dans Google Cloud Console + autoriser dans GA4.

### 3.2 UTM — paramètres de tracking

**À quoi ça sert :** attribuer chaque publication (organique et payant) à sa source dans GA4 et les tableaux de bord internes.

**Convention recommandée :**
```
utm_source=facebook|instagram|linkedin
utm_medium=organic|paid
utm_campaign={campaign_name}
utm_content={ad_name|post_id}
utm_term={brand_code}    # OCC|TBK|CVMI
```

**Implémentation :** génération automatique des UTM dans les API routes de planification, stockage dans `scheduled_posts.body` (liens) ou `ads.destination_url`.

**Effort :** Faible. Pur traitement de chaîne côté serveur.

---

## 4. Backend / Infra

### 4.1 Supabase

**À quoi ça sert :** base de données PostgreSQL (schéma multi-tenant complet dans `0001_init.sql`), authentification (Auth), stockage des médias (Storage), Edge Functions (workers serverless Deno), cron jobs via `pg_cron`.

**Services utilisés :**

| Service Supabase | Usage dans Social Hub |
|---|---|
| **Database** | Toutes les tables (campagnes, posts, audiences, audit_log…) |
| **Auth** | Connexion utilisateurs, JWT, RLS via `auth.uid()` |
| **Storage** | Upload et CDN des médias (images, vidéos générées) |
| **Edge Functions** | Workers pour cron publication, agents IA async, webhooks |
| **pg_cron** | Planification des publications toutes les minutes |
| **Realtime** | Abonnements WebSocket (statut des publications en live) |
| **Vault** | Chiffrement des tokens OAuth (`social_accounts.access_token`) |

**Variables d'env :**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # serveur uniquement — ne jamais exposer au client
```

**Effort :** Faible (infrastructure déjà configurée). Edge Functions : moyen.

**Pièges :**
- `SUPABASE_SERVICE_ROLE_KEY` bypass le RLS — ne l'utiliser que dans des contextes serveur de confiance (API routes, Edge Functions).
- Activer Supabase Vault pour chiffrer les tokens OAuth plutôt que de les stocker en clair.
- `pg_cron` doit être activé manuellement dans les extensions du projet.
- Les Edge Functions ont une limite de temps d'exécution (60s par défaut) — les tâches longues (génération vidéo) doivent être asynchrones.

### 4.2 Vercel

**À quoi ça sert :** hébergement Next.js 14, déploiement continu, Cron Jobs Vercel (alternative à pg_cron pour les tâches périodiques).

**Configuration requise :**
- Variables d'env à configurer dans le dashboard Vercel (mirror de `.env.local`).
- Vercel Cron Jobs : définir dans `vercel.json` pour la publication planifiée si on n'utilise pas Supabase Edge Functions.

**Effort :** Faible (projet Next.js natif Vercel).

**Pièges :**
- Les API Routes Next.js sur Vercel ont un timeout de 10s (plan Hobby) ou 300s (Pro). Les appels IA long doivent passer en streaming ou en jobs asynchrones.
- `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais apparaître dans les variables `NEXT_PUBLIC_*`.

---

## 5. IA — Génération de contenu

### 5.1 Anthropic (Claude)

**À quoi ça sert :** génération de texte (posts, captions, hooks), check de conformité santé (API routes `/api/ai/generate-post` et `/api/ai/compliance` déjà en place).

**Variables d'env :**
```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
```

**Effort :** Faible (déjà intégré).

### 5.2 Génération d'images

**Variable d'env :** `REPLICATE_API_TOKEN`, `OPENAI_API_KEY`, `FAL_KEY` (au choix — voir `docs/AI-STACK.md`).

**Effort :** Faible à moyen selon le provider.

### 5.3 Génération de vidéos

**Variables d'env :** `RUNWAY_API_KEY`, `LUMA_API_KEY`, `FAL_KEY` (Kling via fal.ai).

**Effort :** Moyen. Les APIs vidéo sont asynchrones (polling ou webhook).

---

## 6. Outils périphériques disponibles en MCP (leviers existants)

Ces outils sont déjà branchés dans l'environnement de développement via le protocole MCP. Ils peuvent être utilisés directement depuis les agents IA sans développement d'intégration supplémentaire.

| Outil MCP | Usage potentiel dans Social Hub |
|---|---|
| **Apollo.io** | Ciblage B2B : recherche de prospects (médecins, cliniques) pour les campagnes LinkedIn ; enrichissement d'audiences ; synchronisation avec les Custom Audiences Meta |
| **Canva** | Génération de créas publicitaires à partir de templates de marque ; export direct vers les formats Meta/LinkedIn sans passer par un modèle d'image IA custom |
| **Google Drive** | Stockage et récupération des assets (logos, chartes graphiques, vidéos sources) ; partage avec l'équipe |
| **Gmail** | Envoi de notifications (digest quotidien `ad_safety.daily_digest`, alertes conformité) |
| **Google Calendar** | Planification éditoriale visuelle ; synchronisation du calendrier de publication |

Ces MCP sont exploitables dans des Supabase Edge Functions ou des API routes via des appels tooling Claude (tool use).

---

## Tableau récapitulatif — priorités

| Connecteur | Priorité | Bloquant pour… |
|---|---|---|
| **Supabase DB / Auth / Storage** | P0 | Tout — persistance, auth, médias |
| **Meta Graph API** (publication organique FB/IG) | P0 | Publication organique, planification automatisée |
| **Anthropic Claude** | P0 | Génération texte, conformité santé |
| **Meta Marketing API** (campagnes paid) | P0 | Module Paid — campagnes, ad sets, ads |
| **Meta Pixel + CAPI** | P1 | Attribution, optimisation ML des campagnes |
| **Génération images** (Replicate/fal.ai/OpenAI) | P1 | Créas visuelles, ads images |
| **Google Analytics 4** | P1 | Reporting web, attribution UTM |
| **Vercel Cron / Supabase Edge Functions cron** | P1 | Publication planifiée automatisée |
| **LinkedIn Pages API** (organique) | P1 | Publication LinkedIn |
| **Génération vidéo** (Runway/Luma/Kling) | P2 | Reels, ads vidéo IA |
| **LinkedIn Marketing API** (paid) | P2 | Campagnes paid LinkedIn |
| **Apollo.io MCP** | P2 | Ciblage B2B, enrichissement audiences |
| **Canva MCP** | P2 | Créas no-code depuis templates de marque |
| **Google Drive / Gmail / Calendar MCP** | P2 | Notifications, planning éditorial |
| **Supabase Vault** | P1 | Sécurité tokens OAuth en production |
