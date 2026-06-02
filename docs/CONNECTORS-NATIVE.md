# CONNECTORS-NATIVE — Couche de connecteurs natifs Social Hub

Documentation de référence pour la couche de connecteurs native (`lib/connectors/`)
et les API routes associées (`app/api/connectors/`).

---

## 1. Vue d'ensemble

La couche de connecteurs expose une interface unifiée `SocialConnector` pour trois plateformes :

| Plateforme  | Connecteur             | Publication | Métriques | Campagnes pub |
|-------------|------------------------|-------------|-----------|---------------|
| Facebook    | `facebookConnector`    | ✓           | ✓         | ✓ (Marketing API) |
| Instagram   | `instagramConnector`   | ✓           | ✓         | ✓ (Marketing API) |
| LinkedIn    | `linkedinConnector`    | ✓           | ✓         | ✓ (LinkedIn Ads) |

**Dégradation gracieuse :** Si les variables d'environnement sont absentes ou si un token est manquant, toutes les méthodes retournent des valeurs simulées cohérentes (`simulated: true`) sans jamais lever d'exception ni appeler le réseau. L'app fonctionne complètement sans aucune clé.

---

## 2. Variables d'environnement requises

Copier `.env.example` → `.env.local` et renseigner :

### Meta (Facebook + Instagram)

```
META_APP_ID=          # ID de l'application Meta (Facebook for Developers)
META_APP_SECRET=      # Secret de l'application Meta
META_API_VERSION=v21.0  # Version Graph API (défaut v21.0 — mettre à jour selon les dépréciations)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # URL publique de l'app (pour les redirections OAuth)
```

**Flag de configuration** : `isMetaConfigured = Boolean(META_APP_ID) && Boolean(META_APP_SECRET)`

### LinkedIn

```
LINKEDIN_CLIENT_ID=     # Client ID de l'application LinkedIn Developer
LINKEDIN_CLIENT_SECRET= # Client Secret de l'application LinkedIn Developer
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Flag de configuration** : `isLinkedInConfigured = Boolean(LINKEDIN_CLIENT_ID) && Boolean(LINKEDIN_CLIENT_SECRET)`

---

## 3. Scopes OAuth par plateforme

### Facebook

Scopes demandés lors de l'autorisation :

| Scope                        | Usage                                                    | App Review requis |
|------------------------------|----------------------------------------------------------|-------------------|
| `pages_manage_posts`         | Créer/modifier/supprimer des posts sur les Pages         | Oui               |
| `pages_read_engagement`      | Lire les métriques organiques (likes, comments, reach)   | Oui               |
| `pages_show_list`            | Lister les Pages gérées par l'utilisateur                | Oui               |
| `instagram_basic`            | Accès de base au compte Instagram Business               | Oui               |
| `instagram_content_publish`  | Publier des images/vidéos/reels sur Instagram            | Oui               |
| `instagram_manage_insights`  | Lire les insights des publications IG                    | Oui               |
| `ads_management`             | Créer et gérer des campagnes Marketing API               | Oui               |
| `business_management`        | Accès au Business Manager (pages, comptes pubs)          | Oui               |

**Token flow** : code court durée → token long durée (60 jours) via `fb_exchange_token`.

### Instagram

Utilise le même flow OAuth que Facebook (Facebook Dialog). Les tokens Facebook donnent accès aux comptes Instagram Business liés à la Page. Le compte Instagram Business est identifié via le champ `instagram_business_account` du profil Facebook.

### LinkedIn

Scopes demandés :

| Scope                     | Usage                                                        | App Review requis |
|---------------------------|--------------------------------------------------------------|-------------------|
| `openid`                  | Authentification OpenID Connect                              | Non               |
| `profile`                 | Lire le nom et l'identifiant du membre                       | Non               |
| `email`                   | Lire l'email du membre                                       | Non               |
| `w_member_social`         | Publier des posts au nom d'un membre                         | Oui (MDP*)        |
| `r_organization_social`   | Lire les posts et statistiques d'une organisation            | Oui (MDP*)        |
| `rw_organization_admin`   | Créer et gérer des posts d'organisation                      | Oui (MDP*)        |

**MDP*** : Marketing Developer Platform — programme LinkedIn qui requiert un processus de validation d'app.

**Token flow** : code → access_token (60 jours) + optional refresh_token (1 an). Pas de token court/long comme Meta.

---

## 4. Architecture des fichiers

```
lib/connectors/
├── types.ts          # Interfaces SocialConnector, TokenSet, PublishInput, etc.
├── meta.ts           # FacebookConnector + InstagramConnector (Graph API)
├── linkedin.ts       # LinkedInConnector (REST API)
└── index.ts          # Registre : getConnector(), listConnectorStatus()

