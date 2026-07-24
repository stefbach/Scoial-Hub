# AXON-AI · Social Media

**SaaS multi-tenant de pilotage social media assisté par IA.** Des agents IA analysent le marché, créent le contenu, vérifient la conformité, publient sur Meta & LinkedIn, répondent aux messages, et optimisent la publicité — sous le contrôle de l'utilisateur.

- **Stack** : Next.js 14 (App Router) · TypeScript strict · Tailwind · React 18 · Supabase (Postgres + Auth + RLS + Storage) · Anthropic Claude · Replicate.
- **Déploiement** : Vercel (limite fonctions 60 s).
- **Domaine de prod** : `https://scoial-hub.vercel.app`

---

## 1. Ce que fait le produit

| Domaine | Page | Description |
|---|---|---|
| **Démarrage assisté** | `/demarrage` | Profil de marque en 6 étapes (site web + Meta/LinkedIn/TikTok + descriptif) → analyse IA (positionnement, ton, audience, thèmes, objectifs). |
| **Multi-sociétés** | `/comptes` | L'utilisateur crée lui-même N sociétés (marques), chacune avec son profil, ses connexions, ses campagnes. |
| **Mes Pages Meta** | `/pages-meta` | Page FB/IG connectée : données réelles, posts, **publication organique** (FB/IG), **publication via Ads**, **analyse stratégique IA**. |
| **Espace LinkedIn** | `/linkedin` | Compte connecté, **publier en tant que** profil **ou Page entreprise**, stratégie de contenu IA. |
| **Studio Article LinkedIn** | `/article-linkedin` | Mots-clés/texte → **prompt personnalisé éditable** → article pro → **visuels HD multi-formats** → **aperçu prêt à publier** → publication. RAG **opt-in** (écriture libre par défaut). |
| **Studio Créatif** | `/studio-video` | Visuels (Flux) et vidéos (Veo-3/MiniMax) générés aux bons formats ; rendus **enregistrés en Médiathèque**. |
| **Studio Affiches** | `/studio-affiche` | Affiches A4/A3 + visuels réseaux (fond IA ou image, texte, logo, charte) ; export PNG + **enregistrement en Médiathèque**. |
| **Médiathèque** | `/media` | Galerie des **visuels & vidéos réels** de la marque (générés partout). Actions : **Créer une pub** (lien pré-rempli), **Décliner** (img2img Flux Kontext), ajout par URL. |
| **Modèles de posts** | `/library` | Bibliothèque de **modèles de contenu (texte)** + génération en masse (distincte de la Médiathèque). |
| **Composer** | `/compose` | Composition multi-réseaux, programmation, IA texte + visuels **multi-formats** (Meta/TikTok/LinkedIn), **lanceur d'agent**. |
| **Messagerie & agents** | `/inbox` | Agents qui répondent aux **commentaires + DM** (FB/IG) dans la voix de marque, **escalade humaine** automatique. |
| **Veille / Pubs concurrentes** | `/veille`, `/publicites` | Collecte + analyse des pubs/contenus concurrents → mémoire stratégique. |
| **Publicité Meta** | `/campaigns`, `/campaigns/new`, `/ad-performance` | **Création de vraie pub Meta** (assistant chat ou formulaire) : image / **carrousel** / **vidéo** / **formulaire de prospects**, ciblage (pays, âge, genre, **intérêts**, **audiences**, placements), **conversions (pixel)**, budget quotidien/à vie — créée **EN PAUSE**, **activation** explicite. Perfs **réelles** (KPI + graphe + tableau) + **Cerveau Pub** + **Pilote Pub** (optimisations applicables). |
| **Centre de pilotage** | `/pilotage` | Poste de commande **données réelles** : perf pub Meta (30 j), abonnés/engagement/portée/vues organiques (FB/IG), veille, recommandations d'agents, liens vers tous les outils, **lanceur d'agent**. |
| **Agents IA** | `/agents` | 8 agents (orchestrateur, stratège, copywriter, créatif, media buyer, analyste, conformité, publisher). Le **créatif génère un vrai visuel** (enregistré en Médiathèque), le **media buyer** fournit un lien prêt-à-créer la campagne. **Lançables depuis n'importe quelle page** (Campagnes, Compose, Performance, Pilotage). |
| **Console admin** | `/admin` | Création des comptes utilisateurs (auth séparée par cookie signé). |

