# AXON-AI · Social Media

SaaS multi-tenant qui pilote la présence sociale (organique **et** publicité payante)
de plusieurs marques via une équipe d'**agents IA**. De l'analyse d'identité à la
publication réelle sur Meta, en passant par une **veille concurrentielle** et une
**mémoire stratégique persistante** qui nourrit les campagnes.

> Stack : **Next.js 14 (App Router) · TypeScript strict · Tailwind · React 18 ·
> Supabase (Postgres + Auth + Storage) · Anthropic Claude · déploiement Vercel.**

---

## 1. Démarrage rapide (dev)

```bash
npm install
cp .env.example .env.local   # renseigner les variables (voir §6)
npm run dev                  # http://localhost:3000
npx tsc --noEmit             # type-check
npx next build               # build de prod
```

**Sans aucune variable** : l'app tourne en **mode démo** (données mock, auth désactivée).
Chaque service s'active dès que sa variable d'environnement est présente
(« dégradation gracieuse » — voir §6).

### Workflow Git / déploiement
- Branche de dev : `claude/keen-newton-SKspQ`.
- Déploiement : **fast-forward de `main`** → Vercel déploie automatiquement.
- Build **avant** chaque commit. Limite Vercel : **fonctions = 60 s** (garder les
  routes lourdes sous 60 s, sinon `504 FUNCTION_INVOCATION_TIMEOUT`).

---

## 2. Concept produit (le fil conducteur)

L'app n'est pas une boîte à outils éparpillée mais **un parcours assisté unique** :

1. **Démarrage** (`/demarrage`) — assistant 6 étapes, état persistant, reprise possible :
   1. **Identité** : site + comptes sociaux + descriptif → l'IA produit un *profil de marque* ; connexion des réseaux (OAuth) dès cette étape.
   2. **Objectifs** : objectifs proposés par l'IA, canaux, nb de campagnes, **zone géo**.
   3. **Concurrence & mots-clés** : veille → alimente la mémoire stratégique.
   4. **Création** : génération autonome / banque d'images / studio produit.
   5. **Agents IA** : construisent la/les campagne(s) (consomment la mémoire).
   6. **Diffusion** : organique/payant + programmation → bascule en pilotage.
2. **Identité = une fois ; campagne = répétable** (`startNewCampaign`, `/demarrage?new=1`).
3. **Tableau de bord** = cockpit : tant que l'onboarding n'est pas terminé, il affiche
   uniquement le démarrage guidé ; ensuite, les vrais KPIs.

---

## 3. Fonctionnalités principales

| Domaine | Page(s) | Détail |
|---|---|---|
| Onboarding assisté | `/demarrage` | 6 étapes IA, persistant (`sh_onboarding_state`, `sh_brand_profiles`) |
| Cockpit | `/dashboard` | gate onboarding + KPIs réels |
| Veille concurrentielle | `/veille` | collecte + analyse Claude → mémoire stratégique |
| Pubs concurrentes | `/publicites` | Meta Ad Library (token société) + analyse IA |
| Studio créatif | `/studio-video` | génération image/vidéo par **prompt assisté IA**, **tous formats**, assemblage/marketize, **ajout à la bibliothèque** |
| Agents IA | `/agents`, `/pilotage` | orchestrateur 8 agents, autonomie L1/L2/L3 |
| Campagnes | `/campaigns` | CRUD réel (`sh_campaigns`) |
| Audiences | `/audiences` | `sh_audiences` |
| Mes Pages & données | `/pages-meta` | sélecteur de Page, données réelles FB/IG, **analyse IA**, **publication Meta Ads directe** |
| Mémoire stratégique | (transversal) | `sh_strategy_memory` + brief IA (`sh_strategy_brief`) |
| Connecteurs | `/parametres-connecteurs` | Meta (OAuth), LinkedIn, TikTok, Pixel, GA4… |
| Telegram / MCP | `/telegram`, `/mcp` | pilotage par chat / connecteur Claude |
| Admin | `/admin` | création d'utilisateurs + comptes (cookie `ADMIN_TOKEN`) |

---

## 4. Architecture du code

