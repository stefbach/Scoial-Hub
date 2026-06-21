# ✅ Checklist de recette — AXON-AI / Social Hub

> Document à remettre aux testeurs pour valider **l'ensemble des fonctionnalités**.
> Cocher `[x]` quand le test passe. Noter tout écart dans **Remarques**.

## 🧾 Informations de session de test

| Champ | Valeur |
|---|---|
| Testeur (nom) | |
| Date | |
| Environnement | ☐ Production ☐ Préprod ☐ Local |
| Navigateur / OS | |
| Société de test | |
| Rôle / accès | ☐ Admin compte ☐ Éditeur ☐ Lecture seule |

**Légende :** `- [ ]` à tester · `- [x]` OK · ❌ = échec (préciser en Remarques) · ⏭️ = non applicable

---

## 1. Accès & Authentification
- [ ] **Inscription** — créer un compte via `/signup` → compte créé, e-mail/redirection OK.
- [ ] **Connexion** — se connecter via `/login` → arrivée sur l'app.
- [ ] **Mauvais identifiants** — message d'erreur clair, pas de plantage.
- [ ] **Session persistante** — recharger la page → toujours connecté.
- [ ] **Déconnexion** — bouton « Se déconnecter » → retour au login, session fermée.
- [ ] **Page protégée sans login** — accès direct à une URL interne → redirection vers login.

🗒️ Remarques : 

---

## 2. Identité de marque (`/identite`)
- [ ] **Affichage** — la charte (logo, palette, ton, résumé) s'affiche.
- [ ] **Génération IA** — lancer l'analyse/génération de l'identité → résultat cohérent.
- [ ] **Upload logo / charte** — l'asset s'enregistre et reste après rechargement.
- [ ] **Édition manuelle** — modifier ton/couleurs → sauvegarde persistée.

🗒️ Remarques : 

---

## 3. Démarrage assisté (`/demarrage`)
- [ ] **Parcours pas-à-pas** — dérouler toutes les étapes (objectifs, réseaux, concurrence, agents, diffusion).
- [ ] **Consultant de marque** — l'assistant propose une stratégie cohérente.
- [ ] **Reprise** — quitter puis revenir → l'étape/les choix sont conservés.
- [ ] **Finalisation** — terminer l'onboarding → état marqué « complété ».

🗒️ Remarques : 

---

## 4. Tableau de bord (`/dashboard`)
- [ ] **Chargement** — les indicateurs clés s'affichent sans erreur.
- [ ] **Données par société** — changer de société → les chiffres se mettent à jour.
- [ ] **Liens rapides** — les raccourcis mènent aux bons modules.

🗒️ Remarques : 

---

## 5. Centre de pilotage (`/pilotage`)
- [ ] **Vue d'ensemble** — synthèse stratégique / activité affichée.
- [ ] **Actions proposées** — les recommandations sont pertinentes et cliquables.

🗒️ Remarques : 

---

## 6. Organisation
### Mes sociétés (`/mes-societes`)
- [ ] **Liste** — toutes les sociétés du compte s'affichent.
- [ ] **Ajouter une société** — création OK, sélectionnable ensuite.
- [ ] **Basculer de société** — le sélecteur change le contexte partout.
### Mon équipe (`/mon-equipe`, admin)
- [ ] **Visible admin uniquement** — masqué pour un non-admin.
- [ ] **Inviter un membre** — invitation envoyée.
- [ ] **Rôles & accès** — modifier édition/lecture seule → appliqué.

🗒️ Remarques : 

---

