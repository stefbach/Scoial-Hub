# ✅ Tableau de recette — AXON-AI / Social Hub

> Objectif : déterminer, fonctionnalité par fonctionnalité, **ce qui marche / ne marche pas**.
> Remplir la colonne **Statut** : ✅ OK · ❌ KO · ⏭️ Non applicable. Détailler tout problème en **Remarques**.

## 🧾 Informations de session

| Champ | Valeur |
|---|---|
| Testeur | |
| Date | |
| Environnement | ☐ Production ☐ Préprod ☐ Local |
| URL testée | |
| Navigateur / OS | |
| Société de test | |
| Rôle / accès | ☐ Admin compte ☐ Éditeur ☐ Lecture seule |

---

## 1. Authentification & accès

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 1.1 | Inscription | 1. Aller sur `/signup` 2. Saisir e-mail + mot de passe 3. Valider | Compte créé, redirection/connexion ou e-mail de confirmation | | |
| 1.2 | Connexion | 1. `/login` 2. Identifiants valides 3. Valider | Arrivée sur l'app (dashboard/démarrage) | | |
| 1.3 | Identifiants erronés | 1. `/login` 2. Mauvais mot de passe | Message d'erreur clair, pas de plantage | | |
| 1.4 | Session persistante | 1. Connecté, recharger (F5) | Toujours connecté | | |
| 1.5 | Page protégée | 1. Déconnecté, ouvrir une URL interne (ex. `/dashboard`) | Redirection vers `/login` | | |
| 1.6 | Déconnexion | 1. Cliquer « Se déconnecter » (bas de la barre) | Retour login, session fermée, société oubliée | | |

---

## 2. Identité de marque (`/identite`)

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 2.1 | Affichage charte | 1. Ouvrir `/identite` | Logo, palette, ton, résumé affichés | | |
| 2.2 | Génération IA | 1. Lancer l'analyse/génération de l'identité | Charte cohérente générée (couleurs, ton, tagline) | | |
| 2.3 | Upload logo / charte | 1. Importer un logo 2. Recharger la page | L'asset est conservé après rechargement | | |
| 2.4 | Édition manuelle | 1. Modifier ton/couleurs 2. Enregistrer 3. Recharger | Modifications persistées | | |

---

## 3. Démarrage assisté (`/demarrage`)

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 3.1 | Étape Objectifs | 1. Sélectionner des objectifs 2. Continuer | Choix pris en compte, passage à l'étape suivante | | |
| 3.2 | Étape Concurrence | 1. Saisir des concurrents | Concurrents enregistrés | | |
| 3.3 | Étape Agents | 1. Configurer/activer des agents | Configuration sauvegardée | | |
| 3.4 | Étape Diffusion | 1. Régler réseaux/planning | Paramètres de diffusion enregistrés | | |
| 3.5 | Consultant de marque | 1. Suivre les recommandations de l'assistant | Suggestions cohérentes et actionnables | | |
| 3.6 | Reprise du parcours | 1. Quitter en cours 2. Revenir sur `/demarrage` | Étape & saisies conservées | | |
| 3.7 | Finalisation | 1. Terminer toutes les étapes | Onboarding marqué « complété » | | |

---

## 4. Tableau de bord (`/dashboard`)

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 4.1 | Chargement KPIs | 1. Ouvrir `/dashboard` | Indicateurs affichés sans erreur | | |
| 4.2 | Données par société | 1. Changer de société (sélecteur en haut de la barre) | Les chiffres se rafraîchissent pour la société | | |
| 4.3 | Raccourcis | 1. Cliquer un raccourci/carte | Redirection vers le bon module | | |

---

## 5. Centre de pilotage (`/pilotage`)

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 5.1 | Vue d'ensemble | 1. Ouvrir `/pilotage` | Synthèse stratégie/activité affichée | | |
| 5.2 | Actions proposées | 1. Cliquer une action recommandée | Mène à l'action/module concerné | | |

---

## 6. Organisation

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 6.1 | Liste des sociétés | 1. `/mes-societes` | Toutes les sociétés du compte listées | | |
| 6.2 | Ajouter une société | 1. Créer une société 2. La sélectionner | Création OK, sélectionnable partout | | |
| 6.3 | Bascule société | 1. Changer via le sélecteur | Contexte mis à jour dans toute l'app | | |
| 6.4 | Mon équipe (visibilité) | 1. En non-admin, chercher « Mon équipe » | Entrée masquée (admin uniquement) | | |
| 6.5 | Inviter un membre | 1. `/mon-equipe` (admin) 2. Inviter par e-mail | Invitation envoyée | | |
| 6.6 | Rôles & accès | 1. Passer un membre en lecture seule / éditeur | Droit appliqué (cf. §14.3) | | |

---

