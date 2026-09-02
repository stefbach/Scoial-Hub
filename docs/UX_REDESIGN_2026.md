# Refonte UX/UI 2026 — AXON-AI · Social Media

> Note de cadrage. Périmètre : analyse concurrentielle, diagnostic de l'existant,
> direction de design retenue, priorisation. Complète `docs/UX_AUDIT.md` (audit
> des parcours, note globale 6,1/10) avec un angle **design comparatif + mobile**.

---

## 1. Analyse concurrentielle

AXON-AI se positionne sur le marché de la **gestion social media** (planification,
publication, publicité, analytics), occupé par des acteurs matures. Aucun d'eux
ne combine nativement des **agents IA autonomes** (stratège, créatif, media buyer,
conformité) avec de la **génération de contenu réelle** (visuels/vidéos) et du
**pilotage publicitaire Meta réel** — c'est notre différenciateur, à assumer
visuellement plutôt qu'à diluer derrière un habillage générique.

| Outil | Positionnement | Forces design | Faiblesses | Ce qu'on en retient |
|---|---|---|---|---|
| **Buffer** | Solo/petites équipes | Minimalisme extrême, app mobile très aboutie, onboarding en 3 clics | Fonctionnellement limité (peu d'IA, pas de pub) | Réduire la charge cognitive par écran ; 1 action = 1 écran |
| **Later** | Créateurs, visuel | Calendrier « grille Instagram » drag & drop, aperçu visuel immédiat | Faible sur LinkedIn/B2B, IA superficielle | L'aperçu visuel avant publication doit être central, pas une option cachée |
| **Hootsuite** | Entreprises, legacy | Très complet, streams multi-comptes | Dense, daté, mobile secondaire, jugé « lourd » par ses propres utilisateurs | Contre-exemple : ne pas laisser la richesse fonctionnelle noyer la hiérarchie visuelle |
| **Metricool** | Data/multi-marques | Tableaux d'analytics denses, export white-label | Esthétique utilitaire, peu premium | Les data denses doivent rester lisibles mobile (cartes empilées, pas juste des tableaux figés) |
| **Vista Social** | Agences, rapport qualité/prix | Interface moderne et accessible, inbox unifiée saluée par les utilisateurs | Moins de profondeur IA/pub que nous | Référence de « propre et accessible » à dépasser sur l'IA, pas sur la sobriété |
| **Publer** | Power users, volume | Scheduling en masse (CSV), file d'attente | Design fonctionnel, pas différenciant | Le bulk/masse doit rester possible sans sacrifier le mobile pour les tâches ponctuelles |
| **Sprout Social** | Grandes équipes | Reporting profond | Perçu comme « legacy », onboarding lourd, cher | Ne pas répéter l'écueil : complexité exposée d'un coup dès l'onboarding |
| **Agorapulse** | Inbox-centric | Boîte de réception unifiée forte | Reste desktop-first | Notre `/inbox` (agents IA + escalade humaine) doit être notre meilleure vitrine mobile |
| **Ocoya / Predis.ai / FeedHive** | IA-native, jeunes | Composer conversationnel, léger | IA superficielle (texte seulement, pas de vraie génération visuelle/pub) | On a déjà plus de profondeur IA qu'eux — le manque est dans l'exposition progressive, pas la puissance |

**Conclusion concurrentielle** : l'identité visuelle actuelle (thème sombre
« Mission Control » améthyste, typographie éditoriale Fraunces/Manrope, verre
dépoli) est déjà **plus haut de gamme** que la quasi-totalité de ces outils, qui
restent sur du blanc/bleu générique façon SaaS 2018. On ne la remplace pas — on
la discipline et on la rend utilisable au doigt. L'écart réel avec la concurrence
n'est pas esthétique, il est dans :
1. **la densité d'information exposée d'un coup** (parcours longs, formulaires à
   1300+ lignes, 30 entrées de navigation réparties en 6 groupes) ;
2. **le mobile**, traité comme un mode dégradé du desktop plutôt que comme un
   parcours pensé pour lui-même.