```
app/
  (auth)/login, signup            # auth (email + Google/Facebook OAuth)
  (general)/…                     # pages avec AppShell (dashboard via app/dashboard)
  (organic)/…                     # compose, scheduled, library, automations, history
  (paid)/…                        # campaigns, audiences, ad-performance, ad-sets
  legal/…                         # conditions, confidentialite, suppression-donnees (publiques)
  admin/…                         # console admin
  api/…                           # toutes les routes serveur
components/
  shell/         AppShell (responsive: sidebar desktop + tiroir mobile), Sidebar, ScopeBar
  onboarding/    parcours (context + 6 steps + cockpit), useOnboardingStatus
  ads/           MetaAdsPublisher (création/activation de pub réelle)
  strategy/      StrategyPanel (brief + mémoire)
  studio/        PromptStudio (génération par prompt)
  ui/            primitives partagées (Modal, Button, Dropdown, DateTimePicker…)
  settings/      sections Paramètres
lib/
  agents/        orchestrator.ts (8 agents Claude), types
  connectors/    meta.ts (OAuth FB/IG), meta-pages.ts (Pages/IG/ad-accounts/insights),
                 meta-ads.ts (publication directe), linkedin.ts, oauth-state.ts
  memory/        mémoire stratégique persistante (RAG-lite) + synthèse
  onboarding/    types + analyze.ts (analyse d'identité)
  repositories/  accès Supabase (companies, campaigns, channel-connections, onboarding,
                 company-data [agrégateur], resolve-company, scheduled-posts)
  scraping/      collectors, analyze, ad-library, ad-analyze (veille)
  video/         types (formats), marketer, render (Shotstack), cloudinary
  supabase/      client (browser) + server (SSR + admin service-role)
  env.ts         variables + flags isXxxConfigured
  i18n.tsx       useT() / t("fr","en")
  company-context.tsx  société courante + data réelle (hydratée /api/company-data)
```

### Patterns clés (à respecter)
- **`resolveCompanyUuid(idOrCode)`** : `company.id` peut être un code (`occ`,`tibok`→`OCC`,`TI`).
  Toute requête sur une colonne `company_id uuid` DOIT le résoudre (alias démo inclus).
- **Données d'affichage** : tout passe par `useCompany().data` (hydraté depuis
  `/api/company-data`, agrégateur des tables `sh_*`). Les pages lisent `data`.
- **Multi-tenant** : un utilisateur connecté avec organisation voit **uniquement**
  ses sociétés (jamais les marques de démo). Provisioning : `auth/bootstrap` (signup
  email) ou `auth/callback` (OAuth) → org + membership (espace **vierge** par défaut).
- **i18n** : toute chaîne visible = `t("FR","EN")`.
- **Modales** : toujours le composant partagé `components/ui/Modal` (scrim translucide).
- **Responsive** : mobile-first, `min-w-0`/`flex-wrap`/`truncate`, grilles préfixées.

---

## 5. Agents IA & mémoire

- **Orchestrateur** (`lib/agents/orchestrator.ts`) : `runOrchestration({objective, companyId, autonomy, …})`
  → 8 agents (stratège, copywriter, créatif, conformité, média, analyste, publisher, orchestrateur).
  L'agent créatif renvoie des **prompts** (pas de génération synchrone → évite le 504).
- **Autonomie** : L1 reco · L2 semi-auto (validation) · L3 auto sous garde-fous.
- **Mémoire stratégique** (`lib/memory`) : veille / pubs / analyse de Page **écrivent**
  leurs conclusions (`appendMemory`) ; un **brief** est synthétisé par Claude
  (`synthesizeBrief`) ; `getMemoryContext` est **injecté dans l'objectif** des agents
  → les campagnes sont fondées sur l'historique d'analyses.

---

## 6. Variables d'environnement (Vercel / `.env.local`)

