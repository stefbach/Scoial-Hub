# Audit produit AXON-AI · Social Media

Audit mené par un orchestrateur + 6 sous-agents (lecture seule), chacun comparant
l'app aux leaders du marché (Hootsuite, Metricool, Buffer, Sprout, AdCreative.ai,
Madgicx, Predis, Canva). Type-check : **0 erreur**.

## Verdict global : **~6/10** — « démo soignée → produit fiable », il reste un cran

**Excellente coquille produit, vision all-in-one rare, UX premium** — mais
**sécurité** et **réalité des données** pas encore au niveau d'un produit grand public.

### Notes par domaine
| Domaine | Note | Verdict court |
|---|---|---|
| Parcours & entrée (onboarding, dashboard, auth) | 7/10 | Onboarding IA différenciant ; trous auth/multi-tenant |
| Connexions & Meta (OAuth, pages, ads) | 5.5/10 | Publication ads directe = atout ; sécurité API bloquante |
| Intelligence (veille, pubs, mémoire) | 6.5/10 | Mémoire→campagne crédible ; données simulées déguisées |
| Contenu (studio, organique) | 5.5/10 | Studio génératif fort (8/10) ; **Composer ne publie rien** |
| Pilotage & paid (agents, campagnes) | 6/10 | Agents+mémoire crédibles ; paid surtout mock/local |
| Transversal (sécurité, UI, i18n, code) | 6/10 | Front 8/10, sécurité 3/10 |

### Forces différenciantes (réelles, à garder)
- **All-in-one** rare : organique + paid Meta + veille + agents IA + studio vidéo + MCP + Telegram.
- **Onboarding qui analyse vraiment la marque** (site + Claude) — aucun concurrent grand public ne le fait.
- **Mémoire stratégique persistante injectée dans les campagnes** (veille/pubs → brief → agents).
- **Publication Meta directe avec garde-fou PAUSE→activation** + compliance santé bloquante.
- **Direction artistique premium** + responsive soigné.

---

## 🔴 P0 — Bloquants (à faire avant toute mise en prod / argent réel)

1. **Auth des routes API / IDOR généralisé** — `/api/*` est public dans le middleware ;
   les routes acceptent `companyId` du client sans vérifier l'appartenance, et ~12 routes
   utilisent le client admin (service-role, bypass RLS). → N'importe qui peut lire/écrire
   l'espace d'un tiers, voire **activer une pub (dépense réelle)** sur un autre compte.
   *Fix : guard serveur user↔company sur toutes les routes ; dériver companyId de la session.*
2. **Auth admin triviale** — `lib/admin.ts` : identifiants codés en dur
   (`admin@socialhub.com`/`12345678`) + cookie statique devinable → **session admin forgeable**.
   *Fix : hash + session signée, supprimer les creds/token en dur.*
3. **Tokens OAuth stockés en clair** (`access_token`/`refresh_token`) — un accès DB expose
   tous les jetons clients. *Fix : chiffrer au repos (pgcrypto) ou vault.*
4. **Composer ne publie/planifie rien** — le bouton « Publier/Planifier » n'a **aucun onClick**
   (`app/(organic)/compose/page.tsx`). L'action centrale du produit est inerte.
   *Fix : câbler `POST /api/scheduled-posts` + feedback + redirection.*
5. **Persistance non unifiée (paid)** — campagnes/ad sets/audiences passent par un store
   local en mémoire **et** l'API ; toggles/ad sets/duplication **perdus au reload**.
   *Fix : tout passer par Supabase (supprimer la double source de vérité).*
6. **`setAdLive` sans re-validation serveur** — active des IDs bruts du client sans vérifier
   l'appartenance ni re-appliquer le plafond budget. *Fix : re-valider côté serveur.*

## 🟠 P1 — Sérieux (crédibilité / fiabilité)

7. **3 sources de vérité « connecté »** (mock `/accounts` vs `/api/connectors` vs
   `sh_channel_connections`) → statut incohérent entre pages. Unifier ; supprimer le mock
   `ConnectedMetaCard`/`connection-store`.
8. **Données mock présentées comme réelles** : Analytics (`NOW` figé 2026-05-30), Ad-performance
   (impressions = `spend*50`, tendances `*0.88`), Accounts. → brancher réel **ou** bandeau « démo ».
9. **`lib/pilotage.ts` vidé** → KPIs à 0 + carte « Benchmark » vide sans empty state.
10. **Génération visuelle Compose/Library cassée** — `format`/`mock` mal câblés (`AiPanel`),
    images jamais affichées.
11. **`generate-post` : mock santé/DDS codé en dur** → fuite de contexte d'un client dans le générique.
12. **Meta divers** : IG texte seul → image placeholder publiée ; `getMetrics` utilise l'app token
    (cassé) ; token **utilisateur** utilisé pour les Ads (devrait être System User) ;
    state OAuth non vérifié (CSRF) + `next`/`return` non validés (open-redirect).
13. **Veille** : `veille/latest` ne résout pas l'UUID (dernier run jamais retrouvé en démo) ;
    Ad Library mode « ALL » renvoie 0 impression (fonction pub principale inexploitable) ;
    `identify` invente des handles concurrents.
14. **Signup sans session** (confirmation email) → redirige vers un dashboard inaccessible.
15. **Robustesse/A11y** : aucun `error.tsx`/`loading.tsx`/`not-found.tsx` ; `Modal` sans
    ESC/focus-trap/`aria-modal` (25 surfaces concernées).
16. **Mémoire** : source « page » annoncée mais non alimentée ; anti-doublon destructeur
    (pas de vrai historique) ; `StrategyPanel` ne se rafraîchit pas après synthèse.

## 🟡 P2 — Qualité / dette

17. ~20 commentaires « Bug #NN » résiduels dans `app/(paid)/**`. 165 `console.*`.
18. Duplication : `CONNECTOR_CATALOG` vs `CHANNELS` ; connecteurs FB/IG ; 14 `new Anthropic`
    + parsing JSON (→ helper `callClaudeJSON`) ; fallback mock repo (→ `withSupabaseOrMock`) ;
    icônes SVG inline dupliquées.
19. `lib/mock-data.ts` (1257 l.) dans le bundle des pages réelles → isoler en fixtures dev.
20. i18n inline `t("fr","en")` sans système de clés (pas scalable, FR forcé en SSR).
21. Incohérences doc « 7 vs 8 agents » ; durée vidéo UI 60s vs réel ~6s ; musique SoundHelix
    (licence) ; polling Shotstack sans timeout ; `NOW` figé dans History/Analytics ; résidu `mock-org`.

---

## Plan recommandé (ordre)

**Sprint 1 — Sécurité (P0 #1–#3, #6)** : guard d'autorisation API (helper `requireCompanyAccess`),
vraie auth admin, chiffrement des tokens, re-validation `setAdLive`. → condition sine qua non prod.

**Sprint 2 — « Fait ce qu'il promet » (P0 #4–#5)** : Composer publie/planifie réellement ;
persistance unifiée Supabase (campagnes/ad sets/audiences).

**Sprint 3 — Crédibilité données (P1 #7–#13)** : unifier le statut connecté, brancher le réel
ou afficher « démo », réparer génération visuelle, veille/ads, retirer le mock DDS.

**Sprint 4 — Robustesse & polish (P1 #14–#16, P2)** : error/loading boundaries, a11y Modal,
nettoyage dette, i18n par clés.

Une fois Sprints 1–2 faits, le produit est **présentable et opérationnel** ; Sprints 3–4 le
hissent au niveau « produit grand public à forte notoriété ».
</content>
