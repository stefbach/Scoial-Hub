# Dossier App Review Meta — AXON-AI · Social Media

Checklist complète pour passer l'app Meta du **mode Développement** (toi + testeurs)
au **mode Live** (n'importe quel client se connecte en 1 clic).

Domaine de production : **https://scoial-hub.vercel.app**
Contact : **sbach1964@gmail.com**

---

## 0. Pré-requis (à faire avant de soumettre)

- [ ] **Business Verification** du Business Manager (Paramètres de l'entreprise → Sécurité → Vérification).
      → pièce justificative d'entreprise (registre, facture, etc.). Délai : quelques jours.
- [ ] App rattachée à ce **Business Manager** (Paramètres de base → Vérification de l'entreprise).
- [ ] **Paramètres → De base** complétés :
  - Domaines de l'application : `scoial-hub.vercel.app`
  - URL de la politique de confidentialité : `https://scoial-hub.vercel.app/legal/confidentialite`
  - URL des conditions d'utilisation : `https://scoial-hub.vercel.app/legal/conditions`
  - URL de suppression des données : `https://scoial-hub.vercel.app/legal/suppression-donnees`
  - Catégorie : Entreprise / Marketing
  - Icône de l'app (1024×1024) + e-mail de contact.
- [ ] **Facebook Login for Business → Paramètres** :
  - « Connexion OAuth client » = Oui, « Connexion OAuth Web » = Oui
  - URI de redirection OAuth valides :
    - `https://scoial-hub.vercel.app/api/connectors/facebook/callback`
    - `https://scoial-hub.vercel.app/api/connectors/instagram/callback`
- [ ] Variables Vercel posées : `NEXT_PUBLIC_APP_URL`, `META_APP_ID`, `META_APP_SECRET`.

---

## 1. Permissions à demander (Meta) + justification à copier-coller

Pour chaque permission : **App Review → Permissions and Features → Request Advanced Access**.
Colle la justification (en anglais, Meta l'exige) ci-dessous.

### `pages_show_list`
> Our users connect their own Facebook pages to manage them. This permission lets them select
> which Page to manage within our dashboard after logging in with Facebook Login for Business.

### `pages_read_engagement`
> We display each connected Page's real insights (followers, reach, post engagement) in the
> user's analytics dashboard and use them to generate AI content recommendations.

### `pages_manage_posts`
> Users schedule and publish organic posts to their own Facebook Page from our app. This
> permission is required to create posts on the Page the user explicitly connected and selected.

### `instagram_basic`
> We retrieve the Instagram Business account linked to the user's Page to show its profile and
> basic data within the dashboard.

### `instagram_content_publish`
> Users publish images and videos to their own Instagram Business account from our content studio.

### `instagram_manage_insights`
> We display the Instagram account's real metrics (followers, media, engagement) and use them for
> AI-driven content optimization recommendations.

### `pages_manage_engagement`
> Users reply to comments on their own Facebook Page from our shared inbox. AI drafts a reply in the
> brand voice; the user reviews and sends it (or an autonomous agent sends it when confident), and
> sensitive messages are escalated to a human. Required to post those replies on the connected Page.

### `instagram_manage_comments`
> Users read and reply to comments on their own Instagram Business account from our shared inbox,
> with the same AI-draft + human-approval / escalation workflow as Facebook. Required to read the
> comments and publish replies on the connected Instagram account.

### `pages_messaging`
> Users read and answer private Messenger conversations of their own Facebook Page from our shared
> inbox. AI drafts replies in the brand voice; the user approves and sends, or an autonomous agent
> sends when confident, and sensitive messages are escalated to a human. Required to read the
> conversation history and send replies within the standard messaging window.

### `instagram_manage_messages`
> Same as pages_messaging for the user's Instagram Business account: read and answer Instagram
> Direct messages from our shared inbox with AI-draft + human-approval / escalation.

### `ads_management`
> Users create, read and manage advertising campaigns on their own Meta ad accounts from our app.
> Campaigns are created PAUSED and only activated by an explicit user action, with budget caps.

### `business_management`
> We let users select among the businesses/ad accounts/Pages they manage and read account-level
> data needed to operate their advertising and publishing within our platform.

> `public_profile` / `email` : accès standard, pas de review nécessaire.

---

## 2. Compte de test à fournir à Meta

Meta teste l'app. Fournis un **compte de test** (utilisateur Facebook de test ou réel dédié)
avec accès à une Page + un compte Instagram Business + un compte publicitaire de test.

- [ ] Créer un **Test User** : App → Roles → Test Users (ou un compte réel dédié à la review).
- [ ] Lier une **Page de test** + un **compte Instagram Business** + un **ad account de test**.
- [ ] Donner les identifiants de connexion **à l'app AXON-AI** (email/mot de passe créés côté admin)
      dans le champ « Instructions pour le testeur ».

---

## 3. Script de la vidéo de démonstration (screencast)

Meta exige une vidéo montrant le **parcours complet de connexion + usage** de CHAQUE permission.
Enregistre l'écran (1 prise, 2–4 min, son ou sous-titres en anglais) :

1. **Login** : ouvrir https://scoial-hub.vercel.app → se connecter avec le compte de test.
2. **Connexion Facebook (OAuth)** : aller dans **Démarrage → Connectez vos comptes** → cliquer
   « Connecter » Facebook → écran de consentement Facebook → revenir connecté.
   *(montre pages_show_list, pages_read_engagement, instagram_basic, business_management)*
3. **Sélection de Page** : ouvrir **Mes Pages & données** → choisir la Page → montrer les données
   réelles (abonnés, posts). *(pages_read_engagement, instagram_manage_insights)*
4. **Publication organique** : créer un post (Composer/Studio) et le publier sur la Page + Instagram.
   *(pages_manage_posts, instagram_content_publish)*
5. **Publicité** : dans **Mes Pages & données → Publicité Meta**, créer une publicité (EN PAUSE),
   montrer le compte publicitaire et les campagnes réelles. *(ads_management, business_management)*
6. **Messagerie (réponse aux commentaires)** : ouvrir **Messagerie**, cliquer « Synchroniser Meta »
   pour importer les commentaires réels FB + IG, générer une réponse IA, l'éditer et l'**envoyer**
   (montrer qu'elle apparaît sur la publication). *(pages_manage_engagement, instagram_manage_comments)*
7. **Suppression des données** : montrer la déconnexion d'un réseau + la page
   `/legal/suppression-donnees`.

> Astuce : commente chaque étape en disant la permission utilisée. Meta rejette si une permission
> n'est pas démontrée à l'écran.

---

## 4. Champs « How will you use this permission » (résumé global)

> AXON-AI is a social media management SaaS. Each business connects its OWN Facebook/Instagram
> assets via Facebook Login for Business. We read their Page/IG insights to power dashboards and
> AI recommendations, publish organic content they create, and create/manage ads on their own ad
> accounts (created paused, activated only by explicit user action with budget caps). We never
> access assets the user did not connect, never sell data, and provide full data-deletion controls.

---

## 5. Soumission

- [ ] App Review → ajouter chaque permission ci-dessus + justification.
- [ ] Joindre la **vidéo** + les **instructions testeur** (compte AXON-AI + ce qu'il y a dedans).
- [ ] Vérifier que l'app est **rattachée au Business vérifié**.
- [ ] **Soumettre**. Délai Meta : ~3 à 15 jours ouvrés selon permissions.
- [ ] Une fois approuvé : passer l'app en **Live** (interrupteur en haut du tableau de bord Meta).

---

## 6. En attendant l'approbation (mode Développement)

Tu peux exploiter l'app **dès maintenant**, sans review :
- **App → Roles** : ajoute en **Testeur** chaque personne dont tu connectes les comptes
  (toi + premiers clients). Chacun doit **accepter l'invitation** côté Facebook.
- Limite : quelques dizaines de personnes à rôles → parfait pour pilote, pas pour le self-service public.

---

## 7. LinkedIn & TikTok (séparé, pour plus tard)

- **LinkedIn** : Developer Portal → demander **Marketing Developer Platform** + produits
  « Sign In with LinkedIn (OpenID) », « Share on LinkedIn », « Advertising API ». Redirect :
  `https://scoial-hub.vercel.app/api/connectors/linkedin/callback`. Variables : `LINKEDIN_CLIENT_ID`,
  `LINKEDIN_CLIENT_SECRET`.
- **TikTok** : business-api.tiktok.com → créer une app → faire approuver les scopes (publication +
  analytics). Renseigner Advertiser ID + Access Token dans le connecteur.

---

## Récap des URLs (prêtes à coller)

| Élément | URL |
|---|---|
| App | https://scoial-hub.vercel.app |
| Politique de confidentialité | https://scoial-hub.vercel.app/legal/confidentialite |
| Conditions d'utilisation | https://scoial-hub.vercel.app/legal/conditions |
| Suppression des données | https://scoial-hub.vercel.app/legal/suppression-donnees |
| Callback Facebook | https://scoial-hub.vercel.app/api/connectors/facebook/callback |
| Callback Instagram | https://scoial-hub.vercel.app/api/connectors/instagram/callback |
| Callback LinkedIn | https://scoial-hub.vercel.app/api/connectors/linkedin/callback |
