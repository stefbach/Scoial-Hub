// ─── Registre d'aide contextuelle — Social Hub ───────────────────────────────
// Chaque entrée couvre une route de l'application et décrit : à quoi sert la
// rubrique, ses actions clés, des astuces pratiques et des liens connexes.

export interface HelpEntry {
  title: string;
  tagline: string;
  whatItDoes: string;
  keyActions: { label: string; detail: string }[];
  tips?: string[];
  related?: { label: string; href: string }[];
}

// ─── Contenu d'aide par route ─────────────────────────────────────────────────

export const HELP: Record<string, HelpEntry> = {

  "/dashboard": {
    title: "Tableau de bord",
    tagline: "Vue d'ensemble en temps réel de vos 3 marques médicales.",
    whatItDoes:
      "Le tableau de bord centralise les indicateurs clés de performance (KPI) de toutes vos marques : portée, engagement, publications programmées et alertes en cours. C'est votre point d'entrée quotidien pour piloter la stratégie social media d'un seul coup d'œil.",
    keyActions: [
      {
        label: "Changer de marque",
        detail:
          "Utilisez le sélecteur de marque en haut à gauche pour basculer entre vos 3 marques médicales. Chaque marque dispose de son propre périmètre de données.",
      },
      {
        label: "Lire les alertes",
        detail:
          "Les cartes d'alerte signalent les publications en échec, les automations suspendues ou les seuils d'engagement atteints. Cliquez sur une alerte pour accéder directement à l'élément concerné.",
      },
      {
        label: "Accéder aux métriques rapides",
        detail:
          "Les tuiles de métriques affichent la portée, l'engagement et le nombre de publications de la semaine en cours, comparés à la semaine précédente.",
      },
    ],
    tips: [
      "Consultez le tableau de bord chaque matin pour identifier rapidement les contenus qui nécessitent une intervention.",
      "Les variations de métriques affichées en rouge ou en vert vous donnent une tendance instantanée sans avoir à naviguer vers Analytics.",
    ],
    related: [
      { label: "Analytics", href: "/analytics" },
      { label: "Publications programmées", href: "/scheduled" },
      { label: "Historique", href: "/history" },
    ],
  },

  "/compose": {
    title: "Composer",
    tagline: "Créez et publiez du contenu sur tous vos réseaux en une seule fois.",
    whatItDoes:
      "L'éditeur de composition vous permet de rédiger, illustrer et cibler un post pour Facebook, Instagram ou LinkedIn. Vous pouvez publier immédiatement, programmer à une date précise, ou sauvegarder en brouillon dans la Bibliothèque pour réutilisation future.",
    keyActions: [
      {
        label: "Choisir les réseaux cibles",
        detail:
          "Cochez un ou plusieurs réseaux sociaux en haut du formulaire. L'aperçu se met à jour pour refléter les contraintes de format propres à chaque plateforme (longueur du texte, ratio d'image).",
      },
      {
        label: "Ajouter des médias",
        detail:
          "Glissez-déposez une image ou une vidéo, ou sélectionnez un média depuis la Bibliothèque. Les formats acceptés et les dimensions recommandées sont indiqués dynamiquement selon le réseau choisi.",
      },
      {
        label: "Programmer ou publier",
        detail:
          "Cliquez sur « Programmer » pour choisir une date et une heure précises, ou sur « Publier maintenant » pour une diffusion immédiate. La publication passe dans l'onglet Historique une fois envoyée.",
      },
      {
        label: "Sauvegarder en brouillon",
        detail:
          "Le bouton « Enregistrer en brouillon » stocke le contenu dans la Bibliothèque, prêt à être réutilisé ou modifié ultérieurement.",
      },
    ],
    tips: [
      "Rédigez d'abord pour le réseau avec les contraintes les plus strictes (souvent Twitter/X), puis adaptez pour les autres.",
      "L'assistant IA (icône étoile) peut reformuler votre texte ou générer des variantes adaptées à chaque réseau en un clic.",
      "Utilisez les « Audiences » pour cibler un segment spécifique lors d'une publication sur LinkedIn.",
    ],
    related: [
      { label: "Publications programmées", href: "/scheduled" },
      { label: "Bibliothèque de contenus", href: "/library" },
      { label: "Audiences", href: "/audiences" },
    ],
  },

  "/scheduled": {
    title: "Publications programmées",
    tagline: "Visualisez et gérez tout ce qui est en attente de diffusion.",
    whatItDoes:
      "Cet espace liste l'ensemble des publications planifiées, triées par date de diffusion. Vous pouvez les modifier, les déprogrammer, changer leur créneau ou les réorganiser par glisser-déposer sur la vue calendrier. Idéal pour vérifier la cohérence éditoriale avant publication.",
    keyActions: [
      {
        label: "Modifier un post programmé",
        detail:
          "Cliquez sur la carte d'un post pour ouvrir l'éditeur pré-rempli. Toutes les modifications sont sauvegardées et le post reste programmé à la même date sauf si vous la changez.",
      },
      {
        label: "Reprogrammer par glisser-déposer",
        detail:
          "En vue calendrier, faites glisser un post sur un nouveau créneau pour le reprogrammer instantanément. La modification est confirmée par une notification verte.",
      },
      {
        label: "Déprogrammer un post",
        detail:
          "Le bouton « Déprogrammer » transforme le post en brouillon dans la Bibliothèque. Il n'est pas supprimé et reste modifiable.",
      },
    ],
    tips: [
      "Activez la vue « Semaine » pour détecter les jours sans publication et combler les vides de votre calendrier éditorial.",
      "Un code couleur par marque vous permet de voir d'un coup d'œil quelle marque publie quand, sans confusion.",
    ],
    related: [
      { label: "Composer un post", href: "/compose" },
      { label: "Automations", href: "/automations" },
      { label: "Historique", href: "/history" },
    ],
  },

  "/library": {
    title: "Bibliothèque",
    tagline: "Stockez, organisez et réutilisez vos contenus et modèles.",
    whatItDoes:
      "La Bibliothèque centralise tous vos brouillons, modèles de posts, visuels validés et contenus archivés. Vous pouvez filtrer par marque, réseau, statut ou tag pour retrouver rapidement un contenu existant et l'adapter sans repartir de zéro.",
    keyActions: [
      {
        label: "Rechercher et filtrer",
        detail:
          "Utilisez la barre de recherche et les filtres (marque, réseau, tag, date) pour localiser précisément un contenu. La recherche est en temps réel.",
      },
      {
        label: "Dupliquer un contenu",
        detail:
          "Le bouton « Dupliquer » crée une copie modifiable du post ou du modèle sélectionné, utile pour décliner un format qui a bien fonctionné.",
      },
      {
        label: "Créer un modèle",
        detail:
          "Depuis n'importe quel brouillon, cliquez sur « Enregistrer comme modèle » pour le rendre disponible dans Composer et accélérer la production future.",
      },
    ],
    tips: [
      "Taggez systématiquement vos contenus (ex. : #campagne-automne, #produit-X) pour retrouver les assets liés à une campagne en quelques secondes.",
      "Les contenus archivés sont conservés indéfiniment — pensez à archiver plutôt que supprimer pour garder une trace historique.",
    ],
    related: [
      { label: "Composer un post", href: "/compose" },
      { label: "Campagnes", href: "/campaigns" },
      { label: "Historique", href: "/history" },
    ],
  },

  "/automations": {
    title: "Automations",
    tagline: "Automatisez les actions répétitives et les workflows éditoriaux.",
    whatItDoes:
      "Les automations vous permettent de créer des règles qui déclenchent des actions automatiques : republication d'un top-post, notification Slack quand l'engagement dépasse un seuil, ou cycle de publication récurrent sur une campagne. Chaque automation est auditable et peut être suspendue ou modifiée sans suppression.",
    keyActions: [
      {
        label: "Créer une automation",
        detail:
          "Cliquez sur « Nouvelle automation », choisissez un déclencheur (calendrier, seuil de métrique, événement) et définissez l'action associée. Un résumé en langage naturel confirme la logique configurée.",
      },
      {
        label: "Activer / suspendre",
        detail:
          "Le toggle à droite de chaque automation l'active ou la suspend sans la supprimer. Les automations suspendues sont listées en gris et peuvent être réactivées à tout moment.",
      },
      {
        label: "Consulter le journal d'exécution",
        detail:
          "Chaque automation affiche son dernier déclenchement et son résultat (succès / échec). Cliquez sur « Voir les logs » pour diagnostiquer un problème.",
      },
    ],
    tips: [
      "Commencez par automatiser la republication hebdomadaire de vos meilleurs posts — c'est le cas d'usage le plus rapide à configurer et le plus rentable.",
      "Testez une automation sur une marque secondaire avant de la déployer sur votre marque principale.",
    ],
    related: [
      { label: "Publications programmées", href: "/scheduled" },
      { label: "Agents IA", href: "/agents" },
      { label: "Historique", href: "/history" },
    ],
  },

  "/history": {
    title: "Historique",
    tagline: "Retrouvez toutes les publications passées et leurs performances.",
    whatItDoes:
      "L'historique archive l'intégralité des posts publiés, avec leur date, réseau, statut de publication et métriques d'engagement post-publication. Vous pouvez filtrer, exporter ou relancer un post existant directement depuis cet écran.",
    keyActions: [
      {
        label: "Filtrer par période et réseau",
        detail:
          "Sélectionnez une plage de dates et un ou plusieurs réseaux pour affiner la liste. Les filtres s'accumulent et peuvent être réinitialisés d'un clic.",
      },
      {
        label: "Relancer un post",
        detail:
          "Le bouton « Réutiliser » ouvre l'éditeur Composer pré-rempli avec le contenu du post sélectionné. Modifiez-le puis programmez ou publiez.",
      },
      {
        label: "Exporter les données",
        detail:
          "Exportez l'historique filtré en CSV pour l'intégrer dans un rapport externe ou votre outil de BI.",
      },
    ],
    tips: [
      "Comparez les taux d'engagement entre marques sur la même période pour identifier les formats et sujets qui résonnent le mieux.",
      "Les posts marqués « Échec » dans l'historique ont souvent besoin d'une re-publication manuelle — vérifiez la connexion du compte concerné dans Comptes.",
    ],
    related: [
      { label: "Analytics", href: "/analytics" },
      { label: "Comptes connectés", href: "/accounts" },
      { label: "Composer un post", href: "/compose" },
    ],
  },

  "/campaigns": {
    title: "Campagnes",
    tagline: "Pilotez vos campagnes multi-canaux de bout en bout.",
    whatItDoes:
      "Une campagne regroupe un ensemble de posts, d'annonces payantes et d'audiences autour d'un objectif commun (lancement produit, événement, sensibilisation). L'écran Campagnes offre une vue consolidée du budget, de la portée cumulée et de l'avancement de chaque campagne active.",
    keyActions: [
      {
        label: "Créer une campagne",
        detail:
          "Définissez un nom, des dates de début et de fin, un objectif (notoriété, trafic, conversion) et assignez les marques et réseaux concernés. Les posts programmés dans la même période peuvent être rattachés à la campagne.",
      },
      {
        label: "Suivre la progression",
        detail:
          "La jauge de progression indique le taux de réalisation des publications prévues. Un indicateur budgétaire montre le consommé vs. le budget alloué pour les campagnes payantes.",
      },
      {
        label: "Lier des posts et des publicités",
        detail:
          "Depuis la fiche campagne, ajoutez des posts organiques existants ou créez de nouvelles publicités payantes directement rattachées à la campagne.",
      },
    ],
    tips: [
      "Nommez vos campagnes de façon normalisée (ex. : MARQUE_OBJECTIF_TRIM) pour faciliter les comparaisons d'une année à l'autre.",
      "Utilisez les « Audiences » pour définir en amont les segments ciblés par chaque campagne, puis réutilisez-les dans les publicités.",
    ],
    related: [
      { label: "Performances publicitaires", href: "/ad-performance" },
      { label: "Audiences", href: "/audiences" },
      { label: "Analytics", href: "/analytics" },
    ],
  },

  "/audiences": {
    title: "Audiences",
    tagline: "Définissez et gérez les segments cibles de vos communications.",
    whatItDoes:
      "L'écran Audiences vous permet de créer des segments réutilisables (professionnels de santé, patients, grand public) à partir de critères démographiques, comportementaux ou de listes personnalisées. Ces segments sont ensuite utilisables dans Composer et dans les campagnes payantes.",
    keyActions: [
      {
        label: "Créer un segment",
        detail:
          "Cliquez sur « Nouvelle audience », nommez le segment, choisissez les critères de ciblage (âge, profession, intérêts, géographie) et sauvegardez. Le segment est immédiatement disponible dans Composer et Campagnes.",
      },
      {
        label: "Importer une liste",
        detail:
          "Téléversez un fichier CSV d'adresses e-mail ou d'identifiants pour créer une audience « Custom ». Cette liste est hachée avant envoi aux plateformes pour respecter la conformité RGPD.",
      },
      {
        label: "Analyser la taille estimée",
        detail:
          "L'indicateur de taille estimée vous donne un ordre de grandeur de l'audience potentielle sur chaque réseau avant de lancer une campagne payante.",
      },
    ],
    tips: [
      "Créez des audiences miroir (Lookalike) à partir de vos meilleures listes pour toucher de nouveaux profils similaires à vos clients actuels.",
      "Dans le secteur médical, vérifiez systématiquement les restrictions de ciblage propres à Facebook (santé & bien-être) avant de lancer une publicité.",
    ],
    related: [
      { label: "Campagnes", href: "/campaigns" },
      { label: "Performances publicitaires", href: "/ad-performance" },
      { label: "Composer un post", href: "/compose" },
    ],
  },

  "/ad-performance": {
    title: "Performances publicitaires",
    tagline: "Mesurez le ROI de vos campagnes payantes en temps réel.",
    whatItDoes:
      "Cet écran agrège les données publicitaires de toutes vos plateformes (Facebook Ads, Instagram Ads, LinkedIn Ads) en un seul tableau de bord. Vous y suivez les dépenses, le coût par clic (CPC), le taux de conversion et le retour sur investissement publicitaire (ROAS) de chaque campagne.",
    keyActions: [
      {
        label: "Comparer les campagnes",
        detail:
          "Utilisez le tableau comparatif pour mettre côte à côte deux campagnes ou deux marques sur la même période. Les colonnes sont triables pour identifier rapidement les campagnes les plus performantes.",
      },
      {
        label: "Analyser par réseau",
        detail:
          "Filtrez par plateforme pour isoler les performances Facebook, Instagram ou LinkedIn. Chaque réseau a ses propres benchmarks sectoriels affichés en référence.",
      },
      {
        label: "Exporter le rapport",
        detail:
          "Générez un rapport PDF ou CSV de la période sélectionnée, prêt à partager avec votre direction ou votre agence.",
      },
    ],
    tips: [
      "Un CPC supérieur au benchmark sectoriel médical (~2–4 €) est un signal pour revoir votre ciblage ou vos visuels publicitaires.",
      "Croisez ces données avec l'Analytics organique pour évaluer l'effet de halo de vos publicités sur l'engagement naturel.",
    ],
    related: [
      { label: "Campagnes", href: "/campaigns" },
      { label: "Analytics", href: "/analytics" },
      { label: "Audiences", href: "/audiences" },
    ],
  },

  "/analytics": {
    title: "Analytics",
    tagline: "Analysez en profondeur la performance organique de vos 3 marques.",
    whatItDoes:
      "L'écran Analytics offre des graphiques détaillés sur l'évolution de la portée, de l'engagement, des abonnés et des clics sur lien pour chaque marque et chaque réseau. Des rapports prédéfinis couvrent les performances hebdomadaires, mensuelles et comparatives entre marques.",
    keyActions: [
      {
        label: "Choisir la période et la granularité",
        detail:
          "Sélectionnez une plage de dates via le sélecteur de période et choisissez la granularité (jour, semaine, mois) pour ajuster le niveau de détail des graphiques.",
      },
      {
        label: "Comparer deux périodes",
        detail:
          "Activez le mode « Comparaison » pour superposer deux périodes sur le même graphique et mesurer l'évolution d'une campagne ou d'un changement de stratégie.",
      },
      {
        label: "Identifier le meilleur contenu",
        detail:
          "Le tableau « Top posts » classe vos publications par taux d'engagement pour la période sélectionnée. Cliquez sur un post pour voir son détail ou le réutiliser dans Composer.",
      },
    ],
    tips: [
      "Consultez les analytics le lendemain d'une publication importante : les 24 premières heures donnent 80 % de l'engagement final.",
      "Un taux d'engagement > 3 % sur LinkedIn est excellent dans le secteur médical — utilisez-le comme seuil de référence pour valider vos formats.",
    ],
    related: [
      { label: "Tableau de bord", href: "/dashboard" },
      { label: "Performances publicitaires", href: "/ad-performance" },
      { label: "Historique", href: "/history" },
    ],
  },

  "/accounts": {
    title: "Comptes connectés",
    tagline: "Gérez les connexions aux réseaux sociaux de vos 3 marques.",
    whatItDoes:
      "L'écran Comptes liste tous les comptes de réseaux sociaux connectés à Social Hub, pour chacune de vos 3 marques médicales. Vous pouvez ajouter de nouveaux comptes, reconnecter un compte expiré ou révoquer un accès. Le statut de chaque connexion est visible en temps réel.",
    keyActions: [
      {
        label: "Connecter un nouveau compte",
        detail:
          "Cliquez sur « Ajouter un compte », sélectionnez la plateforme et suivez le flux OAuth. Les permissions requises sont listées avant validation pour assurer la transparence.",
      },
      {
        label: "Reconnecter un compte expiré",
        detail:
          "Un badge rouge « Token expiré » signale les connexions à renouveler. Cliquez sur « Reconnecter » pour relancer le flux d'authentification sans perdre les publications programmées.",
      },
      {
        label: "Révoquer un accès",
        detail:
          "Le bouton « Déconnecter » supprime le token d'accès côté Social Hub. Pensez également à révoquer les permissions depuis les paramètres du réseau social concerné.",
      },
    ],
    tips: [
      "Les tokens Facebook et Instagram expirent tous les 60 jours — programmez un rappel pour les renouveler avant qu'ils n'impactent vos publications.",
      "Vérifiez les niveaux de permission (lecture seule vs. publication) pour chaque compte afin d'éviter les erreurs silencieuses lors des publications automatiques.",
    ],
    related: [
      { label: "Paramètres", href: "/settings" },
      { label: "Automations", href: "/automations" },
      { label: "Tableau de bord", href: "/dashboard" },
    ],
  },

  "/settings": {
    title: "Paramètres",
    tagline: "Configurez Social Hub selon les besoins de votre organisation.",
    whatItDoes:
      "Les paramètres regroupent la configuration générale de l'application : gestion des marques, préférences de notification, fuseaux horaires, accès des membres de l'équipe et options d'intégration (webhook, API). C'est aussi ici que vous gérez votre abonnement et vos données de facturation.",
    keyActions: [
      {
        label: "Gérer les marques",
        detail:
          "Ajoutez, renommez ou archivez une marque médicale. Chaque marque dispose de son propre espace de données et de ses propres comptes connectés.",
      },
      {
        label: "Inviter des collaborateurs",
        detail:
          "Envoyez des invitations par e-mail et assignez des rôles (Administrateur, Éditeur, Lecteur). Les éditeurs peuvent composer et programmer ; les lecteurs ont un accès en consultation seule.",
      },
      {
        label: "Configurer les notifications",
        detail:
          "Choisissez les événements qui déclenchent une notification (publication réussie, échec, seuil d'engagement) et le canal de livraison (e-mail, notification in-app).",
      },
    ],
    tips: [
      "Définissez le fuseau horaire par défaut au niveau de chaque marque si vos équipes travaillent dans des zones géographiques différentes.",
      "Activez les webhooks sortants pour intégrer Social Hub à votre CRM ou à votre outil de reporting interne.",
    ],
    related: [
      { label: "Comptes connectés", href: "/accounts" },
      { label: "Tableau de bord", href: "/dashboard" },
      { label: "Automations", href: "/automations" },
    ],
  },

  "/agents": {
    title: "Agents IA",
    tagline: "Déléguez des tâches éditoriales à vos assistants intelligents.",
    whatItDoes:
      "Les Agents IA sont des assistants autonomes que vous configurez pour accomplir des tâches répétitives à forte valeur ajoutée : génération de variantes de posts, veille de tendances, suggestions de créneaux optimaux ou rédaction de légendes à partir d'un brief. Chaque agent est traçable et ses sorties sont toujours soumises à votre validation avant publication.",
    keyActions: [
      {
        label: "Activer un agent prédéfini",
        detail:
          "Choisissez parmi les agents disponibles (Rédacteur, Planificateur, Analyste de tendances) et configurez ses paramètres (marque cible, ton, fréquence). L'agent démarre dès l'activation.",
      },
      {
        label: "Valider ou rejeter les suggestions",
        detail:
          "Chaque sortie d'agent atterrit dans la file « En attente de validation ». Approuvez pour envoyer en programmation, modifiez pour affiner, ou rejetez avec un commentaire pour améliorer les prochaines suggestions.",
      },
      {
        label: "Consulter le journal d'activité",
        detail:
          "Le journal liste toutes les actions effectuées par chaque agent : date, tâche exécutée, résultat et éventuelles erreurs. Indispensable pour l'audit et la conformité.",
      },
    ],
    tips: [
      "Dans le secteur médical, activez toujours la relecture humaine obligatoire — ne laissez aucun agent publier directement sans validation.",
      "Fournissez un brief détaillé (ton, contraintes réglementaires, mots-clés à éviter) lors de la configuration pour obtenir des suggestions exploitables dès le premier essai.",
      "Commencez par l'agent « Planificateur » pour optimiser vos créneaux de publication avant d'introduire des agents de génération de contenu.",
    ],
    related: [
      { label: "Automations", href: "/automations" },
      { label: "Composer un post", href: "/compose" },
      { label: "Bibliothèque", href: "/library" },
    ],
  },
};

