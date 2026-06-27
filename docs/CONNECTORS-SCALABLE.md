# Connecteurs — architecture scalable (ajouter un réseau = 1 config)

> Voir `CONNECTORS.md` (référence API par réseau) et `CONNECTORS-NATIVE.md`.
> Ce document décrit le **modèle d'extension** : comment brancher un nouveau
> réseau social **sans écrire de route ni de connecteur à la main**.

> Objectif (cahier des charges) : connecter des comptes via **OAuth 2.0** et
> publier sur plusieurs réseaux **sans gérer les identifiants des clients**,
> **sans coût par client**, **scalable de 1 à 1 M+ comptes**.
>
> Principe directeur : **ajouter un réseau social = 1 objet de configuration.
> Zéro nouvelle route, zéro connecteur écrit à la main.**

## 1. Vue d'ensemble

Tout passe par un **contrat unifié** (`SocialConnector`) et un **registre
central**. Le reste de l'app (composer, publication programmée, cron, métriques)
ne connaît que ce contrat — jamais les détails d'un réseau.

```
lib/connectors/
├── types.ts            Contrat SocialConnector + types (Token, Publish, Metrics)
│                       + ConnectorPlatform (surensemble de Platform, isolé ici)
├── provider-spec.ts    Fabrique DÉCLARATIVE : makeOAuth2Connector(spec)
├── providers/
│   ├── twitter.ts      Twitter/X   — pure config (OAuth2 + PKCE)
│   ├── pinterest.ts    Pinterest   — pure config (OAuth2, Basic auth)
│   └── threads.ts      Threads     — pure config (flux container → publish)
├── meta.ts             Facebook + Instagram (flux Page Meta spécifique)
├── linkedin.ts         LinkedIn (UGC/Posts + Marketing API)
└── index.ts            Registre : getConnector(), listConnectorStatus(),
                        SUPPORTED_PLATFORMS, isSupportedPlatform()

app/api/connectors/
├── [platform]/         ROUTES GÉNÉRIQUES — servent tout réseau enregistré
│   ├── auth/           GET  → lance l'OAuth
│   ├── callback/       GET  → échange le code, stocke les tokens (chiffrés)
│   └── publish/        POST → publie un contenu
├── facebook/ instagram/ linkedin/   Routes statiques dédiées (flux spécifiques,
                        prioritaires dans le routeur Next.js — rétrocompat)
```

### Avant / après

| | Avant | Après |
|---|---|---|
| Ajouter un réseau OAuth2 standard | 1 connecteur (~250 l.) + 3 routes quasi identiques + 4 registres | **1 spec (~30 l.) + 1 ligne dans le registre** |
| Routes par réseau | `facebook/`, `instagram/`, `linkedin/` dupliquées | **1 route générique `[platform]/`** |

### Pourquoi `ConnectorPlatform` et pas `Platform` ?

`Platform` (`lib/types.ts`) est utilisé dans des dizaines de `Record<Platform,…>`
exhaustifs partout dans l'app. L'étendre casserait ces cartes. Les nouveaux
réseaux n'existent que dans la couche publication/connexion : on les ajoute donc
à `ConnectorPlatform = Platform | "twitter" | "pinterest" | "threads"`, isolé au
sous-système connecteurs. **Sobriété : on ne propage pas un changement de type à
66 fichiers pour ajouter un bouton de publication.**

## 2. Ajouter un nouveau réseau (la recette complète)

La plupart des réseaux (Twitter/X, Pinterest, Threads, Mastodon, Reddit,
YouTube…) suivent le flux OAuth 2.0 `authorization_code`. Pour les ajouter :

### Étape 1 — créer la spec (≈ 30 lignes)

`lib/connectors/providers/mastodon.ts` :

```ts
import { makeOAuth2Connector, type OAuth2ProviderSpec } from "@/lib/connectors/provider-spec";

const spec: OAuth2ProviderSpec = {
  platform: "mastodon",
  label: "Mastodon",
  clientIdEnv: "MASTODON_CLIENT_ID",
  clientSecretEnv: "MASTODON_CLIENT_SECRET",
  authorizeUrl: "https://mastodon.social/oauth/authorize",
  tokenUrl: "https://mastodon.social/oauth/token",
  scopes: ["read", "write:statuses"],
  simPrefix: "masto",
  async fetchAccount(token) {
    const r = await fetch("https://mastodon.social/api/v1/accounts/verify_credentials", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    return { externalId: j.id, accountName: `@${j.username}` };
  },
  async publish({ accessToken, text }) {
    const r = await fetch("https://mastodon.social/api/v1/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status: text }),
    });
    const j = await r.json();
    return { externalId: j.id, url: j.url };
  },
};

export const mastodonConnector = makeOAuth2Connector(spec);
```