app/api/connectors/
├── route.ts                         # GET  /api/connectors → statut toutes plateformes
├── facebook/
│   ├── auth/route.ts                # GET  /api/connectors/facebook/auth → redirect OAuth
│   ├── callback/route.ts            # GET  /api/connectors/facebook/callback
│   └── publish/route.ts             # POST /api/connectors/facebook/publish
├── instagram/
│   ├── auth/route.ts                # GET  /api/connectors/instagram/auth → redirect OAuth
│   ├── callback/route.ts            # GET  /api/connectors/instagram/callback
│   └── publish/route.ts             # POST /api/connectors/instagram/publish
└── linkedin/
    ├── auth/route.ts                # GET  /api/connectors/linkedin/auth → redirect OAuth
    ├── callback/route.ts            # GET  /api/connectors/linkedin/callback
    └── publish/route.ts             # POST /api/connectors/linkedin/publish
```

---

## 5. API Routes — Référence

### `GET /api/connectors`

Retourne le statut de configuration de chaque plateforme.

**Réponse :**
```json
[
  {
    "platform": "facebook",
    "configured": false,
    "connectedAccounts": 0,
    "accounts": []
  },
  {
    "platform": "instagram",
    "configured": false,
    "connectedAccounts": 0,
    "accounts": []
  },
  {
    "platform": "linkedin",
    "configured": false,
    "connectedAccounts": 0,
    "accounts": []
  }
]
```

---

### `GET /api/connectors/{platform}/auth`

Redirige (302) vers la page OAuth de la plateforme.

- **En production** : redirige vers `https://www.facebook.com/dialog/oauth?...` ou `https://www.linkedin.com/oauth/v2/authorization?...`
- **En simulé** : redirige vers `/accounts?simulated=true&platform={platform}`

---

### `GET /api/connectors/{platform}/callback?code=…&state=…`

Callback OAuth. Échange le code, enregistre le compte (best-effort), redirige vers `/accounts`.

Paramètres de redirection :
- `connected=true&platform={platform}&account={nom}` — succès
- `simulated=true` — succès en mode simulé
- `error=oauth_denied|missing_code|exchange_failed` — échec

---

### `POST /api/connectors/{platform}/publish`

Publie un post organique.

**Corps JSON :**
```json
{
  "companyId":          "company-uuid",
  "accountId":          "social-account-uuid",
  "externalAccountId":  "page-id-ou-urn",
  "accessToken":        "token-optionnel",
  "text":               "Texte du post (requis)",
  "link":               "https://example.com (optionnel)",
  "linkTitle":          "Titre du lien (FB uniquement)",
  "linkDescription":    "Description (FB uniquement)",
  "media": {
    "url":       "https://cdn.example.com/image.jpg",
    "caption":   "Légende",
    "mimeType":  "image/jpeg"
  }
}
```

**Réponse succès :**
```json
{
  "externalId": "123456789_987654321",
  "url": "https://www.facebook.com/123456789_987654321",
  "simulated": true
}
```

**Réponse erreur (500) :**
```json
{ "error": "Graph API /feed → [200] ..." }
```

---

## 6. Usage depuis les agents / couche serveur

```typescript
import { getConnector } from "@/lib/connectors";
import type { PublishInput } from "@/lib/connectors/types";

// Publication directe (sans passer par l'API route)
const connector = getConnector("facebook");

const result = await connector.publishPost({
  externalAccountId: "123456789",         // page_id
  accessToken:       "EAA...",            // depuis social_accounts
  text:              "Nouveau post Social Hub !",
  link:              "https://exemple.com",
});

console.log(result.externalId);  // "123456789_987654321"
console.log(result.simulated);   // true si pas de creds

// Statut de tous les connecteurs
import { listConnectorStatus } from "@/lib/connectors";
const statuses = await listConnectorStatus();
```

---

## 7. Tester en mode simulé (sans aucune clé)

Sans variables d'env configurées, **tout fonctionne** :

```bash
# Statut des connecteurs (configured: false pour tous)
curl http://localhost:3000/api/connectors

# Initier un OAuth (redirige vers /accounts?simulated=true)
curl -L http://localhost:3000/api/connectors/facebook/auth

# Publier un post (retourne simulated: true)
curl -X POST http://localhost:3000/api/connectors/facebook/publish \
  -H "Content-Type: application/json" \
  -d '{"text": "Test simulé", "companyId": "occ"}'
```