### Le « cerveau » (RAG + LLM)
Une **mémoire stratégique persistante** (RAG-lite, `sh_strategy_memory` + `sh_strategy_brief`) accumule les insights de la veille, des pubs et des Pages. Elle est **réinjectée** dans la génération de contenu et le **Cerveau Pub** (`/api/meta/ads-strategy`), qui fusionne la performance réelle + la veille concurrents + le profil de marque pour produire des recommandations chiffrées — et **réécrit ses conclusions dans le RAG** (boucle d'apprentissage).

### Création de pub assistée par IA (`/campaigns/new`)
- **Assistant conversationnel** (`/api/meta/ads/assist`) : on décrit la campagne en langage naturel, l'IA pose une question si besoin puis **remplit tout le formulaire** (objectif, budget, calendrier, ciblage, intérêts résolus en ids Meta, texte, **visuel auto-généré multi-formats**, formulaire de prospects, événement de conversion) selon les **règles Meta**. Bouton « Créer directement (EN PAUSE) ».
- **Sécurité monétaire** : tout est créé **EN PAUSE** (aucune dépense) ; l'**activation** est une action explicite avec re-vérification d'appartenance du compte et **plafond de budget** (`META_ADS_MAX_DAILY_CENTS`).

### Pilote Pub (optimisation continue)
`/api/meta/ads/pilot` lit la **performance réelle** et propose des **actions concrètes** (pause / ajustement de budget / activation) taguées « sûre » ou « dépense » ; `/api/meta/ads/apply` les **applique** avec garde-fous (pause/baisse = direct, activation/hausse = confirmation). UI : composant **Pilote Pub** sur `/ad-performance`.

### Médiathèque & génération de visuels
- Table `sh_media_assets` + `/api/media` : **toute génération** (page campagne, article LinkedIn, studios, agents — toute route passant un `companyId`) **enregistre l'asset** ; réutilisable partout.
- `/api/ai/generate-image` : multi-modèles avec repli, **multi-formats** (1:1, 4:5, 9:16, 1.91:1), gestion du throttling Replicate (429), et **img2img** (paramètre `imageUrl` → Flux Kontext) pour **décliner** un visuel existant.
- `/campaigns/new` accepte `?image=`/`?video=`/`?text=`/`?name=` → **créer une campagne depuis n'importe où** (studios, médiathèque).

---

## 2. Architecture

### Multi-tenant
```
auth.users (Supabase Auth)
  └─ sh_memberships (user_id → org_id, role)
       └─ sh_organizations
            └─ sh_companies (N marques par org)
                 └─ sh_brand_profiles, sh_channel_connections, sh_campaigns,
                    sh_inbox_*, sh_strategy_*, sh_scheduled_posts, …
```
- **Admin** crée le **compte utilisateur** (+ org + membership). La création de société côté admin reste possible en **dépannage**.
- **Client** crée ses sociétés depuis `/comptes` (route `POST /api/companies` qui résout l'org **depuis la session serveur**, jamais depuis le navigateur).

### Sécurité
- **Garde API** `lib/auth/guard.ts` — `requireCompanyAccess(companyId)` vérifie que l'utilisateur appartient à l'org de la société (anti-IDOR). Fail-closed en prod, bypass en démo / `AUTH_DISABLED`.
- **RLS** : phase 1 — les tables d'**identité** (`sh_companies`, `sh_organizations`, `sh_memberships`, `sh_brand_profiles`, `sh_onboarding_state`) sont verrouillées par organisation (`is_org_member`/`company_in_my_org`). Le repo `companies` passe par le client service-role (autz imposée par la route). Voir `supabase/migrations/0005_*`.
- **Admin** : cookie de session **signé HMAC** (`lib/admin.ts`) ; vérification compatible **Edge** dans le middleware (`lib/admin-edge.ts`, Web Crypto).
- **Tokens chiffrés au repos** : AES-256-GCM (`lib/crypto.ts`, préfixe `enc:v1:`), via `TOKEN_ENCRYPTION_KEY`.
- **Dégradation gracieuse** : sans clé (Supabase/IA/Replicate…), la couche concernée retombe sur des données simulées au lieu de planter.

### Connecteurs
- **Meta** (`lib/connectors/meta*.ts`) : Facebook Login for Business ; un OAuth connecte FB + IG + Meta Ads. Publication organique (`/api/meta/publish`), **création de pub complète** (`/api/meta/ads/publish` : campagne→ad set→créative→ad, image/carrousel/vidéo/lead form, conversions/pixel, audiences, placements, A/B — en PAUSE), **activation** (`/api/meta/ads/activate`), **pilote** (`/api/meta/ads/pilot` + `/apply`), lectures réelles (`/api/meta/ad-performance`, `/api/meta/pixels`, `/api/meta/audiences`, `/api/meta/ad-interests`, `/api/meta/leads`, `/api/meta/insights`), webhook temps réel (`/api/inbox/webhook`). Intégration **directe et multi-société** (scalable) — pas de dépendance à un MCP externe.
- **LinkedIn** : publication organique texte **et image** (Images API, upload réel) via `/api/linkedin/publish`.
- **LinkedIn** (`lib/connectors/linkedin.ts`) : OAuth ; scopes sans revue par défaut (`openid profile email w_member_social`), scopes organisation en option (`LINKEDIN_ORG_SCOPES=true`). Publication profil **ou** Page (`/api/linkedin/*`).
- **TikTok / X** : présents dans le catalogue mais pas encore de connecteur OAuth complet.

---

## 3. Variables d'environnement (Vercel)

| Variable | Rôle | Sans elle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (client) | mode démo (mock) |
| `SUPABASE_SERVICE_ROLE_KEY` | client admin serveur | guard/repos dégradés |
| `ANTHROPIC_API_KEY` | Claude (texte, analyses) | réponses « démo » |
| `REPLICATE_API_TOKEN` | images/vidéos | génération simulée |
| `NEXT_PUBLIC_APP_URL` | base des redirections OAuth | redirections cassées |
| `META_APP_ID` / `META_APP_SECRET` | OAuth + signature webhook Meta | connexion Meta simulée |
| `META_WEBHOOK_VERIFY_TOKEN` | handshake webhook Meta | webhook indisponible |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | OAuth LinkedIn | connexion LinkedIn simulée |
| `LINKEDIN_ORG_SCOPES` | demander les scopes Pages LinkedIn | profil seul |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_SECRET` | console admin | identifiants dev de secours |
| `TOKEN_ENCRYPTION_KEY` | chiffrement des tokens | stockage en clair |
| `META_ADS_MAX_DAILY_CENTS` | plafond budget pub | défaut 500000 |
| `RESEND_API_KEY` | e-mails transactionnels (invitations « Mon équipe », notifications d'accès) via Resend | e-mails non envoyés — repli : lien d'invitation copiable |
| `EMAIL_FROM` | expéditeur des e-mails (ex. `AXON-AI <no-reply@votre-domaine>`) | défaut `onboarding@resend.dev` |

> Diagnostic non secret : `GET /api/health` renvoie la **présence** (booléen) des clés + `NEXT_PUBLIC_APP_URL`.

---

## 4. Mise en route

```bash
npm install
npm run dev          # http://localhost:3000  (mode démo si Supabase absent)

npx tsc --noEmit     # typecheck
npx next build       # build de production
```

### Base de données
Les migrations sont dans `supabase/migrations/` (`0001_init`, `0002_seed`, `0003_inbox_agents`, `0005_tenant_isolation_identity`, …) ; tables notables récentes : `sh_brand_kits` (logo/charte/palette), `sh_media_assets` (médiathèque). Appliquez-les via le dashboard Supabase ou le MCP. Projet : `kgohjmivilsfoewrcovn`.

### Déploiement (Vercel)
Le projet `social-hub` se déploie automatiquement sur push de `main` (domaine `scoial-hub.vercel.app`). Workflow de dev : brancher → développer → fast-forward `main`.

---

## 5. Connexions externes (résumé opérationnel)

- **Meta** : `developers.facebook.com` → app → Facebook Login for Business → URI de redirection `…/api/connectors/{facebook,instagram}/callback` ; permissions (App Review) listées dans `docs/META_APP_REVIEW.md` (Pages, IG, Ads, messagerie). Pour le temps réel : webhook `…/api/inbox/webhook` (champs `feed`, `messages`, `comments`).
- **LinkedIn** : `linkedin.com/developers` → app → produits « Sign In with LinkedIn (OIDC) » + « Share on LinkedIn » → redirect `…/api/connectors/linkedin/callback`. Pour publier sur une **Page** : produit « Community Management » + `LINKEDIN_ORG_SCOPES=true` + reconnexion.
- **Connexion sociale (Google/Facebook)** : boutons présents ; activer le provider dans **Supabase → Authentication → Sign In / Providers** (Google : créer un client OAuth dans Google Cloud, redirect = callback Supabase).

---

## 6. Structure du dépôt

```
app/
  (general)/   pages-meta, linkedin, article-linkedin, inbox, veille, agents, pilotage, studio-affiche, studio-video, demarrage, …
  (organic)/   compose, media, library, history, …
  (paid)/      campaigns, campaigns/new, audiences, ad-performance
  admin/       console d'administration
  api/         routes serveur (meta/ads/*, meta/{insights,pixels,audiences,ad-interests,leads,ad-performance}, media, ai/*, linkedin/*, inbox/*, agents/*, companies, …)
  page.tsx     landing
components/     ads/ (AdPilot, AdStrategyBrain, MetaAdAccountsPanel), agents/ (AgentLauncher), meta/, inbox/, studio/, company/, onboarding/, help/, shell/, ui/, landing/
lib/
  auth/        guard, auth, admin(-edge)
  connectors/  meta*, linkedin, oauth-state
  repositories/ companies, channel-connections, inbox, audiences, …
  ai/          replicate, claude-json, model-catalog
  memory/      RAG stratégique
  help/        registre d'aide contextuelle bilingue
supabase/migrations/
docs/          AUDIT.md, UX_AUDIT.md, META_APP_REVIEW.md
```

---

## 7. Conventions

- **i18n inline** : `t("FR", "EN")` via `useT()` (`lib/i18n.tsx`).
- **Résolution société** : `resolveCompanyUuid(idOrCode)` — toute requête `company_id uuid` doit passer par là (alias démo `occ/tibok/cvmi`).
- **Aide contextuelle** : ajouter une entrée par route dans `lib/help/registry.ts`.
- **Honnêteté produit** : si une action est simulée (clé absente, non connecté), l'UI le dit explicitement plutôt que de faire semblant.

---

## 8. Audits & documentation

- `docs/AUDIT.md` — audit produit (P0/P1/P2, sécurité, dette).
- `docs/UX_AUDIT.md` — audit UX multi-agents (simplicité + fraîcheur de l'aide).
- `docs/META_APP_REVIEW.md` — dossier App Review Meta (permissions, vidéo, compte test).
