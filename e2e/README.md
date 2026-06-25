# Tests E2E (Playwright) — « verrou » des tests

Un agent navigateur simule les actions humaines (clic, saisie, navigation) pour
détecter automatiquement les régressions **avant** de merger. Exécuté sur chaque
Pull Request via GitHub Actions (`.github/workflows/e2e.yml`) — la PR est bloquée
si un test échoue.

## Ce qui est couvert

- **`smoke.spec.ts`** — crawler anti-crash : visite toutes les routes et vérifie
  qu'aucune n'affiche la frontière d'erreur ni d'erreur JS/React fatale
  (ex. le crash « Minified React #310 » des hooks). En mode **anglais**, pour
  aussi débusquer les pages qui plantent dans cette langue.
- **`flows.spec.ts`** — parcours clés : ouvrir une fiche audience sans crash
  (régression #310), brouillon de campagne sauvegardé/restauré, heure de début
  par défaut, i18n de la page « Créer une pub ».

## Authentification : bypass de test (sécurisé)

Les pages protégées sont accessibles aux tests via un **bypass** dans
`middleware.ts`, actif uniquement si **les trois** conditions sont réunies :
1. la variable `E2E_BYPASS_SECRET` est définie,
2. on **n'est pas** en production (`VERCEL_ENV !== "production"`),
3. la requête porte le cookie `e2e_bypass` égal au secret.

→ **Jamais actif en production**, et sans le cookie. Pour tester un **preview
Vercel**, définir `E2E_BYPASS_SECRET` dans les variables d'environnement du
preview, puis lancer avec `E2E_BASE_URL=<url-du-preview>`.

## Lancer en local

```bash
# build d'abord (le serveur de test démarre `npm run start`)
npm run build

# Chromium est préinstallé dans cet environnement :
E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium E2E_BYPASS_SECRET=local-e2e-secret npm run test:e2e

# Contre un preview déjà déployé (pas de serveur local) :
E2E_BASE_URL=https://<preview>.vercel.app E2E_BYPASS_SECRET=<secret> npm run test:e2e
```

En CI, Chromium est installé via `npx playwright install`, l'app tourne en
**mode démo** (aucun secret requis, données mock) et les tests s'exécutent sur
`http://127.0.0.1:3000`.

## Ajouter un test

Réutiliser la fixture de `e2e/helpers.ts` (`import { test, expect } from "./helpers"`)
qui applique déjà la langue anglaise + le cookie de bypass. Pour figer un parcours
validé manuellement, écrire un test déterministe ici ; pour la découverte de
nouveaux bugs, une exploration IA reste complémentaire (non bloquante).

## Diagnostic ponctuel (`scripts/diagnose.ts`)

Crawl non bloquant qui parcourt toutes les routes en anglais et **remonte** (sans
faire échouer) : erreurs/avertissements console, erreurs JS, fuites de français en
mode EN, images cassées, frontières d'erreur. Utile pour une chasse aux bugs.

```bash
npm run build
E2E_BYPASS_SECRET=local-e2e-secret PORT=3000 npm run start &   # serveur local
E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium E2E_BYPASS_SECRET=local-e2e-secret npm run diagnose

# ou contre un preview authentifié :
E2E_BASE_URL=https://<preview>.vercel.app E2E_BYPASS_SECRET=<secret> npm run diagnose
```