---

## 2. Diagnostic de l'existant

Base : `docs/UX_AUDIT.md` (6,1/10 simplicité) + revue de code ciblée mobile
(composants partagés + pages les plus denses).

**Ce qui fonctionne déjà bien** (à ne pas casser) :
- `AppShell`/`Sidebar` : tiroir mobile avec piège à focus, fermeture Échap,
  fermeture au changement de route — accessibilité déjà soignée.
- `Modal` : hauteur bornée (`max-h-[90vh]`), défilement interne, marge latérale
  mobile — pas de modale hors écran.
- Viewport meta correct (`viewportFit: cover`, zoom autorisé) dès `app/layout.tsx`.
- La plupart des grilles de métriques/formulaires utilisent déjà
  `grid-cols-1 sm:grid-cols-2` ou `grid-cols-2 sm:grid-cols-4` — donc s'empilent
  correctement sur petit écran (`pilotage`, `campaigns/new`, etc.).
- L'éditeur vidéo (`components/editor/StudioEditor.tsx`) affiche déjà un bandeau
  d'avertissement mobile — un outil de montage timeline reste, à raison, un
  outil desktop (aucun concurrent n'en propose un mobile non plus).

**Ce qui ne fonctionne pas / racine du problème** :
- **Navigation à 30 entrées / 6 groupes accordéon** : sur mobile, le tiroir
  hamburger est le SEUL accès à la navigation — chaque changement de section
  coûte 2 taps (ouvrir le tiroir + trouver le bon groupe déplié). Aucune des
  tâches quotidiennes (piloter, composer, consulter la messagerie) n'est
  accessible en un tap. C'est la racine de « pas mobile friendly » : l'app est
  utilisable au doigt techniquement, mais pas *pratique*.
- **Tableau HTML sans défilement horizontal** : `app/(paid)/campaigns/[id]/page.tsx`
  (détail d'une campagne — table des publicités, 6 colonnes) est enveloppé dans
  `overflow-hidden` au lieu de `overflow-x-auto` : sur mobile les colonnes de
  droite (CTR, conversions, statut) sont **rognées et inaccessibles**, sans
  indication qu'il en manque. Seule table du produit dans ce cas (les autres —
  `ad-performance`, `MetaAdAccountsPanel`, `MetaAdsPublisher`, `veille`,
  `BenchmarkCard` — ont déjà le bon pattern `overflow-x-auto` + `min-w-[...]`).
- **Parcours longs sans repères** (`campaigns/new` 1385 lignes, `article-linkedin`,
  onboarding `/demarrage`) : tout est accessible en défilement continu au lieu
  d'un stepper — sur desktop c'est dense, sur mobile c'est décourageant (déjà
  identifié dans `UX_AUDIT.md` #3).
- **Feedback IA asynchrone** : génération d'image/vidéo (15–60 s) sans état de
  progression clair — plus pénalisant sur mobile où l'utilisateur ne peut pas
  facilement faire autre chose en parallèle dans un autre onglet.

---

## 3. Direction de design retenue

1. **On garde et on affine l'identité « Mission Control »** — c'est l'avantage
   concurrentiel visuel. On la discipline : moins de tuiles simultanées à l'écran,
   hiérarchie plus stricte entre action principale et secondaire.
2. **Mobile = parcours dédié, pas un desktop qui rétrécit.** Priorité 1 : une
   barre de navigation basse (bottom tab bar) pour les 5 tâches quotidiennes,
   qui coexiste avec le tiroir complet (accessible via l'onglet « Plus »).
3. **Aucune donnée ne doit être rognée silencieusement** — tout tableau/grille
   dense a un mode « scroll horizontal explicite » ou « cartes empilées »,
   jamais un `overflow-hidden` qui coupe du contenu.
4. **Cohérence par composants partagés**, pas par correctif page par page —
   toute nouvelle primitive (table responsive, grille de stats) vit dans
   `components/ui/` et se propage.

## 4. Priorisation (Now / Next / Later)

**Now — livré dans ce chantier**
- **Barre de navigation basse mobile/tablette** (`components/shell/MobileTabBar.tsx`) :
  Pilotage / Composer / Messagerie / Médiathèque / Plus (tiroir complet), accès
  1-tap aux tâches quotidiennes au lieu de 2 taps via le seul hamburger.
- **Tableau `campaigns/[id]` corrigé** : `overflow-hidden` → `overflow-x-auto`,
  les colonnes (CTR, conversions, statut) étaient rognées et inaccessibles sur
  mobile, elles sont maintenant atteignables au défilement.
- **Grilles fixes qui ne s'empilaient pas** corrigées (`audiences`,
  `ad-sets/[id]`, `AdDetailModal`) : passage systématique en
  `grid-cols-1/2 → sm:grid-cols-3/4`.
- **Modale `AdDetailModal`** : la colonne fixe `280px` qui ne laissait que
  ~80 px de contenu sur un écran de 375 px passe en `grid-cols-1` empilé sous
  `md`, colonnes `280px_1fr` au-delà.
- **Cibles tactiles** : boutons de fermeture des modales (24 px → 32 px) sur
  6 composants, onglets (`Tabs`), chevron d'expansion des campagnes.
- **Actions révélées uniquement au survol** (Modifier/Supprimer sur les lignes
  de campagnes) rendues visibles en permanence sous `sm` — inaccessibles au
  doigt auparavant, la souris desktop garde le survol existant.

**Deuxième tranche — livrée dans ce chantier**
- Vérification au cas par cas des 7 derniers foyers d'actions hover-only
  recensés par l'audit (`MediaLibrary`, `AssetLibrary`, `RunTimeline`,
  `BrandConsultant`, `AiPanel`, `publicites`, `studio-video`) : 6 étaient déjà
  cliquables en entier (la case entière est un `<a>`/`<button>`, le hover
  n'est qu'un indice visuel) donc laissés tels quels ; **`AiPanel.tsx`** était
  un vrai blocage — les boutons « Utiliser » et télécharger sur les visuels
  IA générés (utilisés dans Compose/Agents) n'étaient atteignables qu'au
  survol souris, corrigé comme les autres (`sm:opacity-0 sm:group-hover:…`).
