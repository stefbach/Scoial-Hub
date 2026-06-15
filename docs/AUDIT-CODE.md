# Audit technique du code — Social Hub (AXON-AI)

Audit en lecture seule du code (`app/`, `components/`, `lib/`) en 5 passes :
Sécurité, Correctness/bugs, i18n, Architecture/conventions, Performance.
Référence des conventions : `CLAUDE.md`. (Distinct de `docs/AUDIT.md`, qui est l'audit *produit*.)

> ⚠️ Les constats Sécurité (IDOR) doivent être **confirmés** au regard des
> politiques RLS Supabase : la RLS peut bloquer une partie des accès, mais la
> défense en profondeur impose d'ajouter les gardes côté route.

## Statut de remédiation (mis à jour)

- ✅ **Sécurité** — toutes les failles Critiques + Élevées corrigées : gardes
  `requireCompanyAccess`/`requireUser` ajoutées (api-keys, creatives,
  campaigns/audiences/ad-sets `[id]`, video/render, routes IA, OAuth connecteurs)
  + helper anti-SSRF `lib/security/url-guard.ts` appliqué (persistRemoteMedia,
  benchmark, brand-chart).
- ✅ **i18n** — `/api/benchmark`, `/api/meta/ads/assist`, identify (Benchmark)
  reçoivent la langue + directive de prompt.
- ✅ **Architecture** — MediaLibrary rendu via portail.
- ✅ **Correctness** — fuite du minuteur d'enregistrement (studio-avatar) corrigée.
  Faux positifs vérifiés et écartés : double `res.json()` (connexions), closure
  `PromptStudio` (les valeurs sont passées explicitement à `generate`).
- ✅ **Performance** — galerie média (`loading="lazy"`/clés stables), LinkedIn
  (`Promise.all`), polling Telegram (backoff + plafond). Faux positif : les fetch
  Pilotage sont déjà dans des effets séparés (donc concurrents).
- ⏳ **Reporté (refactors, non bloquants)** : découpe de `campaigns/new` (~1279 l.)
  et `compose` en sous-composants ; fusion filtre+tri `ad-performance`. À planifier
  séparément (risque de régression si fait à la hâte).

## Synthèse

| Domaine | Critiques | Élevés | Moyens | Faibles |
|---|---|---|---|---|
| Sécurité | 4 | 5 | 2 | — |
| Correctness / bugs | — | 5 | 4 | — |
| i18n | — | 2 | 1 | 3 |
| Architecture | 1 *(corrigé)* | — | — | 3 |
| Performance | — | 8 | 3 | 1 |

Build : `npx tsc --noEmit` → 0 erreur.

---

## 1) Sécurité (priorité haute)

### Critiques — IDOR (accès inter-sociétés)
1. **Clés API non protégées** — `app/api/api-keys/route.ts` (GET/POST) et `app/api/api-keys/[id]/route.ts` (DELETE) n'appellent pas `requireCompanyAccess`. Un utilisateur authentifié peut lister / créer / révoquer les clés de **n'importe quelle** société via `companyId`. → ajouter `requireCompanyAccess(companyId, { mode: "edit" })`.
2. **Ressources campagne** — `app/api/campaigns/[id]/route.ts`, `app/api/audiences/[id]/route.ts`, `app/api/ad-sets/[id]/route.ts` n'utilisent que `requireUser()` : lecture/modif/suppression d'une ressource d'autrui via son UUID. → résoudre le `company_id` de la ressource puis `requireCompanyAccess`.
3. **OAuth connecteurs** — `app/api/connectors/linkedin/auth/route.ts` et `.../facebook/auth/route.ts` : `upsertConnection` sans vérifier l'accès à la société. → garde avant rattachement.
4. *(même classe de faille que 1–3 : `companyId` de confiance non vérifié.)*

### Élevés
5. **`app/api/creatives/route.ts`** (GET) — aucune garde ; expose la bibliothèque créas + veille concurrentielle. → `requireCompanyAccess(companyId)`.
6. **`app/api/video/render/[id]/route.ts`** (GET) — statut de rendu sans auth. → `requireUser()`.
7. **SSRF** — `app/api/benchmark/route.ts` (URLs concurrents), `app/api/ai/generate-brand-chart/route.ts` (logoUrl), `lib/repositories/media.ts:46` (`fetch(url)`) : URL fournie par l'utilisateur récupérée côté serveur **sans valider schéma/hôte** (localhost, IP privées, métadonnées cloud). → forcer `https`, bloquer hôtes privés/loopback, idéalement allowlist.
8. **Routes IA sans auth** — `generate-image`, `generate-post` (injecte la mémoire RAG via `companyId`), `generate-video`, `compliance` : pas de `requireUser`/`requireCompanyAccess`. → au minimum `requireUser()`, et `requireCompanyAccess(companyId, { mode: "edit" })` quand `companyId` sert à persister/charger.
9. **Publication connecteurs** — `connectors/facebook/publish`, `linkedin/publish` : `requireCompanyAccess` OK ; durcir avec audit log systématique.

### Moyens
10. **Validation des bodies** — la plupart des routes font `(await req.json()) as Body` sans schéma. → **Zod** sur les routes POST/PATCH sensibles.
11. **`createAdminClient` (service-role)** parfois appelé avant toute garde (ex. `creatives`). → garde d'auth **avant** tout accès DB, indépendamment de la RLS ; vérifier que la RLS est active sur toutes les tables.

---

## 2) Correctness / bugs

### Élevés
- **Double `res.json()`** — `app/admin/comptes/[id]/connexions/page.tsx:48` et `:77-82` (corps consommé deux fois → le chemin succès jette). → parser une fois.
- **`res.json()` non gardé** — `app/(organic)/scheduled/page.tsx:53` (échec silencieux). → `.catch(() => [])`.
- **Closure périmée** — `components/studio/PromptStudio.tsx:103-114` (deps = `seed?.nonce` seul → mauvais modèle si changé après). → compléter les deps.
- **Timer non nettoyé** — `app/(general)/studio-avatar/page.tsx:268` (`setInterval` d'enregistrement non clearé au démontage). → cleanup `useEffect`.

### Moyens
- `studio-avatar:290` `res.json()` non gardé · `studio-video:629-660` race possible du polling (closure `polls`) · `telegram/page.tsx:72` listener `focus` re-souscrit · `studio-avatar:305-320` `setState` après démontage possible.

---

## 3) i18n

### Élevés
- **`/api/benchmark`** — prompt en dur (FR), client n'envoie pas `language`. → `language: lang` + directive de langue.
- **`/api/meta/ads/assist`** — idem (prompt « media buyer Meta » en dur), client `app/(paid)/campaigns/new/page.tsx:374`.

### Moyen
- **`/api/veille/identify` depuis le Benchmark** — `app/(general)/benchmark/page.tsx` (bouton « Suggérer des concurrents ») n'envoie pas `language` (route OK, défaut `fr`). → ajouter `language: lang`.

### Faibles
- Placeholders d'exemples pages admin/équipe (`mon-equipe:279`, `admin/login:55`, `admin/.../telegram:406`).

> La majorité des routes IA gèrent **déjà** la langue (veille/analyze, onboarding/analyze, agents/run, generate-post, meta/analyze…).

---

## 4) Architecture / conventions

- 🔴 **`components/studio/MediaLibrary.tsx`** — modale en `fixed inset-0` **sans portail** → **CORRIGÉ** (rendu via `createPortal(document.body)`).
- 🟢 Modales (15) conformes ; persistance localStorage par société conforme ; mises à jour optimistes (`scheduled`) conformes ; logs API cohérents.
- Faibles : `console.log` `app/install-mcp.sh/route.ts:78` ; `TODO(licence)` `lib/video/types.ts:128` ; (option) hook partagé `useScheduledPosts` (5 sites).

---

## 5) Performance

### Élevés
- **Polling Telegram 4 s sans backoff** — `app/(general)/telegram/page.tsx:51`. → backoff (4→30 s) ou SSE.
- **Appels séquentiels** à paralléliser — `app/(general)/linkedin/page.tsx:81-90` ; `app/(general)/pilotage/page.tsx:100/134/150` (+ `AbortController`).
- **Galerie média** — `app/(organic)/media/page.tsx:199-222` : `loading="lazy"` + clé = `a.url`.
- **`ad-performance:314-343`** — fusionner filtre+tri, hisser `search.toLowerCase()`.
- **`scheduled` focus** — debounce du refetch.
- **Persistances « fire-and-forget »** — `studio-video:566,652` POST `/api/media` à batcher + logguer.
- **Gros composants client** — `campaigns/new/page.tsx` (~1279 l.) et `compose/page.tsx` à découper.

### Moyens / faibles
- `pages-meta` erreurs silencieuses ; `scheduled` refetch redondant après optimiste ; états de transition manquants sur certaines générations studio.

---

## Plan de remédiation recommandé

1. **Sécurité** (Critiques 1–4, Élevés 5–8) : gardes `requireCompanyAccess`/`requireUser` manquantes + validation d'URL anti-SSRF. Vérifier la RLS.
2. **Correctness** : double-parse connexions, `res.json()` gardés, deps `PromptStudio`, cleanup timer avatar.
3. **i18n** : `language` + directive sur `/api/benchmark`, `/api/meta/ads/assist`, `/api/veille/identify` (appel benchmark).
4. **Performance** : `Promise.all` (LinkedIn/Pilotage), `loading="lazy"` galerie, backoff Telegram, batch persists.
5. **Architecture** : MediaLibrary→portal fait ; nettoyage logs/TODO ; (option) hook scheduled.
</content>