## 7. Veille & Stratégie (Pilotage IA)
### Mes Pages & données (`/pages-meta`)
- [ ] **Connexion Meta** — relier une Page Facebook/Instagram.
- [ ] **Affichage données** — posts / statistiques de la Page remontent.
### Espace LinkedIn (`/linkedin`)
- [ ] **Connexion / espace** — la page LinkedIn s'affiche.
- [ ] **Article LinkedIn** (`/article-linkedin`) — rédaction assistée d'un article.
### Agents (`/agents`)
- [ ] **Liste des agents** — affichage des agents disponibles.
- [ ] **Lancer un agent** — exécution + timeline de déroulé visible.
- [ ] **Résultat** — sortie cohérente, pas d'erreur bloquante.
### Messagerie / Inbox (`/inbox`)
- [ ] **Affichage** — messages/commentaires listés.
- [ ] **Répondre** — l'action de réponse fonctionne (ou état clair si non connecté).
### Veille & Marché (`/veille`)
- [ ] **Lancer une veille** — saisir concurrents/mots-clés → analyse générée.
- [ ] **Résultats** — formats gagnants, angles, benchmark par réseau affichés.
- [ ] **Mémoire** — les insights alimentent la stratégie (réutilisés ailleurs).
### Pubs concurrentes (`/publicites`)
- [ ] **Analyse** — récupération/analyse des pubs concurrentes.
- [ ] **Restitution** — insights publicitaires lisibles.
### Simulateur & Prédiction (`/simulateur`) ⭐
- [ ] **Copilote de lancement (par défaut)** — le chat répond et **guide** la construction du brief.
- [ ] **Données de marque récupérées** — les puces (identité, veille, pubs, campagnes) s'affichent.
- [ ] **Brief en direct** — le panneau de brief se remplit au fil du dialogue.
- [ ] **Passage à la simulation** — bouton actif une fois le brief « prêt ».
- [ ] **Simulation standard (Claude)** — score + personas + recommandations affichés.
- [ ] **Simulation premium (MiroFish)** — *si* MiroFish branché : pipeline complet → rapport.
- [ ] **Stratégie** — génération d'une stratégie ventilée organique / publicitaire.
- [ ] **Application (brouillons)** — crée campagnes **en pause** + posts en **brouillon** (rien d'activé sans validation).
- [ ] **Mode manuel** — l'ancien formulaire fonctionne aussi.
- [ ] **Résilience** — en cas d'échec IA, message « réessayez » (pas de page cassée).
### Benchmark (`/benchmark`)
- [ ] **Affichage** — comparatif/benchmark visible.
### Connecteurs (`/parametres-connecteurs`, `/connecteurs`)
- [ ] **Liste des connecteurs** — services affichés avec état (connecté/non).
- [ ] **Connexion / déconnexion** — l'action met à jour l'état.

🗒️ Remarques : 

---

## 8. Organique
### Composer (`/compose`)
- [ ] **Rédaction IA** — générer un post (ton de marque respecté).
- [ ] **Inspiration créative** — suggestions proposées.
- [ ] **Programmer / publier** — planifier le post (date/heure/réseau).
### Studio Créatif vidéo (`/studio-video`)
- [ ] **Copilote créatif** — décrire une idée → prompt/modèle/format proposés.
- [ ] **Génération** — lancer une génération vidéo/visuel (ou état clair si non configuré).
### Studio Avatar (`/studio-avatar`)
- [ ] **Script + voix** — générer un avatar parlant (script, voix, portrait).
- [ ] **Rendu** — la vidéo se génère (ou file d'attente/erreur claire).
### Studio Affiches (`/studio-affiche`)
- [ ] **Génération d'affiche** — créer un visuel (A4/réseaux).
- [ ] **Application charte** — couleurs/ton de marque pris en compte.
### Médiathèque (`/media`)
- [ ] **Affichage** — les médias générés/importés s'affichent.
- [ ] **Réutilisation** — sélectionner un média pour un post.
### Programmés (`/scheduled`)
- [ ] **Calendrier** — les posts planifiés apparaissent.
- [ ] **Brouillons** — les brouillons (ex. issus du Simulateur) sont visibles/éditables.
- [ ] **Édition / suppression** — modifier ou retirer un post programmé.
### Modèles (`/library`)
- [ ] **Liste** — modèles disponibles.
- [ ] **Utiliser un modèle** — pré-remplit une création.
### Automatisations (`/automations`)
- [ ] **Règles** — créer/activer/désactiver une automatisation.
- [ ] **État** — actives/en pause correctement reflétées.
### Historique (`/history`)
- [ ] **Journal** — l'historique des actions/publications s'affiche.

🗒️ Remarques : 

---

## 9. Publicité (Paid Ads)
### Campagnes (`/campaigns`)
- [ ] **Liste** — campagnes affichées avec statut (active/en pause).
- [ ] **Créer une campagne** (`/campaigns/new`) — création complète OK.
- [ ] **Détail campagne** — ouvrir une campagne → infos + ad sets.
- [ ] **Ad set** — créer/éditer un ad set (audience, budget, optimisation).
- [ ] **Assistant pub IA** — suggestions de ciblage/créa.
- [ ] **Sécurité budget** — un plafond/confirmation empêche une dépense non voulue.
### Audiences (`/audiences`)
- [ ] **Liste** — audiences affichées.
- [ ] **Créer / éditer** — gestion d'une audience.
### Performance Ads (`/ad-performance`)
- [ ] **Métriques** — dépense, conversions, CPC, top pubs affichés.
- [ ] **Tendances** — évolutions/graphiques cohérents.

🗒️ Remarques : 

---

## 10. Pilotage & Bots
### Telegram (`/telegram`)
- [ ] **Jumelage** — obtenir un code et relier le compte au bot central.
- [ ] **Réception** — recevoir une notification/commande de test.
### MCP Claude (`/mcp`)
- [ ] **Affichage** — instructions/connecteur MCP visibles.
- [ ] **Connexion** — le flux de connexion est clair.

🗒️ Remarques : 

---

## 11. Général
### Analytics (`/analytics`)
- [ ] **Tableaux/graphes** — données analytiques affichées.
### Comptes sociaux (`/accounts`)
- [ ] **Liste** — comptes reliés affichés avec état.
- [ ] **Connecter / déconnecter** — action fonctionnelle.
### Paramètres (`/settings`)
- [ ] **Sociétés** — gestion des sociétés.
- [ ] **Équipe** — gestion des membres/rôles.
- [ ] **Sécurité des dépenses** — plafonds, double confirmation IA, digest.

🗒️ Remarques : 

---

## 12. Transverse (UX & robustesse)
- [ ] **Langue FR/EN** — bascule de langue → libellés traduits partout.
- [ ] **Multi-société** — changer de société met tout à jour (pas de fuite de données entre sociétés).
- [ ] **Accès lecture seule** — un éditeur « lecture seule » ne peut pas modifier (actions grisées/bloquées).
- [ ] **Responsive mobile** — navigation et pages clés utilisables sur mobile.
- [ ] **Gestion des erreurs** — pas d'écran blanc ; messages d'erreur lisibles.
- [ ] **Performance** — pages principales chargent en quelques secondes.

🗒️ Remarques : 

---

## 13. Administration (super-admin) — *si applicable*
- [ ] **Connexion admin** (`/admin/login`) — accès réservé.
- [ ] **Comptes** (`/admin/comptes`) — liste, création, détail, connexions, Telegram.
- [ ] **Utilisateurs** (`/admin/utilisateurs`) — gestion des utilisateurs.
- [ ] **Validation** (`/admin/validation`) — file de validation traitée.

🗒️ Remarques : 

---

## 14. MiroFish Studio (outil autonome séparé) — *si déployé*
> Hébergé hors Vercel (Railway/Docker), distinct de Social Hub.
- [ ] **Accès** — l'URL du Studio s'ouvre.
- [ ] **Brief** — saisir produit/audience/marché.
- [ ] **Pipeline** — les étapes (graphe → personas → simulation → rapport) défilent.
- [ ] **Rapport** — un rapport exécutif s'affiche.
- [ ] **Chat analyste** — poser une question → réponse de l'agent.

🗒️ Remarques : 

---

### Synthèse finale
| Module | OK | KO | Bloquants |
|---|---|---|---|
| Authentification | | | |
| Identité / Onboarding | | | |
| Dashboard / Pilotage | | | |
| Veille & Stratégie | | | |
| Simulateur / Copilote | | | |
| Organique (studios, calendrier) | | | |
| Publicité | | | |
| Bots & Connecteurs | | | |
| Général / Admin | | | |

**Verdict global :** ☐ Prêt prod ☐ Prêt avec réserves ☐ Non prêt