- `components/ui/ScrollFade.tsx` : dégradé de bord qui signale qu'un tableau
  scrollable a du contenu caché (gauche/droite selon la position de
  défilement), appliqué à `MetaAdAccountsPanel`, `ad-performance`,
  `MetaAdsPublisher` — ces tableaux défilaient déjà horizontalement mais rien
  n'indiquait qu'il fallait le faire.

**Next** (chantiers identifiés, hors périmètre de cette PR — à planifier)
- Repli en cartes empilées (au lieu du simple défilement horizontal + fade)
  pour les 3 tableaux ci-dessus sous `sm` : plus confortable au doigt, mais
  demande de reconstruire la logique de rendu ligne↔carte pour chacun
  (dont une ligne de total calculée pour `MetaAdAccountsPanel`) — un chantier
  par table, pas une primitive générique à brancher partout.
- Stepper visuel sur les parcours longs (`/demarrage`, `/article-linkedin`,
  `/campaigns/new`) — déjà recommandé par `UX_AUDIT.md`.
- Spinner + durée estimée systématiques sur toute opération IA > 3 s.
- Consolidation `/accounts` + `/parametres-connecteurs` en une seule page à
  onglets (Statut / Config avancée).
- Aperçu split-screen dans le Composer (texte ↔ rendu par réseau).

**Later**
- Revue complète de l'arborescence de navigation (30 entrées / 6 groupes) —
  chantier plus profond nécessitant validation métier avant d'y toucher
  (impacte tous les liens internes et l'aide contextuelle bilingue).
- L'éditeur créatif (`StudioEditor`, montage vidéo/timeline) reste desktop-only
  par nature (comme chez tous les concurrents) : conservé tel quel, avec son
  bandeau d'avertissement existant sous `lg`.