## 7. Veille & Stratégie

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 7.1 | Mes Pages — connexion Meta | 1. `/pages-meta` 2. Relier une Page FB/IG | Page connectée, état « connecté » | | |
| 7.2 | Mes Pages — données | 1. Après connexion, consulter les données | Posts/stats de la Page remontent | | |
| 7.3 | Espace LinkedIn | 1. `/linkedin` | La page s'affiche (connexion/état clair) | | |
| 7.4 | Article LinkedIn | 1. `/article-linkedin` 2. Générer un article | Article rédigé selon le ton de marque | | |
| 7.5 | Agents — liste | 1. `/agents` | Agents disponibles affichés | | |
| 7.6 | Agents — exécution | 1. Lancer un agent 2. Observer la timeline | Déroulé visible, résultat cohérent | | |
| 7.7 | Inbox — affichage | 1. `/inbox` | Messages/commentaires listés | | |
| 7.8 | Inbox — réponse | 1. Répondre à un message | Réponse envoyée (ou état clair si non connecté) | | |
| 7.9 | Veille — lancement | 1. `/veille` 2. Saisir concurrents + mots-clés 3. Lancer | Analyse générée sans erreur | | |
| 7.10 | Veille — résultats | 1. Consulter le rapport | Formats gagnants, angles, benchmark par réseau | | |
| 7.11 | Veille — mémoire | 1. Vérifier que les insights nourrissent la stratégie | Insights réutilisés (Copilote, campagnes) | | |
| 7.12 | Pubs concurrentes | 1. `/publicites` 2. Lancer l'analyse | Insights publicitaires lisibles | | |
| 7.13 | Benchmark | 1. `/benchmark` | Comparatif/graphes affichés | | |
| 7.14 | Connecteurs — liste | 1. `/parametres-connecteurs` | Services + état (connecté/non) | | |
| 7.15 | Connecteurs — action | 1. Connecter/déconnecter un service | État mis à jour | | |

---

## 8. Simulateur & Copilote de lancement (`/simulateur`) ⭐

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 8.1 | Mode Copilote (défaut) | 1. Ouvrir `/simulateur` | Le chat « Copilote de lancement » s'affiche par défaut | | |
| 8.2 | Données récupérées | 1. Observer le bandeau « Données de marque récupérées » | Puces : identité, veille, pubs, campagnes (✓/○) | | |
| 8.3 | Dialogue | 1. Décrire un projet de lancement 2. Répondre aux questions | Le copilote répond et pose des questions ciblées | | |
| 8.4 | Brief en direct | 1. Suivre le panneau « Brief en construction » | Les champs se remplissent au fil du chat | | |
| 8.5 | Brief prêt | 1. Compléter jusqu'à « prêt » | Bouton « Passer à la simulation » activé | | |
| 8.6 | Simulation | 1. Lancer la simulation | Score + personas + angles + recommandations | | |
| 8.7 | Stratégie | 1. « Générer la stratégie » | Stratégie ventilée Organique / Publicitaire + calendrier | | |
| 8.8 | Application (brouillons) | 1. « Créer les brouillons » | Campagnes créées **EN PAUSE** + posts en **brouillon** (rien activé) | | |
| 8.9 | Vérif. brouillons | 1. Aller dans Campagnes et Programmés | Retrouver les éléments créés (en pause / brouillon) | | |
| 8.10 | Mode manuel | 1. Basculer sur « Mode manuel » 2. Remplir le formulaire 3. Lancer | Résultat de simulation affiché | | |
| 8.11 | Robustesse | 1. Provoquer/observer un échec IA | Message « réessayez » lisible, pas d'écran cassé | | |

---

## 9. Organique — Création de contenu

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 9.1 | Composer — génération | 1. `/compose` 2. Générer un post | Texte conforme au ton de marque | | |
| 9.2 | Composer — inspiration | 1. Utiliser l'inspiration créative | Suggestions proposées | | |
| 9.3 | Composer — planifier | 1. Choisir réseau/date/heure 2. Programmer | Post planifié (visible dans Programmés) | | |
| 9.4 | Studio vidéo — copilote | 1. `/studio-video` 2. Décrire une idée | Prompt + modèle + format proposés | | |
| 9.5 | Studio vidéo — génération | 1. Lancer la génération | Rendu produit (ou file/erreur claire si non configuré) | | |
| 9.6 | Studio Avatar | 1. `/studio-avatar` 2. Script + voix + portrait 3. Générer | Vidéo d'avatar parlant (ou état clair) | | |
| 9.7 | Studio Affiches | 1. `/studio-affiche` 2. Générer un visuel | Affiche générée, charte respectée | | |
| 9.8 | Médiathèque | 1. `/media` | Médias générés/importés affichés | | |
| 9.9 | Médiathèque — réutilisation | 1. Sélectionner un média pour un post | Média rattaché à la création | | |

---

## 10. Organique — Planification & automatisation

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 10.1 | Programmés — calendrier | 1. `/scheduled` | Posts planifiés affichés | | |
| 10.2 | Programmés — brouillons | 1. Repérer les brouillons (ex. issus du Copilote) | Visibles et éditables | | |
| 10.3 | Programmés — édition | 1. Modifier un post 2. Enregistrer | Modification persistée | | |
| 10.4 | Programmés — suppression | 1. Supprimer un post | Retiré du calendrier | | |
| 10.5 | Modèles | 1. `/library` 2. Utiliser un modèle | Pré-remplit une création | | |
| 10.6 | Automatisations — créer | 1. `/automations` 2. Créer une règle | Règle créée | | |
| 10.7 | Automatisations — état | 1. Activer/désactiver une règle | État (active/pause) correct | | |
| 10.8 | Historique | 1. `/history` | Journal des actions/publications | | |