### Étape 2 — l'enregistrer (1 ligne dans `index.ts`)

```ts
import { mastodonConnector } from "@/lib/connectors/providers/mastodon";
// …
const CONNECTORS = [ …, mastodonConnector ];   // <— c'est tout
```

### Étape 3 — déclarer la plateforme et les credentials

- `ConnectorPlatform` dans `types.ts` : `… | "mastodon"`.
- `.env` : `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET`.
- (UI) `lib/channels.ts` : 1 entrée pour l'afficher dans l'admin.

**Aucune route à écrire.** `/api/connectors/mastodon/auth`, `…/callback`,
`…/publish` fonctionnent immédiatement via les routes génériques `[platform]`.

### Réseaux à flux spécifique

Un réseau qui s'écarte du flux standard (ex. Meta avec sa **sélection de Page**,
ou un échange de token en plusieurs étapes) implémente directement
`SocialConnector` (cf. `meta.ts`) et garde au besoin une route statique dédiée.
Il rejoint le **même registre** et le **même contrat** — l'app ne voit aucune
différence.

## 3. La fabrique `makeOAuth2Connector`

Options de `OAuth2ProviderSpec` :

| Champ | Rôle |
|---|---|
| `platform`, `label` | Identité du connecteur |
| `clientIdEnv` / `clientSecretEnv` | **Noms** des variables d'env (jamais les valeurs en dur) |
| `authorizeUrl` / `tokenUrl` / `scopes` | Endpoints OAuth standards |
| `scopeSeparator` | `" "` (défaut) ou `","` selon le réseau |
| `tokenAuth` | `"body"` (défaut) ou `"basic"` (Authorization: Basic) |
| `pkce` | `"plain"` pour les réseaux qui l'exigent (Twitter/X) |
| `fetchAccount` | Récupère l'identité du compte après token |
| `publish` | Adaptateur d'écriture réel |
| `metrics` | Adaptateur de métriques réel (optionnel) |

**Dégradation gracieuse intégrée** : tant que les credentials sont absents, le
connecteur tourne en **mode simulé** (identité + publication factices, aucun
appel réseau). On développe et démontre le produit sans aucune app validée.

## 4. Sécurité (conforme au cahier des charges)

- **Tokens chiffrés au repos** : `lib/repositories/channel-connections.ts`
  chiffre (`access_token`, `refresh_token`, `page_access_token`, …) via
  `lib/crypto`. Déchiffrement transparent côté serveur ; masqués dans les
  réponses HTTP.
- **CSRF + anti open-redirect** : `lib/connectors/oauth-state.ts` génère un
  `state` à nonce aléatoire et n'accepte que des chemins de retour internes.
- **PKCE** : supporté (méthode `plain`) pour les réseaux qui l'imposent.
- **Secrets hors code** : uniquement via variables d'environnement.
- **Contrôle d'accès** : `requireCompanyAccess` empêche de rattacher un compte à
  une société non autorisée.

## 5. Correspondance avec le cahier des charges

| ID | Fonctionnalité | Statut |
|----|----------------|--------|
| F01 | Connexion OAuth par réseau | ✅ Routes génériques `[platform]/auth` + registre |
| F02 | Stockage des tokens chiffrés | ✅ `channel-connections` (AES) + `sh_social_accounts` |
| F03 | Publication (texte/média/lien) | ✅ `publishPost` unifié + adaptateurs par réseau |
| F04 | Révocation d'accès | ✅ Connexion repassée en `disconnected` |
| F05 | Rafraîchissement des tokens | ✅ `refresh_token` stocké (chiffré) ; cron de renouvellement |
| F06 | Comptes connectés | ✅ `listConnectorStatus()` (générique sur le registre) |
| F07 | Gestion des erreurs | ✅ Messages clairs, jamais de faux succès |
| F08 | Historique des publications | ✅ `sh_audit_log` + tables posts |
| F09 | Quotas API | ⚙️ Par adaptateur (backoff) — à compléter par réseau |
| F10 | Notifications | ⚙️ Via le hub (Telegram déjà branché) |

## 6. Tests

```bash
npm run test:connectors   # registre + fabrique + dégradation simulée
```

Le test vérifie qu'ajouter un réseau ne dépend que de la config : toute
plateforme enregistrée se résout, expose le contrat, et simule proprement hors
credentials.