| Variable | Active… | Requis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | base + auth | oui (prod) |
| `SUPABASE_SERVICE_ROLE_KEY` | provisioning admin, tâches serveur | oui (prod) |
| `ANTHROPIC_API_KEY` (`ANTHROPIC_MODEL` opt., déf. `claude-sonnet-4-6`) | toute l'IA | oui |
| `NEXT_PUBLIC_APP_URL` | **URL de redirection OAuth** (= domaine prod) | oui pour OAuth |
| `META_APP_ID` / `META_APP_SECRET` | connexion Facebook/Instagram + Ads | OAuth Meta |
| `META_API_VERSION` (déf. `v21.0`) | API Graph | non |
| `META_AD_LIBRARY_TOKEN` | veille pubs (fallback ; sinon token société) | non |
| `META_ADS_MAX_DAILY_CENTS` (déf. 500000) | plafond budget pub quotidien | non |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | connexion LinkedIn | LinkedIn |
| `REPLICATE_API_TOKEN` | génération image/vidéo (Studio) | Studio gen |
| `SHOTSTACK_API_KEY` (`SHOTSTACK_ENV=v1`) | rendu vidéo | Studio vidéo |
| `CLOUDINARY_CLOUD_NAME` | transformations image | Studio image |
| `SCRAPECREATORS_API_KEY` | **veille TOUS réseaux avec une seule clé** (IG, TikTok, YouTube, LinkedIn, Facebook, X) | veille |
| `YOUTUBE_API_KEY` | veille YouTube (API Google gratuite, prioritaire sur ScrapeCreators pour économiser des crédits) | veille |
| `XPOZ_API_KEY` | veille Instagram/TikTok (alternative à ScrapeCreators) | veille |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` | bot Telegram central | Telegram |
| `ADMIN_TOKEN` | accès console `/admin` | admin |
| `AUTH_DISABLED=true` | échappatoire : rouvre l'accès sans login | dépannage |

> ⚠️ Après toute modif de variable Vercel → **Redeploy**. Secrets jamais commités.

---

## 7. Base de données (Supabase, tables `sh_*`)

`sh_organizations`, `sh_memberships`, `sh_companies`, `sh_social_accounts`,
`sh_channel_connections` (connexions OAuth + tokens), `sh_brand_profiles`,
`sh_onboarding_state`, `sh_campaigns`, `sh_ad_sets`, `sh_ads`, `sh_audiences`,
`sh_scheduled_posts`, `sh_templates` (bibliothèque), `sh_automations`,
`sh_history_items`, `sh_strategy_memory`, `sh_strategy_brief`, `sh_competitors`,
`sh_benchmark_runs`, `sh_ad_safety`, `sh_audit_log`.

RLS : politique dev permissive `sh_dev_all (using true)` (l'app filtre par org/company).
> ⚠️ Le projet Supabase héberge AUSSI une autre app (tables non `sh_`) — **ne pas y toucher**.

---

## 8. Connexion des réseaux (Meta)

Flux **Facebook Login for Business** (OAuth) → on stocke le **token utilisateur** +
on sélectionne la **Page** (`pickPageForCompany`), le **compte Instagram** lié et le
**compte publicitaire** (`pickAdAccountForCompany`). Un seul OAuth connecte FB + IG + Ads.

- Lecture : Pages/IG insights (`/api/meta/insights`), comptes pub (`/api/meta/adaccounts`).
- **Publication payante directe** (`lib/connectors/meta-ads.ts`) : campagne → ad set
  (budget/ciblage/géo) → créative → ad, **créés EN PAUSE** ; activation **explicite**
  plafonnée (`/api/meta/ads/publish` + `/api/meta/ads/activate`).
- **Mode dev** : seuls toi + testeurs (Rôles de l'app). **Grand public** : App Review +
  Business Verification — checklist complète dans **`docs/META_APP_REVIEW.md`**.

---

## 9. Limites connues / pistes
- Publication organique multi-réseaux : Meta câblé ; LinkedIn/TikTok à finaliser (OAuth/clés).
- Génération vidéo Replicate peut dépasser 60 s → prévoir un mode asynchrone (submit + poll).
- Veille « réelle » dépend des clés (ScrapeCreators tous réseaux, ou YouTube/xpoz) et des connecteurs ; sinon simulée.
- Providers OAuth Google/Facebook : à activer dans **Supabase → Authentication → Providers**
  (Google = créer un client OAuth Google Cloud ; Facebook = app Meta validée). Le code
  (boutons + `/auth/callback` + provisioning) est déjà prêt.
- Ad Library : couverture complète en UE, politique/social ailleurs (+ vérif. identité Meta).

---

## 10. Comptes de démo (sans Supabase)
`OCC` (Obesity Care Clinic), `TI` (Tibok), `CV` (Cabo Verde Medical International).
En production, l'espace d'un nouvel utilisateur est **vierge** (l'admin crée ses sociétés
via `/admin`).