---

## 11. Publicité (Paid Ads)

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 11.1 | Campagnes — liste | 1. `/campaigns` | Campagnes + statut (active/pause) | | |
| 11.2 | Campagne — création | 1. `/campaigns/new` 2. Renseigner nom/objectif/plateformes/budget 3. Créer | Campagne créée (par défaut en pause) | | |
| 11.3 | Campagne — détail | 1. Ouvrir une campagne | Détails + liste des ad sets | | |
| 11.4 | Ad set — création/édition | 1. Ajouter/éditer un ad set (audience, budget, optimisation) | Ad set enregistré | | |
| 11.5 | Assistant pub IA | 1. Utiliser l'assistant (ciblage/créa) | Suggestions pertinentes | | |
| 11.6 | Sécurité budget | 1. Tenter une dépense > plafond / activer une campagne | Confirmation/blocage déclenché | | |
| 11.7 | Audiences — liste | 1. `/audiences` | Audiences affichées | | |
| 11.8 | Audiences — gestion | 1. Créer/éditer une audience | Enregistrement OK | | |
| 11.9 | Performance Ads | 1. `/ad-performance` | Dépense, conversions, CPC, top pubs | | |
| 11.10 | Performance — tendances | 1. Observer graphes/évolutions | Données cohérentes | | |

---

## 12. Pilotage & Bots

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 12.1 | Telegram — jumelage | 1. `/telegram` 2. Obtenir le code 3. Lier au bot | Compte relié au bot central | | |
| 12.2 | Telegram — réception | 1. Déclencher une notif de test | Notification reçue dans Telegram | | |
| 12.3 | MCP Claude — affichage | 1. `/mcp` | Instructions/connecteur visibles | | |
| 12.4 | MCP Claude — connexion | 1. Suivre le flux de connexion | Étapes claires, pas d'erreur | | |

---

## 13. Général

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 13.1 | Analytics | 1. `/analytics` | Tableaux/graphes affichés | | |
| 13.2 | Comptes sociaux — liste | 1. `/accounts` | Comptes reliés + état | | |
| 13.3 | Comptes sociaux — action | 1. Connecter/déconnecter un compte | Action fonctionnelle | | |
| 13.4 | Paramètres — sociétés | 1. `/settings` → Sociétés | Gestion des sociétés | | |
| 13.5 | Paramètres — équipe | 1. `/settings` → Équipe | Gestion membres/rôles | | |
| 13.6 | Paramètres — sécurité dépenses | 1. Régler plafonds / double confirmation IA | Réglages enregistrés et appliqués | | |

---

## 14. Transverse (UX & robustesse)

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 14.1 | Langue FR/EN | 1. Basculer la langue | Libellés traduits partout | | |
| 14.2 | Multi-société | 1. Alterner entre sociétés | Données isolées (pas de fuite entre sociétés) | | |
| 14.3 | Lecture seule | 1. En accès « lecture seule », tenter de modifier | Actions grisées/bloquées | | |
| 14.4 | Responsive mobile | 1. Ouvrir sur mobile | Navigation et pages clés utilisables | | |
| 14.5 | Gestion des erreurs | 1. Provoquer une erreur réseau | Message lisible, pas d'écran blanc | | |
| 14.6 | Performance | 1. Charger les pages principales | Affichage en quelques secondes | | |

---

## 15. Administration (super-admin) — *si applicable*

| Réf | Fonctionnalité | Étapes détaillées | Résultat attendu | Statut | Remarques |
|---|---|---|---|---|---|
| 15.1 | Connexion admin | 1. `/admin/login` | Accès réservé OK | | |
| 15.2 | Comptes | 1. `/admin/comptes` | Liste, création, détail, connexions, Telegram | | |
| 15.3 | Utilisateurs | 1. `/admin/utilisateurs` | Gestion des utilisateurs | | |
| 15.4 | Validation | 1. `/admin/validation` | File de validation traitée | | |

---

## 📊 Synthèse finale

| Module | Nb OK | Nb KO | Bloquant ? | Remarques |
|---|---|---|---|---|
| 1. Authentification | | | | |
| 2. Identité de marque | | | | |
| 3. Démarrage assisté | | | | |
| 4-5. Dashboard / Pilotage | | | | |
| 6. Organisation | | | | |
| 7. Veille & Stratégie | | | | |
| 8. Simulateur / Copilote | | | | |
| 9-10. Organique | | | | |
| 11. Publicité | | | | |
| 12. Bots | | | | |
| 13. Général | | | | |
| 14. Transverse | | | | |
| 15. Admin | | | | |

**Verdict global :** ☐ Prêt production ☐ Prêt avec réserves ☐ Non prêt

**Anomalies bloquantes à corriger en priorité :**
1. 
2. 
3. 
