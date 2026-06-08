# Audit UX — AXON-AI · Social Media

> Audit multi-agents (orchestrateur + 2 sous-agents lecture seule) du point de vue d'un **gérant de PME non technique**.
> Date : 2026-06. Périmètre : simplicité d'usage des parcours clés + fraîcheur/clarté de l'aide contextuelle.

## Notes globales
| Dimension | Note |
|---|---|
| **Simplicité d'utilisation (UX)** | **6,1 / 10** |
| **Aide contextuelle (fraîcheur & clarté)** | **7,4 / 10** |

L'architecture est solide et l'intention pédagogique forte (onboarding guidé en 6 étapes). Le principal point de friction est la **connexion des réseaux** (trop technique) et le **manque de feedback visuel** sur les opérations longues (analyses IA, génération d'images de 15–60 s).

---

## 1. Simplicité par parcours

| Parcours | Note | Frictions principales |
|---|---|---|
| Onboarding `/demarrage` | 6,5 | Étape 1 : bouton « Analyser » désactivé sans explication ; pas d'indication de durée ; état vide passif. |
| Création société `/comptes` | 8,0 | « Couleur » sans label ; pas de toast de succès ; bouton dupliqué. |
| **Connexion réseaux** `/parametres-connecteurs` + `/accounts` | **5,5** | **Catalogue très technique** (tokens, URN, Field ID) ; pas de tuto ; 2 pages redondantes ; mode simulé peu visible. |
| Pages Meta `/pages-meta` | 7,0 | Sélecteur de Page peu visible ; chargements longs sans message ; analyse IA sans spinner. |
| Espace LinkedIn `/linkedin` | 7,0 | Pas de blocage si non connecté (on saisit avant de l'apprendre) ; accès Pages opaque. |
| Studio Article `/article-linkedin` | 6,0 | Pas de stepper ; images lentes sans feedback ; pas d'aperçu LinkedIn. |
| Messagerie & agents `/inbox` | 5,0 | Réglages d'agent trop techniques (autonomy, threshold) ; pas de test ; statut agents peu visible. |
| Publicité `/campaigns` | 5,5 | Mélange campagnes locales/API ; formulaire dense ; pas de presets ni filtres. |
| Composer `/compose` | 6,5 | Choix de Page imprécis ; fuseau horaire non affiché ; pas d'aperçu par réseau. |

## 2. Top 10 des améliorations priorisées (impact × effort)

1. **Assistant « Connecter Meta » pas-à-pas** (lien vers Facebook Developers, étapes claires) — débloque la connexion réelle.
2. **Unifier `/accounts` + `/parametres-connecteurs`** (une page, onglets Statut / Config avancée).
3. **Stepper visuel** sur les parcours longs (onboarding, article, campagne).
4. **Vérifier la connexion AVANT d'afficher les formulaires** (Meta/LinkedIn/Ads) — éviter la saisie perdue.
5. **Spinner + durée estimée** sur toute opération > 3 s (analyses IA, génération d'images).
6. **Aperçu split-screen** dans le Composer (texte ↔ rendu par réseau).
7. **Simplifier la config d'agent** (radios « Suggérer / Décider / Agir » + descriptions + bouton Test).
8. **Supprimer la duplication campagnes** locales/API ; séparer « Brouillons ».
9. **Presets de campagnes** (« Simple » vs « Avancé »).
10. **Bandeau « mode démo »** explicite quand les API ne sont pas configurées.

## 3. Aide contextuelle

**Couverture : 22 pages documentées sur 27.** Ajouté dans cet audit : **5 entrées manquantes** désormais créées :
`/pages-meta`, `/linkedin`, `/article-linkedin`, `/inbox`, `/publicites`.

À corriger (contenus datés, priorité moyenne) :
- `/compose` : retirer/clarifier les références à Twitter/X (réseau non géré).
- `/agents` : préciser les capacités de publication au niveau 3 (quels réseaux) + lien Studio Article.
- `/studio-video` : clarifier la dépendance moteur de rendu (export auto vs plan de montage).
- `/veille` : vérifier les réseaux réellement collectés (TikTok/YouTube/X).
- `/settings` : aligner le modèle de rôles documenté sur l'implémentation.
- Définir les acronymes (CAPI, URN, RGPD) pour les non-experts.

## 4. Conclusion

L'outil est **complet et cohérent**. Pour franchir le palier « simple à utiliser », trois chantiers prioritaires :
1. **Onboarding de connexion Meta/LinkedIn** réellement guidé (la barrière d'entrée n°1).
2. **Feedback visuel systématique** (spinners + durées) sur les actions IA longues.
3. **Consolidation des pages de configuration** + aperçus avant publication.

Estimation : ces trois chantiers feraient passer la note UX de **6,1 → ~7,8** en ~2 semaines.