// ─── Fallback générique ───────────────────────────────────────────────────────

const FALLBACK: HelpEntry = {
  title: "Aide contextuelle",
  tagline: "Bienvenue dans Social Hub, votre outil de pilotage social media.",
  whatItDoes:
    "Social Hub vous permet de gérer la présence social media de vos 3 marques médicales depuis une interface unifiée : composition, programmation, automations, analytics et pilotage des campagnes payantes.",
  keyActions: [
    {
      label: "Naviguer dans l'application",
      detail:
        "Utilisez la barre latérale gauche pour accéder aux différentes rubriques. Le sélecteur de marque en haut à gauche filtre toutes les données selon la marque active.",
    },
    {
      label: "Obtenir de l'aide",
      detail:
        "Cliquez sur le bouton « ? » en haut à droite depuis n'importe quelle rubrique pour afficher l'aide contextuelle adaptée à la page en cours.",
    },
  ],
  tips: [
    "Commencez par « Comptes » pour connecter vos réseaux sociaux, puis par « Composer » pour publier votre premier post.",
  ],
  related: [
    { label: "Tableau de bord", href: "/dashboard" },
    { label: "Comptes connectés", href: "/accounts" },
    { label: "Paramètres", href: "/settings" },
  ],
};

// ─── Helper public ────────────────────────────────────────────────────────────

/**
 * Retourne l'entrée d'aide la plus spécifique qui correspond au pathname
 * fourni (correspondance par préfixe, de la plus longue à la plus courte).
 * Si aucune route ne correspond, retourne le fallback générique.
 */
export function getHelp(pathname: string): HelpEntry {
  // Trier les clés par longueur décroissante pour favoriser la correspondance
  // la plus spécifique (ex. "/ad-performance" avant "/ad").
  const keys = Object.keys(HELP).sort((a, b) => b.length - a.length);
  const match = keys.find((key) => pathname.startsWith(key));
  return match ? HELP[match] : FALLBACK;
}