**Indicateurs simulés :**
- `isMetaConfigured = false` / `isLinkedInConfigured = false`
- Les tokens commençant par `simulated_` déclenchent aussi la simulation
- `PublishResult.simulated = true`
- `PostMetrics.simulated = true`
- Les IDs retournés ont le format `fb_post_simulated_1234567890`

---

## 8. Passer en mode réel

### Étapes Meta (Facebook + Instagram)

1. Créer une application sur [developers.facebook.com](https://developers.facebook.com) (type : "Business")
2. Ajouter les produits "Facebook Login" et "Instagram Graph API"
3. Configurer l'URL de redirection OAuth autorisée : `{NEXT_PUBLIC_APP_URL}/api/connectors/facebook/callback` et `{NEXT_PUBLIC_APP_URL}/api/connectors/instagram/callback`
4. Passer l'app en mode **Live** (requis pour les tokens d'autres utilisateurs)
5. Soumettre chaque permission à l'**App Review** Meta (pages_manage_posts, instagram_content_publish, etc.)
6. Renseigner dans `.env.local` :
   ```
   META_APP_ID=123456789
   META_APP_SECRET=abcdef...
   META_API_VERSION=v21.0
   ```

**Recommandation production** : utiliser un **System User** dans le Business Manager pour générer un token long-lived de 60 jours et éviter les expirations de token utilisateur.

### Étapes LinkedIn

1. Créer une application sur [linkedin.com/developers](https://www.linkedin.com/developers/apps)
2. Dans l'onglet "Auth", ajouter l'URL de redirection autorisée : `{NEXT_PUBLIC_APP_URL}/api/connectors/linkedin/callback`
3. Demander l'accès aux produits "Sign In with LinkedIn using OpenID Connect" et "Share on LinkedIn"
4. Pour les scopes `r_organization_social` et `rw_organization_admin` : rejoindre le programme **Marketing Developer Platform** (MDP) — processus de validation avec LinkedIn
5. Renseigner dans `.env.local` :
   ```
   LINKEDIN_CLIENT_ID=86abc...
   LINKEDIN_CLIENT_SECRET=defgh...
   ```

### Vérification rapide après configuration

```bash
# Doit retourner configured: true
curl http://localhost:3000/api/connectors | jq '.[].configured'
```

---

## 9. Stockage des tokens (social_accounts)

Les tokens OAuth sont persistés dans `social_hub.social_accounts` lors du callback :

| Colonne           | Description                                                |
|-------------------|------------------------------------------------------------|
| `platform`        | `"facebook"`, `"instagram"`, `"linkedin"`                  |
| `external_id`     | ID plateforme (page_id, ig_user_id, urn:li:person:…)       |
| `account_name`    | Nom lisible (Page Facebook, @handle IG, nom LinkedIn)      |
| `status`          | `"active"` \| `"expired"` \| `"revoked"`                   |
| `access_token`    | Token d'accès (chiffré côté Supabase recommandé)           |
| `refresh_token`   | Token de rafraîchissement (si présent)                     |
| `token_expires_at`| Timestamp ISO d'expiration                                 |

La contrainte `UNIQUE(platform, external_id)` permet l'upsert à chaque reconnexion.

---

## 10. Ce qui marche en réel vs simulé

| Fonctionnalité                        | Mode simulé | Mode réel (creds OK) |
|---------------------------------------|-------------|----------------------|
| `getAuthUrl()`                        | URL factice → /accounts | URL OAuth réelle |
| `exchangeCode()`                      | Token simulé | Vrai token OAuth |
| Persistance dans social_accounts      | Best-effort (Supabase requis) | Best-effort |
| `publishPost()` — Facebook            | ID simulé | POST /{page-id}/feed |
| `publishPost()` — Instagram           | ID simulé | Container + media_publish |
| `publishPost()` — LinkedIn            | ID simulé | POST /rest/posts |
| `getMetrics()` — Facebook             | Métriques aléatoires | Graph API insights |
| `getMetrics()` — Instagram            | Métriques aléatoires | Graph API insights |
| `getMetrics()` — LinkedIn             | Métriques aléatoires | /v2/socialActions |
| `createCampaign()` — Meta             | ID simulé | Marketing API campaigns |
| `createCampaign()` — LinkedIn         | ID simulé | /v2/adCampaignsV2 |
| Log dans audit_log                    | Best-effort (Supabase requis) | Best-effort |

---

*Dernière mise à jour : juin 2026 — API Meta v21.0, LinkedIn API 202405*
