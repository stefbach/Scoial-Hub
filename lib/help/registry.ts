// ─── Registre d'aide contextuelle bilingue — AXON-AI · Social Hub ────────────
// Structure bilingue FR / EN par route.
// Helper public : getHelp(pathname, lang) → HelpEntry (dans la langue choisie).

export type Lang = "fr" | "en";

// ── Types de l'entrée d'aide (contenu déjà résolu dans la bonne langue) ────────

export interface HelpAction {
  label: string;
  detail: string;
}

export interface HelpFaq {
  q: string;
  a: string;
}

export interface HelpRelated {
  label: string;
  href: string;
}

export interface HelpEntry {
  title: string;
  tagline: string;
  whatFor: string;
  actions: HelpAction[];
  tips: string[];
  faq: HelpFaq[];
  shortcuts?: string[];
  related: HelpRelated[];
}

// ── Type interne : contenu bilingue ───────────────────────────────────────────

interface BilingualString {
  fr: string;
  en: string;
}

interface BilingualAction {
  label: BilingualString;
  detail: BilingualString;
}

interface BilingualFaq {
  q: BilingualString;
  a: BilingualString;
}

interface BilingualRelated {
  label: BilingualString;
  href: string;
}

interface BilingualEntry {
  title: BilingualString;
  tagline: BilingualString;
  whatFor: BilingualString;
  actions: BilingualAction[];
  tips: BilingualString[];
  faq: BilingualFaq[];
  shortcuts?: BilingualString[];
  related: BilingualRelated[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Registre principal (bilingue)
// ─────────────────────────────────────────────────────────────────────────────

const HELP_BILINGUAL: Record<string, BilingualEntry> = {

  // ── /comptes ────────────────────────────────────────────────────────────────
  "/comptes": {
    title: {
      fr: "Sélection de compte",
      en: "Account selection",
    },
    tagline: {
      fr: "Choisissez l'entité à piloter parmi vos comptes disponibles.",
      en: "Pick the entity you want to manage from your available accounts.",
    },
    whatFor: {
      fr: "Le hub de comptes est le point d'entrée de l'application. Il liste toutes les entités (marques, clients) auxquelles vous avez accès. En cliquant sur une carte, vous chargez l'espace de pilotage dédié à cette entité et accédez au tableau de bord correspondant. C'est ici que vous changez de contexte entre plusieurs comptes clients.",
      en: "The accounts hub is the app's entry point. It lists all entities (brands, clients) you have access to. Clicking a card loads the dedicated management workspace for that entity and opens its dashboard. This is where you switch context between multiple client accounts.",
    },
    actions: [
      {
        label: { fr: "Ouvrir un compte", en: "Open an account" },
        detail: {
          fr: "Cliquez sur la carte d'un compte pour le sélectionner comme entité active. L'application charge automatiquement toutes les données (publications, analytics, publications programmées) liées à ce compte.",
          en: "Click an account card to select it as the active entity. The app automatically loads all data (posts, analytics, scheduled posts) related to that account.",
        },
      },
      {
        label: { fr: "Créer une nouvelle société", en: "Create a new company" },
        detail: {
          fr: "Cliquez sur « + Nouvelle société », donnez-lui un nom et une couleur d'accent, puis cliquez sur « Créer et profiler ». Vous êtes redirigé vers le Démarrage assisté pour construire le profil de la marque à partir de votre site et de vos réseaux sociaux.",
          en: "Click '+ New company', give it a name and an accent colour, then click 'Create & profile'. You are redirected to the assisted onboarding to build the brand profile from your website and social accounts.",
        },
      },
      {
        label: { fr: "Se déconnecter", en: "Log out" },
        detail: {
          fr: "Le bouton « Se déconnecter » en haut à droite ferme votre session Supabase de façon sécurisée et vous redirige vers la page de connexion.",
          en: "The « Log out » button in the top-right corner securely closes your Supabase session and redirects you to the login page.",
        },
      },
    ],
    tips: [
      {
        fr: "Si vous gérez plusieurs clients, les comptes s'affichent dans l'ordre renvoyé par votre organisation ; repérez rapidement le bon compte grâce à son nom et sa pastille de couleur.",
        en: "If you manage multiple clients, accounts are shown in the order returned by your organisation; use the account name and its coloured badge to quickly spot the right one.",
      },
      {
        fr: "L'identifiant e-mail affiché en haut confirme le compte Supabase actif — utile pour vérifier que vous êtes connecté avec le bon utilisateur.",
        en: "The e-mail address shown at the top confirms the active Supabase account — useful to verify you are logged in as the right user.",
      },
    ],
    faq: [
      {
        q: { fr: "Je ne vois aucun compte — que faire ?", en: "I see no accounts — what should I do?" },
        a: {
          fr: "Contactez votre administrateur AXON-AI pour qu'il vous rattache à une entité. Les accès sont gérés depuis l'interface Admin → Utilisateurs.",
          en: "Contact your AXON-AI administrator to be linked to an entity. Access is managed in the Admin → Users interface.",
        },
      },
      {
        q: { fr: "Puis-je basculer de compte sans me déconnecter ?", en: "Can I switch accounts without logging out?" },
        a: {
          fr: "Oui : retournez sur /comptes depuis la barre latérale (logo AXON-AI) pour changer d'entité sans fermer votre session.",
          en: "Yes: navigate back to /comptes from the sidebar (AXON-AI logo) to switch entity without ending your session.",
        },
      },
    ],
    related: [
      { label: { fr: "Tableau de bord", en: "Dashboard" }, href: "/dashboard" },
      { label: { fr: "Paramètres", en: "Settings" }, href: "/settings" },
    ],
  },

  // ── /dashboard ──────────────────────────────────────────────────────────────
  "/dashboard": {
    title: {
      fr: "Tableau de bord",
      en: "Dashboard",
    },
    tagline: {
      fr: "Vue d'ensemble en temps réel de vos marques.",
      en: "Real-time overview of your brands.",
    },
    whatFor: {
      fr: "Le tableau de bord centralise les indicateurs de la marque sélectionnée en deux sections : Organique (Programmés, Publiés sur 7 jours, Posts en échec) et Publicités payantes (Campagnes actives, Dépenses du mois en cours, Conversions, Budget IA). En dessous, deux blocs complètent la vue : les posts à venir et la publicité la plus performante. C'est votre point d'entrée quotidien pour repérer d'un coup d'œil ce qui nécessite une intervention.",
      en: "The dashboard centralises the selected brand's indicators in two sections: Organic (Scheduled, Published over 7 days, Failed posts) and Paid Ads (Active campaigns, Month-to-date spend, Conversions, AI budget). Below, two more blocks complete the view: upcoming posts and the top-performing ad. It's your daily entry point for spotting what needs attention at a glance.",
    },
    actions: [
      {
        label: { fr: "Changer de marque", en: "Switch brand" },
        detail: {
          fr: "Utilisez le sélecteur de marque dans la barre latérale (en haut, dans l'en-tête sur mobile) pour basculer entre vos entités. Chaque marque dispose de son propre périmètre de données.",
          en: "Use the brand selector in the sidebar (at the top, in the header on mobile) to switch between your entities. Each brand has its own data scope.",
        },
      },
      {
        label: { fr: "Repérer les posts en échec", en: "Spot failed posts" },
        detail: {
          fr: "La tuile « Posts en échec » affiche son chiffre en rouge dès qu'il est supérieur à zéro. Cliquez dessus pour ouvrir directement l'historique filtré sur les échecs.",
          en: "The 'Failed posts' tile shows its number in red as soon as it is greater than zero. Click it to open the history directly, filtered to failures.",
        },
      },
      {
        label: { fr: "Naviguer vers une rubrique depuis le tableau", en: "Navigate to a section from the board" },
        detail: {
          fr: "Chaque tuile du tableau de bord est cliquable et mène directement à la rubrique détaillée concernée (Publications programmées, Campagnes, Analytics des pubs, Paramètres IA…).",
          en: "Each tile on the dashboard is clickable and leads directly to the relevant detailed section (Scheduled posts, Campaigns, Ad performance, AI settings…).",
        },
      },
      {
        label: { fr: "Utiliser le bandeau « Pilotage actif »", en: "Use the 'Active piloting' banner" },
        detail: {
          fr: "Une fois votre parcours de démarrage terminé, un bandeau compact « Pilotage actif » reste affiché en haut du tableau de bord avec trois raccourcis : « Nouvelle campagne », « Voir le pilotage » et « Revoir mon parcours » (pour repasser sur le démarrage assisté).",
          en: "Once your onboarding journey is complete, a compact 'Active piloting' banner stays displayed at the top of the dashboard with three shortcuts: 'New campaign', 'Open piloting' and 'Review setup' (to go back through assisted onboarding).",
        },
      },
      {
        label: { fr: "Créer un nouveau post", en: "Create a new post" },
        detail: {
          fr: "Le bouton « Nouveau post » en haut à droite de la page ouvre directement Composer, sans passer par le bandeau de pilotage.",
          en: "The 'New post' button at the top right of the page opens Compose directly, without going through the piloting banner.",
        },
      },
    ],
    tips: [
      {
        fr: "Consultez le tableau de bord chaque matin pour identifier rapidement les contenus qui nécessitent une intervention.",
        en: "Check the dashboard every morning to quickly spot content that needs attention.",
      },
      {
        fr: "Le tableau de bord ne s'affiche qu'une fois le démarrage assisté terminé — avant ça, vous voyez uniquement le parcours de démarrage.",
        en: "The dashboard only appears once assisted onboarding is complete — until then, you only see the onboarding journey.",
      },
    ],
    faq: [
      {
        q: { fr: "Les données sont-elles en temps réel ?", en: "Is the data real-time?" },
        a: {
          fr: "Les indicateurs sont rafraîchis à chaque chargement de page. Dès que vos connecteurs (Meta, LinkedIn) sont actifs, les données proviennent directement des APIs des plateformes.",
          en: "Indicators are refreshed on every page load. Once your connectors (Meta, LinkedIn) are active, data comes directly from the platform APIs.",
        },
      },
      {
        q: { fr: "Pourquoi le bloc « Publicité la plus performante » est-il vide ?", en: "Why is the 'Top performing ad' block empty?" },
        a: {
          fr: "Il affiche un état vide (« Aucune publicité diffusée pour l'instant ») tant qu'aucune de vos publicités n'a de dépense ou de conversion enregistrée — indépendamment de vos connecteurs.",
          en: "It shows an empty state ('No ads running yet') until one of your ads has recorded spend or conversions — this is unrelated to your connectors.",
        },
      },
    ],
    shortcuts: [
      {
        fr: "Raccourci clavier : appuyez sur « ? » depuis n'importe quelle page pour ouvrir l'aide contextuelle.",
        en: "Keyboard shortcut: press '?' from any page to open contextual help.",
      },
    ],
    related: [
      { label: { fr: "Analytics", en: "Analytics" }, href: "/analytics" },
      { label: { fr: "Publications programmées", en: "Scheduled posts" }, href: "/scheduled" },
      { label: { fr: "Centre de pilotage", en: "Piloting center" }, href: "/pilotage" },
    ],
  },

  // ── /pilotage ───────────────────────────────────────────────────────────────
  "/pilotage": {
    title: {
      fr: "Centre de pilotage",
      en: "Piloting center",
    },
    tagline: {
      fr: "Orchestrez la stratégie social media IA de votre marque.",
      en: "Orchestrate your brand's AI-driven social media strategy.",
    },
    whatFor: {
      fr: "Le centre de pilotage est la tour de contrôle stratégique. Il agrège les KPIs de tous vos réseaux, remonte les insights de veille et centralise les recommandations des agents IA à examiner. Vous y définissez l'objectif global et le niveau d'autonomie des agents, puis lancez des cycles de pilotage pour obtenir des décisions à approuver ou ignorer. Un tableau de benchmark concurrentiel est prévu mais pas encore implémenté : il reste vide pour l'instant.",
      en: "The piloting center is the strategic control tower. It aggregates KPIs across all your networks, surfaces watch insights and centralises AI agent recommendations for your review. You define the global objective and agent autonomy level, then launch piloting cycles to get decisions to approve or dismiss. A competitive benchmark table is planned but not yet implemented: it stays empty for now.",
    },
    actions: [
      {
        label: { fr: "Définir l'objectif global", en: "Set the global objective" },
        detail: {
          fr: "Rédigez votre objectif stratégique dans le champ texte (ex. : « Développer la notoriété de la marque sur LinkedIn France »). Cet objectif guide les agents IA lors du cycle.",
          en: "Write your strategic objective in the text field (e.g. 'Grow brand awareness on LinkedIn France'). This objective guides the AI agents during the cycle.",
        },
      },
      {
        label: { fr: "Choisir le niveau d'autonomie", en: "Choose the autonomy level" },
        detail: {
          fr: "Niveau 1 (Reco) : les agents produisent uniquement des recommandations à valider manuellement. Niveau 2 (Semi) : ils peuvent effectuer certaines actions de façon automatique. Niveau 3 (Auto) : exécution complète sans intervention — réservé aux workflows validés.",
          en: "Level 1 (Reco): agents produce only recommendations for manual approval. Level 2 (Semi): they can perform some actions automatically. Level 3 (Auto): full execution without intervention — reserved for validated workflows.",
        },
      },
      {
        label: { fr: "Lancer un cycle de pilotage", en: "Launch a piloting cycle" },
        detail: {
          fr: "Le bouton « Lancer un cycle » appelle l'API /agents/run avec l'objectif et le niveau d'autonomie configurés. Plusieurs agents travaillent en séquence en interne, mais le cycle produit une seule décision agrégée en tête de file — pas une recommandation par agent.",
          en: "The 'Launch cycle' button calls the /agents/run API with the configured objective and autonomy level. Several agents work in sequence internally, but the cycle produces one aggregated decision at the top of the queue — not one recommendation per agent.",
        },
      },
      {
        label: { fr: "Valider ou ignorer une recommandation", en: "Approve or dismiss a recommendation" },
        detail: {
          fr: "Chaque décision affiche l'agent source, son raisonnement et l'impact estimé. « Valider » ou « Ignorer » ne fait que changer l'étiquette affichée à l'écran — rien n'est enregistré côté serveur : la file entière (approuvées et ignorées) est perdue au rafraîchissement de la page, il n'existe pas de vrai journal persistant.",
          en: "Each decision shows the source agent, its rationale and estimated impact. 'Approve' or 'Dismiss' only changes the on-screen label — nothing is saved server-side: the entire queue (approved and dismissed alike) is lost on page refresh, there is no real persistent log.",
        },
      },
      {
        label: { fr: "Consulter les KPIs agrégés", en: "Check aggregated KPIs" },
        detail: {
          fr: "La section « Indicateurs clés » affiche followers, taux d'engagement, likes, commentaires, vues et portée, agrégés sur tous les réseaux et la période sélectionnée.",
          en: "The 'Key indicators' section displays followers, engagement rate, likes, comments, views and reach, aggregated across all networks for the selected period.",
        },
      },
      {
        label: { fr: "Lire le benchmark marché", en: "Read the market benchmark" },
        detail: {
          fr: "Le tableau de benchmark doit comparer vos métriques aux moyennes du marché local (pays sélectionné), avec une flèche verte au-dessus de la moyenne et rouge en dessous. Cette fonctionnalité n'est pas encore développée : le tableau reste vide, quelle que soit la marque ou le pays.",
          en: "The benchmark table is meant to compare your metrics to local market averages (selected country), with a green arrow above average and red below. This feature hasn't been built yet: the table stays empty regardless of brand or country.",
        },
      },
      {
        label: { fr: "Consulter les insights de veille", en: "Check watch insights" },
        detail: {
          fr: "Les insights de veille (formats, angles, benchmarks) proviennent du dernier run de la page Veille & Marché. Ils sont automatiquement injectés en tête de la file de décisions ; leur étiquette de priorité (haute, moyenne ou basse) reflète l'analyse IA — seule leur position en tête de file est garantie, pas une priorité « haute » systématique.",
          en: "Watch insights (formats, angles, benchmarks) come from the last run of the Watch & Market page. They are automatically injected at the top of the decision queue; their priority label (high, medium or low) reflects the AI's analysis — only their head-of-queue position is guaranteed, not a systematic 'high' priority.",
        },
      },
      {
        label: { fr: "Filtrer par réseau", en: "Filter by network" },
        detail: {
          fr: "La section « Par réseau » liste Facebook, Instagram et LinkedIn avec leur taux d'engagement et la tendance sur la période. LinkedIn n'expose pas ces statistiques sans validation « Community Management » : sa ligne reste toujours vide, même connecté — seuls Facebook et Instagram affichent de vraies données.",
          en: "The 'By network' section lists Facebook, Instagram and LinkedIn with their engagement rate and period trend. LinkedIn doesn't expose this data without 'Community Management' approval: its row always stays empty, even when connected — only Facebook and Instagram show real data.",
        },
      },
      {
        label: { fr: "Lancer un agent IA ad hoc", en: "Run an ad hoc AI agent" },
        detail: {
          fr: "En haut de page, un bouton « Lancer un agent IA » indépendant du bandeau stratégie permet un cycle ponctuel avec un objectif libre et son propre niveau d'autonomie, sans passer par l'objectif global configuré plus bas.",
          en: "At the top of the page, a 'Run an AI agent' button independent from the strategy banner allows a one-off cycle with a free-form objective and its own autonomy level, without going through the global objective configured further down.",
        },
      },
      {
        label: { fr: "Suivre la performance pub Meta", en: "Track Meta ad performance" },
        detail: {
          fr: "Dès que des campagnes Meta existent, un encart « Performance pub · Meta (30 j) » affiche dépense, impressions, clics et conversions réels, avec un lien vers le détail complet.",
          en: "Once Meta campaigns exist, an 'Ad performance · Meta (30d)' panel shows real spend, impressions, clicks and conversions, with a link to the full detail.",
        },
      },
      {
        label: { fr: "Analyser le contenu organique (Cerveau Contenu)", en: "Analyze organic content (Content Brain)" },
        detail: {
          fr: "Équivalent organique du Cerveau Pub : l'IA analyse vos indicateurs organiques réels (Facebook/Instagram) et la mémoire stratégique (veille) pour proposer un diagnostic, le réseau le plus performant, des formats et angles à tester.",
          en: "The organic counterpart of the Ad Brain: the AI analyzes your real organic indicators (Facebook/Instagram) and strategic memory (watch) to propose a diagnosis, your best-performing network, and formats/angles to test.",
        },
      },
      {
        label: { fr: "Appliquer les actions du Pilote Contenu", en: "Apply Content Pilot actions" },
        detail: {
          fr: "Équivalent organique du Pilote Pub, sans aucune dépense : reprogramme en un clic un post déjà planifié le bon jour mais à la mauvaise heure (créneau prouvé par le moteur d'apprentissage), ou ouvre Composer face à un réseau en silence éditorial ou en perte d'engagement.",
          en: "The organic counterpart of the Ad Pilot, with no spend involved: reschedules in one click a post already planned on the right day but at the wrong time (slot proven by the learning engine), or opens Compose when a network goes editorially silent or loses engagement.",
        },
      },
      {
        label: { fr: "Suivre la campagne du parcours", en: "Track the journey campaign" },
        detail: {
          fr: "La carte « Campagne du parcours » affiche la campagne créée à la fin du démarrage assisté (nom, réseaux, zone, cadence, prochaine publication).",
          en: "The 'Journey campaign' card shows the campaign created at the end of assisted onboarding (name, networks, zone, cadence, next publication).",
        },
      },
      {
        label: { fr: "Repérer les alertes", en: "Spot alerts" },
        detail: {
          fr: "La section « Alertes » signale les réseaux sans publication récente (ex. « X jours sans publication »), un engagement en baisse ou des permissions manquantes pour suivre vos abonnés.",
          en: "The 'Alerts' section flags networks with no recent post (e.g. 'X days without a post'), falling engagement, or missing permissions to track your followers.",
        },
      },
      {
        label: { fr: "Naviguer via les raccourcis", en: "Navigate via the shortcuts" },
        detail: {
          fr: "La rangée de puces Veille, Campagnes, Performance Ads, Messagerie, Médiathèque, Compose ressemble à des onglets mais ce sont de simples raccourcis de navigation : cliquer quitte le pilotage pour ouvrir la page correspondante, ce ne sont pas des sections internes de cet écran.",
          en: "The row of Watch, Campaigns, Ad Performance, Inbox, Media, Compose pills looks like tabs but they're plain navigation shortcuts: clicking leaves the piloting page to open the corresponding page — they aren't internal sections of this screen.",
        },
      },
    ],
    tips: [
      {
        fr: "Commencez par le niveau d'autonomie 1 (Reco) pour prendre en main le système avant de passer au niveau 2 ou 3.",
        en: "Start with autonomy level 1 (Reco) to get familiar with the system before moving to level 2 or 3.",
      },
      {
        fr: "L'objectif global peut provenir de la configuration admin de l'entité — vérifiez qu'il est bien à jour avant de lancer un cycle.",
        en: "The global objective may be pre-filled from the entity admin config — make sure it is up to date before launching a cycle.",
      },
      {
        fr: "Les recommandations de veille (issues de /veille) apparaissent en tête de file, mais leur étiquette de priorité peut être haute, moyenne (valeur par défaut) ou basse selon l'analyse IA.",
        en: "Watch recommendations (from /veille) appear at the top of the queue, but their priority label can be high, medium (the default) or low depending on the AI's analysis.",
      },
      {
        fr: "Un cycle peut prendre jusqu'à 2 minutes selon le nombre d'appels IA enchaînés — ce n'est pas toujours l'affaire de quelques secondes.",
        en: "A cycle can take up to 2 minutes depending on how many AI calls run in sequence — it isn't always a matter of a few seconds.",
      },
    ],
    faq: [
      {
        q: { fr: "Où est passée la page /agents ?", en: "Where did the /agents page go?" },
        a: {
          fr: "/agents redirige désormais vers le Centre de pilotage : il n'existe plus de page séparée. Les agents IA se lancent depuis un bouton « Lancer un agent IA » disponible sur plusieurs pages (Pilotage, Campagnes, Composer…).",
          en: "/agents now redirects to the Piloting center: there is no separate page anymore. AI agents are launched from a 'Run an AI agent' button available on several pages (Piloting, Campaigns, Compose…).",
        },
      },
      {
        q: { fr: "Les indicateurs sont-ils basés sur des données réelles ?", en: "Are the indicators based on real data?" },
        a: {
          fr: "Oui pour Facebook et Instagram, dès que le connecteur Meta est actif. LinkedIn reste toujours vide (voir « Filtrer par réseau »). Sans connecteur, les indicateurs et le benchmark restent à l'état vide — aucune valeur estimée ou simulée n'est affichée à la place.",
          en: "Yes for Facebook and Instagram, once the Meta connector is active. LinkedIn always stays empty (see 'Filter by network'). Without a connector, indicators and the benchmark stay empty — no estimated or simulated value is shown instead.",
        },
      },
      {
        q: { fr: "Puis-je annuler une décision validée ?", en: "Can I cancel an approved decision?" },
        a: {
          fr: "Oui, sans problème : « Valider » ne fait aujourd'hui que changer l'étiquette de la décision à l'écran, sans appeler d'API ni rien exécuter réellement. Vous pouvez donc basculer son statut entre « Valider » et « Ignorer » librement, sans conséquence côté serveur — et de toute façon, rien n'est conservé au-delà de la session : un rafraîchissement de la page efface toute la file.",
          en: "Yes, easily: 'Approve' currently only changes the decision's on-screen label — it doesn't call any API or actually execute anything. You can therefore switch its status between 'Approve' and 'Dismiss' freely, with no server-side consequence — and nothing survives beyond the session anyway: refreshing the page clears the whole queue.",
        },
      },
    ],
    shortcuts: [
      {
        fr: "Le sélecteur de pays (scope) en haut de page ne change que le libellé affiché et l'objectif auto-généré : il n'est transmis ni aux KPIs, ni à la veille, ni au benchmark (le benchmark reste de toute façon vide, cette fonctionnalité n'étant pas développée).",
        en: "The country selector (scope) at the top of the page only changes the displayed label and the auto-generated objective: it isn't passed to the KPIs, the watch data, or the benchmark (which stays empty anyway, as that feature isn't built).",
      },
    ],
    related: [
      { label: { fr: "Agents IA", en: "AI agents" }, href: "/agents" },
      { label: { fr: "Veille & Marché", en: "Watch & Market" }, href: "/veille" },
      { label: { fr: "Analytics", en: "Analytics" }, href: "/analytics" },
    ],
  },

  // ── /agents ─────────────────────────────────────────────────────────────────
  "/agents": {
    title: {
      fr: "Agents IA",
      en: "AI agents",
    },
    tagline: {
      fr: "Cette page redirige désormais vers le Centre de pilotage.",
      en: "This page now redirects to the Piloting center.",
    },
    whatFor: {
      fr: "/agents redirige automatiquement vers le Centre de pilotage (/pilotage) : il n'existe plus de page dédiée. Les agents IA se lancent depuis un bouton « Lancer un agent IA » disponible sur plusieurs pages (Pilotage, Campagnes, Composer…), via un panneau compact — objectif en texte libre et niveau d'autonomie — dont le résultat s'affiche directement en texte, sans timeline détaillée par agent.",
      en: "/agents automatically redirects to the Piloting center (/pilotage): there is no dedicated page anymore. AI agents are launched from a 'Run an AI agent' button available on several pages (Piloting, Campaigns, Compose…), via a compact panel — free-text objective and autonomy level — whose result is shown inline as text, with no per-agent execution timeline.",
    },
    actions: [
      {
        label: { fr: "Rédiger l'objectif", en: "Write the objective" },
        detail: {
          fr: "Dans le panneau « Lancer un agent IA », décrivez votre objectif en langage naturel. Plus le brief est précis, plus le résultat est exploitable.",
          en: "In the 'Run an AI agent' panel, describe your objective in natural language. The more precise the brief, the more actionable the result.",
        },
      },
      {
        label: { fr: "Choisir le niveau d'autonomie", en: "Choose the autonomy level" },
        detail: {
          fr: "Niveau 1 : recommandations uniquement. Niveau 2 : semi-automatique (certaines actions sans validation). Niveau 3 : entièrement automatique. Commencez par le niveau 1.",
          en: "Level 1: recommendations only. Level 2: semi-automatic (some actions without validation). Level 3: fully automatic. Start with level 1.",
        },
      },
      {
        label: { fr: "Lancer le cycle", en: "Launch the cycle" },
        detail: {
          fr: "Le bouton d'appel appelle /api/agents/run et déclenche la séquence d'agents (Stratège, Copywriter, Creative, Conformité, Media Buyer, Analyste, plus deux étapes internes d'orchestration et de publication). Le résultat s'affiche en texte libre, directement dans le panneau, une fois le cycle terminé (10–30 s).",
          en: "The launch button calls /api/agents/run and triggers the agent sequence (Strategist, Copywriter, Creative, Compliance, Media Buyer, Analyst, plus two internal orchestration and publishing steps). The result is shown as free text, directly in the panel, once the cycle completes (10–30 s).",
        },
      },
    ],
    tips: [
      {
        fr: "Activez toujours la relecture humaine (niveau 1 ou 2) pour les contenus à caractère médical ou réglementé.",
        en: "Always enable human review (level 1 or 2) for medical or regulated content.",
      },
      {
        fr: "Fournissez un objectif détaillé (ton, mots-clés à inclure, contraintes) pour obtenir un résultat exploitable dès le premier essai.",
        en: "Provide a detailed objective (tone, keywords to include, constraints) to get an actionable result on the first try.",
      },
    ],
    faq: [
      {
        q: { fr: "Combien d'agents sont impliqués dans un cycle ?", en: "How many agents are involved in a cycle?" },
        a: {
          fr: "6 agents nommés (Stratège, Copywriter, Creative, Media Buyer, Analyste, Conformité), plus deux étapes internes d'orchestration et de publication. Ils s'exécutent toujours en séquence.",
          en: "6 named agents (Strategist, Copywriter, Creative, Media Buyer, Analyst, Compliance), plus two internal orchestration and publishing steps. They always run in sequence.",
        },
      },
      {
        q: { fr: "Que faire si un agent retourne une erreur ?", en: "What if an agent returns an error?" },
        a: {
          fr: "Vérifiez la clé API Anthropic dans Connecteurs (variable ANTHROPIC_API_KEY). Si la clé est valide, relancez le cycle — les erreurs transitoires se résolvent généralement seules.",
          en: "Check the Anthropic API key in Connectors (ANTHROPIC_API_KEY variable). If the key is valid, relaunch the cycle — transient errors typically resolve on their own.",
        },
      },
    ],
    related: [
      { label: { fr: "Centre de pilotage", en: "Piloting center" }, href: "/pilotage" },
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
    ],
  },

  // ── /veille ─────────────────────────────────────────────────────────────────
  "/veille": {
    title: {
      fr: "Veille & Marché",
      en: "Watch & Market",
    },
    tagline: {
      fr: "Analysez vos concurrents et les tendances de votre marché.",
      en: "Analyse your competitors and market trends.",
    },
    whatFor: {
      fr: "La veille & marché est le dispositif de benchmark concurrentiel d'AXON-AI. Vous paramétrez une zone géographique, une thématique, des mots-clés et une liste de compétiteurs à surveiller. En lançant l'analyse, l'IA collecte les contenus publiés par vos concurrents, les analyse et produit des insights actionnables (formats gagnants, angles éditoriaux, benchmarks de performance) ainsi que des recommandations priorisées qui remontent automatiquement dans le centre de pilotage.",
      en: "Watch & Market is AXON-AI's competitive benchmarking feature. You configure a geographic area, topic, keywords and a list of competitors to monitor. By launching the analysis, the AI collects content published by your competitors, analyses it and produces actionable insights (winning formats, editorial angles, performance benchmarks) plus prioritised recommendations that automatically feed into the piloting center.",
    },
    actions: [
      {
        label: { fr: "Définir la zone géographique", en: "Set the geographic area" },
        detail: {
          fr: "Tapez ou sélectionnez le pays cible dans le champ de recherche. Ce paramètre filtre les données concurrentielles et oriente l'identification automatique de concurrents vers les acteurs locaux pertinents.",
          en: "Type or pick the target country in the search field. This parameter filters competitive data and directs automatic competitor identification towards relevant local players.",
        },
      },
      {
        label: { fr: "Saisir la thématique et les mots-clés", en: "Enter the topic and keywords" },
        detail: {
          fr: "La thématique principale oriente l'identification IA (ex. : « Fintech B2B »). Les mots-clés (saisis en appuyant sur Entrée) affinent la collecte de contenus et l'analyse de tendances.",
          en: "The main topic guides AI identification (e.g. 'B2B Fintech'). Keywords (entered by pressing Enter) refine content collection and trend analysis.",
        },
      },
      {
        label: { fr: "Ajouter un compétiteur manuellement", en: "Add a competitor manually" },
        detail: {
          fr: "Sélectionnez le réseau (Instagram, TikTok, YouTube, LinkedIn, Facebook), entrez le @handle et un nom affiché optionnel, puis cliquez sur « Ajouter manuellement ». Le compétiteur est sauvegardé en base et persiste entre les sessions.",
          en: "Select the network (Instagram, TikTok, YouTube, LinkedIn, Facebook), enter the @handle and an optional display name, then click 'Add manually'. The competitor is saved in the database and persists between sessions.",
        },
      },
      {
        label: { fr: "Identifier automatiquement des concurrents", en: "Automatically identify competitors" },
        detail: {
          fr: "Le bouton « Identifier des concurrents » (icône étincelle) appelle Claude avec votre thématique, mots-clés et zone géo pour suggérer des profils concurrents pertinents. Cliquez « Ajouter » sous chaque suggestion pour l'intégrer à votre liste.",
          en: "The 'Identify competitors' button (sparkle icon) calls Claude with your topic, keywords and geo zone to suggest relevant competitor profiles. Click 'Add' under each suggestion to include it in your list.",
        },
      },
      {
        label: { fr: "Supprimer un compétiteur", en: "Remove a competitor" },
        detail: {
          fr: "Cliquez sur l'icône de suppression à droite d'un compétiteur dans la liste active pour le retirer de la surveillance. La suppression est immédiate et persistante.",
          en: "Click the delete icon to the right of a competitor in the active list to remove them from monitoring. Deletion is immediate and persistent.",
        },
      },
      {
        label: { fr: "Lancer l'analyse", en: "Launch the analysis" },
        detail: {
          fr: "Le bouton « Lancer l'analyse » déclenche la collecte des contenus concurrents (scraping réel ou simulé selon les connecteurs actifs) et l'analyse IA. La durée est affichée à la fin de la collecte.",
          en: "The 'Launch analysis' button triggers competitor content collection (real scraping or simulated depending on active connectors) and AI analysis. Duration is shown after collection.",
        },
      },
      {
        label: { fr: "Lire l'analyse IA", en: "Read the AI analysis" },
        detail: {
          fr: "L'onglet « Analyse IA » présente un résumé exécutif, les insights détaillés (format, angle, benchmark) et les recommandations avec leur niveau de priorité. Ces recommandations sont également injectées dans le centre de pilotage.",
          en: "The 'AI analysis' tab presents an executive summary, detailed insights (format, angle, benchmark) and recommendations with priority level. These recommendations are also injected into the piloting center.",
        },
      },
      {
        label: { fr: "Parcourir les contenus collectés", en: "Browse collected content" },
        detail: {
          fr: "L'onglet « Contenus » affiche les publications scrappées chez vos concurrents avec réseau, date et métriques. Identifiez les formats et sujets qui génèrent le plus d'engagement.",
          en: "The 'Content' tab shows posts scraped from your competitors with network, date and metrics. Identify the formats and topics generating the most engagement.",
        },
      },
      {
        label: { fr: "Relancer une analyse", en: "Relaunch an analysis" },
        detail: {
          fr: "Après un run, le bouton « Relancer » permet de rafraîchir la collecte avec les mêmes paramètres — utile pour comparer l'évolution concurrentielle sur plusieurs semaines.",
          en: "After a run, the 'Relaunch' button refreshes the collection with the same parameters — useful to compare competitive evolution over several weeks.",
        },
      },
    ],
    tips: [
      {
        fr: "Commencez avec 3 à 5 compétiteurs directs plutôt qu'une liste trop longue — l'analyse sera plus ciblée et plus rapide.",
        en: "Start with 3 to 5 direct competitors rather than a very long list — the analysis will be more focused and faster.",
      },
      {
        fr: "Utilisez l'identification automatique comme point de départ, puis affinez manuellement en ajoutant des acteurs très spécifiques à votre niche.",
        en: "Use automatic identification as a starting point, then manually refine by adding players very specific to your niche.",
      },
      {
        fr: "Relancez l'analyse régulièrement (manuellement) pour suivre l'évolution des tendances concurrentielles dans le temps.",
        en: "Re-run the analysis regularly (manually) to track competitive trend evolution over time.",
      },
      {
        fr: "Les réseaux marqués « Simulé » dans la barre de statut utilisent des données fictives — activez le connecteur correspondant pour des données réelles.",
        en: "Networks marked 'Simulated' in the status bar use fictional data — activate the corresponding connector for real data.",
      },
    ],
    faq: [
      {
        q: { fr: "La veille est-elle en temps réel ?", en: "Is the watch real-time?" },
        a: {
          fr: "Non, c'est une analyse lancée manuellement. Les données sont collectées au moment du run et restent disponibles jusqu'au prochain run.",
          en: "No, it is an analysis launched manually. Data is collected at run time and remains available until the next run.",
        },
      },
      {
        q: { fr: "Les données de scraping sont-elles conformes au RGPD ?", en: "Is the scraping data GDPR-compliant?" },
        a: {
          fr: "Le scraping porte sur des contenus publics des pages d'entreprises, conformément aux CGU des plateformes. Aucune donnée personnelle privée n'est collectée.",
          en: "Scraping covers public content from business pages, in line with platform terms of service. No private personal data is collected.",
        },
      },
      {
        q: { fr: "Que signifie un insight de type 'benchmark' ?", en: "What does a 'benchmark' type insight mean?" },
        a: {
          fr: "Un insight benchmark compare une de vos métriques (ex. taux d'engagement) à la moyenne observée chez vos concurrents, avec une indication sur l'écart et son interprétation.",
          en: "A benchmark insight compares one of your metrics (e.g. engagement rate) to the average observed among your competitors, with an indication of the gap and its interpretation.",
        },
      },
    ],
    related: [
      { label: { fr: "Centre de pilotage", en: "Piloting center" }, href: "/pilotage" },
      { label: { fr: "Analytics", en: "Analytics" }, href: "/analytics" },
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
    ],
  },

  // ── /parametres-connecteurs (+ /connecteurs) ─────────────────────────────────
  "/parametres-connecteurs": {
    title: {
      fr: "Connecteurs & accès données",
      en: "Connectors & data access",
    },
    tagline: {
      fr: "Configurez tous vos accès externes — réseaux sociaux, publicité, IA, mesure.",
      en: "Configure all your external access — social networks, advertising, AI, measurement.",
    },
    whatFor: {
      fr: "La page Connecteurs centralise la configuration de vos réseaux sociaux (Facebook, Instagram, LinkedIn — TikTok reste en mode simulé ici), de la publicité (Meta Ads) et de la mesure (Meta Pixel + CAPI). Les connecteurs IA (Anthropic Claude, Replicate) et de veille (YouTube) sont intégrés à l'application et ne nécessitent aucune configuration ici.",
      en: "The Connectors page centralises configuration for your social networks (Facebook, Instagram, LinkedIn — TikTok stays in simulated mode here), advertising (Meta Ads) and measurement (Meta Pixel + CAPI). AI connectors (Anthropic Claude, Replicate) and the watch connector (YouTube) are built into the app and need no configuration here.",
    },
    actions: [
      {
        label: { fr: "Configurer un connecteur réseau social", en: "Configure a social network connector" },
        detail: {
          fr: "Pour Facebook, Instagram et LinkedIn, développez la carte du réseau et renseignez les champs requis (Page ID, Access Token, Organization URN…), ou utilisez le bouton « ⚡ Connexion auto » pour lancer l'OAuth directement. Le statut passe à « Connecté » une fois les champs obligatoires remplis.",
          en: "For Facebook, Instagram and LinkedIn, expand the network card and fill in the required fields (Page ID, Access Token, Organization URN…), or use the '⚡ Auto connect' button to launch OAuth directly. Status switches to 'Connected' once required fields are filled.",
        },
      },
      {
        label: { fr: "Meta Ads et Meta Pixel + CAPI", en: "Meta Ads and Meta Pixel + CAPI" },
        detail: {
          fr: "Ces deux connecteurs s'activent automatiquement dès que Facebook est connecté — rien à configurer ici.",
          en: "These two connectors activate automatically as soon as Facebook is connected — nothing to configure here.",
        },
      },
      {
        label: { fr: "Comprendre les niveaux d'accès lecture/écriture", en: "Understand read/write access levels" },
        detail: {
          fr: "Lecture : récupère vos statistiques et insights sans agir sur vos comptes. Écriture : autorise les agents à publier, répondre, créer des campagnes ou envoyer des événements. Chaque connecteur liste explicitement ses capacités.",
          en: "Read: retrieves your statistics and insights without acting on your accounts. Write: allows agents to publish, reply, create campaigns or send events. Each connector explicitly lists its capabilities.",
        },
      },
      {
        label: { fr: "Vérifier l'état de connexion", en: "Check connection status" },
        detail: {
          fr: "Statuts possibles : Connecté / En attente / Non configuré / Mode simulé (TikTok reste toujours en mode simulé sur cette page). Le compteur « X/Y connectés » en haut de chaque groupe donne une vue rapide du taux de configuration.",
          en: "Possible statuses: Connected / Pending / Not configured / Simulated mode (TikTok always stays in simulated mode on this page). The 'X/Y connected' counter at the top of each group gives a quick configuration rate view.",
        },
      },
    ],
    tips: [
      {
        fr: "Commencez par configurer Facebook et Instagram (ils partagent le même token Meta) avant les autres réseaux.",
        en: "Start by configuring Facebook and Instagram (they share the same Meta token) before other networks.",
      },
      {
        fr: "Pour connecter réellement TikTok, utilisez la page Comptes plutôt que celle-ci.",
        en: "To really connect TikTok, use the Accounts page rather than this one.",
      },
      {
        fr: "Si le statut Facebook/Instagram reste « En attente » après connexion, c'est qu'aucune Page n'est encore associée : rendez-vous sur Mes Pages pour la choisir.",
        en: "If the Facebook/Instagram status stays 'Pending' after connecting, no Page is linked yet: go to My Pages to pick one.",
      },
    ],
    faq: [
      {
        q: { fr: "Où trouver le Page ID Facebook ?", en: "Where can I find the Facebook Page ID?" },
        a: {
          fr: "Sur developers.facebook.com : ouvrez votre app → Business Manager → sélectionnez la Page. L'ID s'affiche dans l'URL ou dans les paramètres avancés de la Page.",
          en: "On developers.facebook.com: open your app → Business Manager → select the Page. The ID appears in the URL or in the Page's advanced settings.",
        },
      },
      {
        q: { fr: "Le statut reste 'En attente' malgré la sauvegarde — pourquoi ?", en: "Status stays 'Pending' despite saving — why?" },
        a: {
          fr: "Un ou plusieurs champs obligatoires sont manquants ou vides. Vérifiez que tous les champs non-optionnels de la carte sont remplis. Les champs secrets masqués indiquent « __secret__ » si déjà enregistrés.",
          en: "One or more required fields are missing or empty. Make sure all non-optional fields on the card are filled. Masked secret fields show '__secret__' if already saved.",
        },
      },
      {
        q: { fr: "Quelle différence entre /connecteurs et /parametres-connecteurs ?", en: "What is the difference between /connecteurs and /parametres-connecteurs?" },
        a: {
          fr: "/connecteurs redirige automatiquement vers /parametres-connecteurs qui est la page fonctionnelle. Les deux URLs mènent au même endroit.",
          en: "/connecteurs automatically redirects to /parametres-connecteurs which is the functional page. Both URLs lead to the same place.",
        },
      },
    ],
    shortcuts: [
      {
        fr: "Groupe « Réseaux sociaux » → publication organique. Groupe « Publicité & Ads » → campagnes payantes. Groupe « Mesure » → attribution et conversions.",
        en: "Group 'Social networks' → organic publishing. Group 'Advertising & Ads' → paid campaigns. Group 'Measurement' → attribution and conversions.",
      },
    ],
    related: [
      { label: { fr: "Comptes connectés", en: "Connected accounts" }, href: "/accounts" },
      { label: { fr: "Mes Pages", en: "My Pages" }, href: "/pages-meta" },
      { label: { fr: "Performances publicitaires", en: "Ad performance" }, href: "/ad-performance" },
    ],
  },

  // ── /compose ────────────────────────────────────────────────────────────────
  "/compose": {
    title: {
      fr: "Composer",
      en: "Compose",
    },
    tagline: {
      fr: "Créez et publiez du contenu sur tous vos réseaux en une seule fois.",
      en: "Create and publish content across all your networks at once.",
    },
    whatFor: {
      fr: "L'éditeur de composition vous permet de rédiger, illustrer et cibler un post pour Facebook, Instagram ou TikTok. LinkedIn n'est pas ciblable depuis Composer : il dispose de son propre espace de publication dédié (Espace LinkedIn). Vous pouvez publier immédiatement, programmer à une date précise, sauvegarder en brouillon (Publications programmées) ou enregistrer un texte réutilisable dans la Bibliothèque. Un agent IA toujours visible rédige un texte par réseau ciblé et l'aperçu en temps réel respecte les contraintes de format de chaque plateforme. Pour Facebook/Instagram, un post peut aussi être publié en Story ou en Reel plutôt qu'au fil, et accepter un album/carrousel de plusieurs photos.",
      en: "The composition editor lets you write, illustrate and target a post for Facebook, Instagram or TikTok. LinkedIn cannot be targeted from Compose: it has its own dedicated publishing space (LinkedIn space). You can publish immediately, schedule for a specific date, save as a draft (Scheduled posts) or save a reusable text to the Library. An always-visible AI agent writes one text per targeted network and the real-time preview respects each platform's format constraints. For Facebook/Instagram, a post can also be published as a Story or Reel instead of to the feed, and accept a multi-photo album/carousel.",
    },
    actions: [
      {
        label: { fr: "Choisir les réseaux cibles", en: "Choose target networks" },
        detail: {
          fr: "Cochez un ou plusieurs réseaux parmi Facebook, Instagram et TikTok en haut du formulaire ; LinkedIn n'apparaît pas dans ce sélecteur — un lien renvoie vers son espace dédié. L'aperçu se met à jour pour refléter les contraintes de format propres à chaque plateforme (longueur du texte, ratio d'image).",
          en: "Check one or more of Facebook, Instagram and TikTok at the top of the form; LinkedIn does not appear in this selector — a link points to its dedicated space. The preview updates to reflect each platform's format constraints (text length, image ratio).",
        },
      },
      {
        label: { fr: "Rédiger le texte du post", en: "Write the post text" },
        detail: {
          fr: "Utilisez l'éditeur de texte principal pour rédiger votre contenu. Aucun compteur de caractères ni limite par réseau n'est affiché pendant la saisie — seul l'aperçu à droite tronque l'affichage avec « voir plus », à titre indicatif.",
          en: "Use the main text editor to write your content. No character counter or per-network limit is shown while typing — the preview on the right only truncates the display with 'see more', for reference.",
        },
      },
      {
        label: { fr: "Utiliser l'agent de publication (IA)", en: "Use the publishing agent (AI)" },
        detail: {
          fr: "Le bloc « Votre agent de publication » est visible en permanence sous la rédaction — l'étoile ✦ dans son en-tête est une icône décorative, pas un bouton à cliquer. Décrivez votre intention dans son champ de conversation : l'agent rédige un seul texte par réseau ciblé (pas plusieurs variantes à comparer) et propose un visuel ; redemandez une reformulation par un nouveau message (« plus court », « plus fun »…).",
          en: "The 'Your publishing agent' block is permanently visible below the text editor — the ✦ star in its header is a decorative icon, not a clickable button. Describe your intent in its chat field: the agent writes a single text per targeted network (not several variants to compare) and suggests a visual; ask for a rewrite with a new message ('shorter', 'more fun'…).",
        },
      },
      {
        label: { fr: "Ajouter des médias", en: "Add media" },
        detail: {
          fr: "Glissez-déposez une image ou une vidéo, ou sélectionnez un média depuis la Bibliothèque. Les formats acceptés (PNG, JPG, WebP, MP4, MOV, WebM) et la taille maximale (100 Mo) sont fixes, identiques quel que soit le réseau ciblé — aucune recommandation dynamique de dimensions par plateforme n'est affichée, et aucun redimensionnement automatique n'est appliqué : un fichier trop volumineux est refusé avec un message d'erreur plutôt que compressé.",
          en: "Drag and drop an image or video, or select media from the Library. Accepted formats (PNG, JPG, WebP, MP4, MOV, WebM) and the maximum size (100 MB) are fixed and identical regardless of the targeted network — no dynamic per-platform dimension guidance is shown, and no automatic resizing is applied: an oversized file is rejected with an error message instead of being compressed.",
        },
      },
      {
        label: { fr: "Monter le média intégré (texte, musique, découpe)", en: "Edit the media in place (text, music, cutting)" },
        detail: {
          fr: "Le bouton « 🎬 Monter (texte, musique, découpe) » ouvre un banc de montage intégré directement dans Compose — ajout de texte, musique de fond, découpe non destructive — sans passer par le Studio Créatif séparé.",
          en: "The '🎬 Edit (text, music, cutting)' button opens an editing bench built right into Compose — adding text, background music, non-destructive trimming — without going through the separate Creative Studio.",
        },
      },
      {
        label: { fr: "Choisir la langue et le modèle IA", en: "Choose the language and AI model" },
        detail: {
          fr: "Une langue de diffusion est sélectionnable parmi 10 (Français, Kreol Morisien, English, Español, Deutsch, Italiano, Português, Nederlands, العربية, 中文) pour orienter la rédaction. Le modèle de génération d'image et de vidéo est aussi choisissable ; pour Facebook/Instagram/LinkedIn, la vidéo est restreinte par défaut à un modèle économique, avec une case « Autoriser les modèles premium (coût plus élevé) » pour lever cette restriction.",
          en: "A publishing language is selectable among 10 (Français, Kreol Morisien, English, Español, Deutsch, Italiano, Português, Nederlands, العربية, 中文) to steer the writing. The image and video generation model is also selectable; for Facebook/Instagram/LinkedIn, video defaults to a cost-effective model, with an 'Allow premium models (higher cost)' checkbox to lift that restriction.",
        },
      },
      {
        label: { fr: "S'appuyer sur le Brand Kit et l'inspiration créative", en: "Use the Brand Kit and creative inspiration" },
        detail: {
          fr: "Un panneau « Brand Kit » (logo, palette, style) et un panneau « S'inspirer d'une créa existante » (vos publicités, celles des concurrents via l'Ad Library, ou du contenu de veille) sont disponibles pour nourrir la création.",
          en: "A 'Brand Kit' panel (logo, palette, style) and an 'Get inspired by an existing creative' panel (your own ads, competitors' via the Ad Library, or content watch results) are available to feed the creation.",
        },
      },
      {
        label: { fr: "Programmer la publication", en: "Schedule the post" },
        detail: {
          fr: "Cliquez sur « Programmer » pour choisir une date et une heure précises. Le post passe dans l'onglet « Publications programmées » et sera publié automatiquement à l'heure indiquée. Un bandeau propose un créneau suggéré pour le réseau choisi — appris à partir des performances réelles mesurées dès qu'il y en a assez, sinon un repère général par réseau — avec un bouton pour l'appliquer directement. Rouvrir Compose depuis un post déjà programmé (« Modifier ») met à jour ce post existant, sans créer de doublon.",
          en: "Click 'Schedule' to choose a specific date and time. The post moves to the 'Scheduled posts' tab and will be published automatically at the indicated time. A banner suggests a slot for the chosen network — learned from real measured performance once there is enough of it, otherwise a general per-network benchmark — with a button to apply it directly. Reopening Compose from an already-scheduled post ('Edit') updates that existing post, without creating a duplicate.",
        },
      },
      {
        label: { fr: "Configurer les réglages TikTok", en: "Configure TikTok settings" },
        detail: {
          fr: "Quand TikTok est ciblé, un bloc dédié apparaît pour choisir la confidentialité de la publication et les interactions autorisées (commentaires, Duet, Stitch), conformément aux exigences de l'API TikTok — sans valeur par défaut, à définir à chaque fois.",
          en: "When TikTok is targeted, a dedicated block appears to choose the post's privacy level and allowed interactions (comments, Duet, Stitch), per TikTok API requirements — with no default value, to be set every time.",
        },
      },
      {
        label: { fr: "Publier immédiatement", en: "Publish immediately" },
        detail: {
          fr: "« Publier maintenant » déclenche la diffusion immédiate sur les réseaux sélectionnés via les connecteurs configurés. La publication passe dans l'Historique une fois envoyée.",
          en: "'Publish now' triggers immediate distribution on the selected networks via configured connectors. The post moves to History once sent.",
        },
      },
      {
        label: { fr: "Sauvegarder en brouillon ou dans la Bibliothèque", en: "Save as draft or to the Library" },
        detail: {
          fr: "« Enregistrer comme brouillon » enregistre le post au statut « brouillon » dans l'onglet « Brouillons » de Publications programmées — ce n'est pas la Bibliothèque. Pour enregistrer un texte réutilisable dans la Bibliothèque, utilisez le bouton séparé « Enregistrer dans la bibliothèque ». La rédaction est aussi sauvegardée automatiquement en brouillon après 2,5 secondes d'inactivité, avec un indicateur d'état (Enregistrement… / Enregistré / échec de la sauvegarde auto).",
          en: "'Save as draft' saves the post with 'draft' status in the 'Drafts' tab of Scheduled posts — this is not the Library. To save a reusable text to the Library, use the separate 'Save to library' button. Writing is also autosaved as a draft after 2.5 seconds of inactivity, with a status indicator (Saving… / Saved / autosave failed).",
        },
      },
    ],
    tips: [
      {
        fr: "Rédigez d'abord pour le réseau avec les contraintes les plus strictes, puis adaptez pour les autres.",
        en: "Write first for the network with the strictest constraints, then adapt for the others.",
      },
      {
        fr: "LinkedIn n'est jamais dans la liste des réseaux cochables de Composer — utilisez l'Espace LinkedIn dédié pour ce réseau.",
        en: "LinkedIn is never in Compose's list of checkable networks — use the dedicated LinkedIn space for that network.",
      },
      {
        fr: "Sauvegardez régulièrement en brouillon (ou laissez faire la sauvegarde automatique après 2,5 s d'inactivité) pour ne pas perdre votre travail en cas de rechargement de page.",
        en: "Save regularly as draft (or let autosave do it after 2.5 s of inactivity) to avoid losing your work if the page reloads.",
      },
    ],
    faq: [
      {
        q: { fr: "Pourquoi ma publication a échoué ?", en: "Why did my post fail?" },
        a: {
          fr: "Un token expiré ou un connecteur non configuré est la cause la plus fréquente. Vérifiez le statut du connecteur dans la page Connecteurs et reconnectez si nécessaire.",
          en: "An expired token or unconfigured connector is the most common cause. Check the connector status in the Connectors page and reconnect if needed.",
        },
      },
      {
        q: { fr: "Puis-je publier sur plusieurs réseaux à la fois ?", en: "Can I publish on multiple networks at once?" },
        a: {
          fr: "Oui, en cochant plusieurs réseaux (Facebook, Instagram, TikTok) dans le sélecteur. Chaque réseau reçoit son propre texte, rédigé par l'agent IA — adaptez-le si les contraintes de format diffèrent.",
          en: "Yes, by checking multiple networks (Facebook, Instagram, TikTok) in the selector. Each network gets its own text, written by the AI agent — adjust it if format constraints differ.",
        },
      },
      {
        q: { fr: "Où va mon brouillon, et où va la Bibliothèque ?", en: "Where does my draft go, and where does the Library go?" },
        a: {
          fr: "Un « brouillon » (Enregistrer comme brouillon) est un post en attente dans l'onglet « Brouillons » de Publications programmées. La Bibliothèque est distincte : « Enregistrer dans la bibliothèque » y stocke un texte réutilisable, indépendamment de tout post.",
          en: "A 'draft' (Save as draft) is a pending post in the 'Drafts' tab of Scheduled posts. The Library is separate: 'Save to library' stores a reusable text there, independently of any post.",
        },
      },
    ],
    related: [
      { label: { fr: "Publications programmées", en: "Scheduled posts" }, href: "/scheduled" },
      { label: { fr: "Médiathèque", en: "Media library" }, href: "/media" },
      { label: { fr: "Espace LinkedIn", en: "LinkedIn space" }, href: "/linkedin" },
    ],
  },

  // ── /scheduled ──────────────────────────────────────────────────────────────
  "/scheduled": {
    title: {
      fr: "Publications programmées",
      en: "Scheduled posts",
    },
    tagline: {
      fr: "Visualisez et gérez tout ce qui est en attente de diffusion.",
      en: "View and manage everything waiting to be published.",
    },
    whatFor: {
      fr: "Les publications programmées listent tous les posts qui n'ont pas encore été diffusés, avec des onglets Tout / Planifiés / À valider (si le workflow de validation est activé pour la société) / Échecs / Brouillons. Un sélecteur bascule entre une liste groupée par date et une vue calendrier mensuelle. Cliquer un post ouvre une fenêtre pour le republanifier, le publier en avance ou le supprimer — et, s'il est en attente de validation, l'approuver ou le refuser.",
      en: "Scheduled posts list everything not yet published, with tabs All / Scheduled / To approve (if the company's approval workflow is enabled) / Failed / Drafts. A selector switches between a list grouped by date and a monthly calendar view. Clicking a post opens a window to reschedule it, publish it early or delete it — and, if it is awaiting approval, to approve or reject it.",
    },
    actions: [
      {
        label: { fr: "Reprogrammer un post", en: "Reschedule a post" },
        detail: {
          fr: "Cliquez sur la carte d'un post pour ouvrir sa fiche, choisissez une nouvelle date et heure dans le bloc « Replanifier », puis « Enregistrer ». Il n'y a pas de glisser-déposer.",
          en: "Click a post card to open its detail, pick a new date and time in the 'Reschedule' block, then 'Save'. There is no drag and drop.",
        },
      },
      {
        label: { fr: "Publier en avance", en: "Publish early" },
        detail: {
          fr: "Un post planifié part automatiquement au cron à l'heure prévue ; le bouton « Publier maintenant » dans sa fiche l'envoie immédiatement sans attendre cette échéance.",
          en: "A scheduled post is sent automatically by the cron at its due time; the 'Publish now' button in its detail sends it immediately instead of waiting.",
        },
      },
      {
        label: { fr: "Approuver ou refuser une publication (workflow de validation)", en: "Approve or reject a post (approval workflow)" },
        detail: {
          fr: "Si le workflow de validation est activé pour la société (réglage dans Paramètres), les publications programmées par un membre passent « À valider » : un owner/admin les approuve pour qu'elles partent normalement, ou les refuse avec un motif optionnel — la publication redevient alors un brouillon visible par son auteur.",
          en: "If the company's approval workflow is enabled (setting in Settings), posts scheduled by a member go 'To approve': an owner/admin approves them so they go out normally, or rejects them with an optional note — the post then becomes a draft visible to its author again.",
        },
      },
      {
        label: { fr: "Supprimer un post", en: "Delete a post" },
        detail: {
          fr: "Le bouton « Supprimer » (dans la fiche ou au survol de la carte) efface définitivement le post — ce n'est pas une mise en brouillon.",
          en: "The 'Delete' button (in the detail view or on card hover) permanently removes the post — this is not a move to draft.",
        },
      },
      {
        label: { fr: "Basculer entre vue liste et vue calendrier", en: "Switch between list and calendar view" },
        detail: {
          fr: "Le sélecteur de vue passe d'une liste groupée par jour à un calendrier mensuel avec navigation par mois.",
          en: "The view selector switches from a list grouped by day to a monthly calendar with month navigation.",
        },
      },
    ],
    tips: [
      {
        fr: "L'onglet « À valider » n'apparaît que si le workflow de validation est activé pour la société, ou tant qu'il reste des publications en attente après sa désactivation.",
        en: "The 'To approve' tab only appears if the company's approval workflow is enabled, or while pending posts remain after it was disabled.",
      },
      {
        fr: "Un post refusé redevient un brouillon avec le motif du refus visible — son auteur peut le corriger et le reprogrammer.",
        en: "A rejected post becomes a draft again with the rejection reason visible — its author can fix it and reschedule it.",
      },
    ],
    faq: [
      {
        q: { fr: "Un post programmé peut-il échouer à l'heure prévue ?", en: "Can a scheduled post fail at the expected time?" },
        a: {
          fr: "Oui, si le token du connecteur a expiré entre la programmation et la date de publication. Vérifiez régulièrement le statut des connecteurs et renouvelez les tokens avant leur expiration.",
          en: "Yes, if the connector token expired between scheduling and publication date. Regularly check connector status and renew tokens before expiry.",
        },
      },
      {
        q: { fr: "Qui peut approuver une publication en attente ?", en: "Who can approve a pending post?" },
        a: {
          fr: "Seul un owner/admin de l'organisation peut approuver ou refuser — un Community Manager (member) qui programme dans une société où le workflow est actif passe systématiquement par cette étape.",
          en: "Only an org owner/admin can approve or reject — a Community Manager (member) scheduling in a company with the workflow enabled always goes through this step.",
        },
      },
    ],
    related: [
      { label: { fr: "Composer un post", en: "Compose a post" }, href: "/compose" },
      { label: { fr: "Historique", en: "History" }, href: "/history" },
      { label: { fr: "Paramètres", en: "Settings" }, href: "/settings" },
    ],
  },

  // ── /library ────────────────────────────────────────────────────────────────
  "/library": {
    title: {
      fr: "Bibliothèque",
      en: "Library",
    },
    tagline: {
      fr: "Cette page redirige désormais vers la Médiathèque.",
      en: "This page now redirects to the Media library.",
    },
    whatFor: {
      fr: "La page Bibliothèque a été retirée (aucun intérêt constaté à l'usage) : /library redirige automatiquement vers la Médiathèque (/media), qui rassemble tous les visuels et vidéos réutilisables de la marque.",
      en: "The Library page has been removed (found to add no value in practice): /library automatically redirects to the Media library (/media), which gathers all the brand's reusable visuals and videos.",
    },
    actions: [],
    tips: [],
    faq: [],
    related: [
      { label: { fr: "Médiathèque", en: "Media library" }, href: "/media" },
      { label: { fr: "Composer un post", en: "Compose a post" }, href: "/compose" },
    ],
  },

  // ── /history ────────────────────────────────────────────────────────────────
  "/history": {
    title: {
      fr: "Historique",
      en: "History",
    },
    tagline: {
      fr: "Retrouvez toutes les publications passées et leurs performances.",
      en: "Find all past publications and their performance.",
    },
    whatFor: {
      fr: "L'Historique archive l'intégralité des posts publiés avec leur date, réseau, statut (publié / échoué) et métriques mesurées (réactions, commentaires, partages, clics sur le lien). Vous pouvez filtrer, rechercher, exporter ou dupliquer un post existant directement depuis cet écran. C'est la mémoire éditoriale de votre organisation.",
      en: "History archives all published posts with their date, network, status (published / failed) and measured metrics (reactions, comments, shares, link clicks). You can filter, search, export or duplicate an existing post directly from this screen. It is your organisation's editorial memory.",
    },
    actions: [
      {
        label: { fr: "Filtrer par période, statut et recherche", en: "Filter by period, status and search" },
        detail: {
          fr: "Choisissez une période (7/30/90 jours, dernière année, tout le temps ou plage personnalisée) et un statut via les onglets Tout / Publiés / Échoués, puis affinez avec la recherche plein texte (texte du post ou nom de l'automation).",
          en: "Choose a period (last 7/30/90 days, last year, all time or a custom range) and a status via the All / Published / Failed tabs, then refine with the full-text search (post text or automation name).",
        },
      },
      {
        label: { fr: "Dupliquer un post existant", en: "Duplicate an existing post" },
        detail: {
          fr: "Depuis la fiche détaillée d'un post, « Dupliquer en nouvelle publication » ouvre l'éditeur Composer pré-rempli avec son contenu.",
          en: "From a post's detail sheet, 'Duplicate as new post' opens the Composer editor pre-filled with its content.",
        },
      },
      {
        label: { fr: "Exporter les données", en: "Export data" },
        detail: {
          fr: "Le menu « Exporter » propose CSV ou JSON pour la liste actuellement affichée.",
          en: "The 'Export' menu offers CSV or JSON for the currently displayed list.",
        },
      },
      {
        label: { fr: "Consulter les métriques d'un post", en: "View a post's metrics" },
        detail: {
          fr: "Cliquez sur un post pour ouvrir sa fiche détaillée : réactions, commentaires, partages et clics sur le lien, ainsi que le média publié et un lien vers la publication d'origine.",
          en: "Click a post to open its detail sheet: reactions, comments, shares and link clicks, plus the published media and a link to the original post.",
        },
      },
      {
        label: { fr: "Republier un post en échec", en: "Republish a failed post" },
        detail: {
          fr: "Les posts marqués « Échec » affichent un bouton « Réessayer » à côté du message d'erreur. Pour republier, utilisez « Dupliquer en nouvelle publication » depuis la fiche détaillée : le post se rouvre dans Composer, prêt à être renvoyé.",
          en: "Posts marked 'Failed' show a 'Retry' button next to the error message. To republish, use 'Duplicate as new post' from the detail sheet: the post reopens in Composer, ready to resend.",
        },
      },
      {
        label: { fr: "Supprimer un post de l'historique", en: "Delete a post from history" },
        detail: {
          fr: "Depuis la fiche détaillée, le bouton « Supprimer » retire définitivement l'entrée après confirmation — action irréversible.",
          en: "From the detail sheet, the 'Delete' button permanently removes the entry after confirmation — this cannot be undone.",
        },
      },
    ],
    tips: [
      {
        fr: "Comparez les taux d'engagement entre marques sur la même période pour identifier les formats et sujets qui résonnent le mieux.",
        en: "Compare engagement rates between brands over the same period to identify the formats and topics that resonate best.",
      },
      {
        fr: "Les posts en échec ont souvent besoin d'une re-publication manuelle — vérifiez la connexion du compte concerné dans Connecteurs.",
        en: "Failed posts often need manual republishing — check the relevant account connection in Connectors.",
      },
    ],
    faq: [
      {
        q: { fr: "L'historique inclut-il les posts publiés par des automatisations ?", en: "Does history include posts published by automated flows?" },
        a: {
          fr: "Oui, tous les posts publiés via AXON-AI — manuellement ou automatiquement — apparaissent dans l'Historique.",
          en: "Yes, all posts published via AXON-AI — manually or automatically — appear in History.",
        },
      },
      {
        q: { fr: "Combien de temps les données sont-elles conservées ?", en: "How long is data retained?" },
        a: {
          fr: "L'historique est conservé indéfiniment dans votre compte, jusqu'à suppression manuelle d'une entrée.",
          en: "History is kept indefinitely in your account, until you manually delete an entry.",
        },
      },
    ],
    related: [
      { label: { fr: "Analytics", en: "Analytics" }, href: "/analytics" },
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
      { label: { fr: "Composer un post", en: "Compose a post" }, href: "/compose" },
    ],
  },

  // ── /campaigns ──────────────────────────────────────────────────────────────
  "/campaigns": {
    title: {
      fr: "Campagnes",
      en: "Campaigns",
    },
    tagline: {
      fr: "Pilotez vos campagnes multi-canaux de bout en bout.",
      en: "Manage your multi-channel campaigns end to end.",
    },
    whatFor: {
      fr: "Une campagne regroupe des publicités Meta (Facebook/Instagram) et leurs ensembles de publicités autour d'un objectif commun. L'écran Campagnes offre une vue consolidée du budget et de l'avancement de chaque campagne active.",
      en: "A campaign groups Meta ads (Facebook/Instagram) and their ad sets around a common objective. The Campaigns screen offers a consolidated view of budget and progress for each active campaign.",
    },
    actions: [
      {
        label: { fr: "Créer une campagne", en: "Create a campaign" },
        detail: {
          fr: "Définissez un nom, des dates de début et de fin, un objectif (notoriété, trafic, conversion) et la marque concernée — une campagne appartient à une seule marque. Un « Brouillon local » permet une création simplifiée hors Meta, non publiée.",
          en: "Define a name, start and end dates, an objective (awareness, traffic, conversion) and the relevant brand — a campaign belongs to a single brand. A 'Local draft' allows a simplified creation outside Meta, not published.",
        },
      },
      {
        label: { fr: "Suivre la progression", en: "Track progress" },
        detail: {
          fr: "La jauge de progression indique le budget dépensé par rapport au budget alloué à la campagne.",
          en: "The progress gauge shows the budget spent against the campaign's allocated budget.",
        },
      },
      {
        label: { fr: "Ajouter un ensemble de publicités", en: "Add an ad set" },
        detail: {
          fr: "Depuis la fiche campagne, créez un nouvel ensemble de publicités (audience, budget, placements) rattaché à la campagne.",
          en: "From the campaign card, create a new ad set (audience, budget, placements) linked to the campaign.",
        },
      },
      {
        label: { fr: "Mettre en pause ou supprimer une campagne", en: "Pause or delete a campaign" },
        detail: {
          fr: "Le bouton bascule Actif/En pause arrête la diffusion sans perdre les données. La suppression est définitive et irréversible.",
          en: "The Active/Paused toggle stops delivery without losing data. Deletion is permanent and cannot be undone.",
        },
      },
    ],
    tips: [
      {
        fr: "Nommez vos campagnes selon une convention normalisée (ex. : MARQUE_OBJECTIF_TRIM) pour faciliter les comparaisons d'une année à l'autre.",
        en: "Name your campaigns using a standardised convention (e.g. BRAND_OBJECTIVE_QTR) to facilitate year-on-year comparisons.",
      },
      {
        fr: "Définissez les Audiences en amont, puis réutilisez-les dans toutes les publicités de la campagne pour garantir la cohérence du ciblage.",
        en: "Define Audiences upfront, then reuse them across all campaign ads to ensure targeting consistency.",
      },
    ],
    faq: [
      {
        q: { fr: "Peut-on associer une campagne à plusieurs marques ?", en: "Can a campaign be associated with multiple brands?" },
        a: {
          fr: "Non, chaque campagne appartient à une seule marque (celle sélectionnée dans l'application).",
          en: "No, each campaign belongs to a single brand (the one currently selected in the app).",
        },
      },
      {
        q: { fr: "Où voir le détail d'une publicité liée à une campagne ?", en: "Where to see the detail of an ad linked to a campaign?" },
        a: {
          fr: "Depuis la fiche campagne, ouvrez l'ensemble de publicités concerné, ou consultez Performances publicitaires pour la vue par publicité.",
          en: "From the campaign card, open the relevant ad set, or check Ad performance for the per-ad view.",
        },
      },
    ],
    related: [
      { label: { fr: "Performances publicitaires", en: "Ad performance" }, href: "/ad-performance" },
      { label: { fr: "Audiences", en: "Audiences" }, href: "/audiences" },
      { label: { fr: "Analytics", en: "Analytics" }, href: "/analytics" },
    ],
  },

  // ── /audiences ──────────────────────────────────────────────────────────────
  "/audiences": {
    title: {
      fr: "Audiences",
      en: "Audiences",
    },
    tagline: {
      fr: "Définissez et gérez les segments cibles de vos communications.",
      en: "Define and manage target segments for your communications.",
    },
    whatFor: {
      fr: "L'écran Audiences vous permet de créer des segments réutilisables à partir de critères démographiques, comportementaux ou de listes personnalisées. Ces segments sont ensuite utilisables dans les campagnes publicitaires Meta (Facebook Ads). L'indicateur de taille estimée donne un ordre de grandeur avant de lancer une campagne.",
      en: "The Audiences screen lets you create reusable segments based on demographic, behavioural or custom list criteria. These segments can then be used in Meta ad campaigns (Facebook Ads). The estimated size indicator gives a rough figure before launching a campaign.",
    },
    actions: [
      {
        label: { fr: "Créer un segment", en: "Create a segment" },
        detail: {
          fr: "Cliquez sur « Nouvelle audience », nommez le segment, choisissez les critères (âge, profession, intérêts, géographie, comportements) et sauvegardez. Le segment est immédiatement disponible dans Composer et Campagnes.",
          en: "Click 'New audience', name the segment, choose criteria (age, profession, interests, geography, behaviours) and save. The segment is immediately available in Composer and Campaigns.",
        },
      },
      {
        label: { fr: "Importer une liste personnalisée", en: "Import a custom list" },
        detail: {
          fr: "Téléversez un fichier CSV d'adresses e-mail ou d'identifiants pour créer une audience « Custom ». La liste est hachée avant envoi aux plateformes pour respecter la conformité RGPD.",
          en: "Upload a CSV file of email addresses or identifiers to create a 'Custom' audience. The list is hashed before sending to platforms to ensure GDPR compliance.",
        },
      },
      {
        label: { fr: "Créer une audience Lookalike", en: "Create a Lookalike audience" },
        detail: {
          fr: "À partir d'une audience Custom existante, générez un segment Lookalike pour toucher de nouveaux profils similaires à vos meilleurs clients. Sélectionnez le pourcentage de similarité (1 à 10 %).",
          en: "From an existing Custom audience, generate a Lookalike segment to reach new profiles similar to your best customers. Select the similarity percentage (1 to 10%).",
        },
      },
      {
        label: { fr: "Analyser la taille estimée", en: "Analyse estimated size" },
        detail: {
          fr: "L'indicateur de taille estimée vous donne un ordre de grandeur de l'audience potentielle avant de lancer une campagne payante. Une audience ni trop étroite ni trop large facilite généralement la diffusion — ajustez selon la taille affichée.",
          en: "The estimated size indicator gives a rough figure for the potential audience before launching a paid campaign. An audience that's neither too narrow nor too broad generally helps delivery — adjust based on the displayed size.",
        },
      },
      {
        label: { fr: "Modifier ou supprimer un segment", en: "Edit or delete a segment" },
        detail: {
          fr: "Cliquez sur un segment pour modifier ses critères. La suppression est irréversible — assurez-vous qu'aucune campagne active n'utilise ce segment avant de le supprimer.",
          en: "Click a segment to modify its criteria. Deletion is irreversible — make sure no active campaign uses this segment before deleting.",
        },
      },
    ],
    tips: [
      {
        fr: "Les audiences Lookalike (1–2 %) offrent généralement le meilleur compromis entre précision et volume pour les secteurs B2B.",
        en: "Lookalike audiences (1–2%) generally offer the best precision/volume trade-off for B2B sectors.",
      },
      {
        fr: "Vérifiez systématiquement les restrictions de ciblage propres à Facebook (catégories « sensibles » : santé, finance) avant de lancer une publicité.",
        en: "Always check Facebook's targeting restrictions for 'sensitive' categories (health, finance) before launching an ad.",
      },
    ],
    faq: [
      {
        q: { fr: "Les audiences sont-elles partagées entre marques ?", en: "Are audiences shared between brands?" },
        a: {
          fr: "Non, chaque marque dispose de ses propres audiences. Si une liste est pertinente pour plusieurs marques, importez-la individuellement pour chacune.",
          en: "No, each brand has its own audiences. If a list is relevant for multiple brands, import it individually for each one.",
        },
      },
      {
        q: { fr: "Comment la liste CSV est-elle protégée ?", en: "How is the CSV list protected?" },
        a: {
          fr: "Les e-mails/numéros sont hachés localement dans votre navigateur avant tout envoi à Meta. La liste brute ne quitte jamais votre navigateur.",
          en: "Emails/numbers are hashed locally in your browser before being sent to Meta. The raw list never leaves your browser.",
        },
      },
    ],
    related: [
      { label: { fr: "Campagnes", en: "Campaigns" }, href: "/campaigns" },
      { label: { fr: "Performances publicitaires", en: "Ad performance" }, href: "/ad-performance" },
      { label: { fr: "Composer un post", en: "Compose a post" }, href: "/compose" },
    ],
  },

  // ── /ad-performance ─────────────────────────────────────────────────────────
  "/ad-performance": {
    title: {
      fr: "Performances publicitaires",
      en: "Ad performance",
    },
    tagline: {
      fr: "Mesurez le ROI de vos campagnes payantes en temps réel.",
      en: "Measure the ROI of your paid campaigns in real time.",
    },
    whatFor: {
      fr: "Cet écran affiche la performance de vos publicités Meta (Facebook et Instagram) : dépenses, impressions, clics, conversions et CPC moyen, avec un graphique dans le temps et un tableau détaillé par publicité. Dès qu'un compte publicitaire Meta est connecté, les chiffres sont réels (bandeau vert « Réel · Meta ») ; sinon, ils sont estimés à partir du budget des campagnes (bandeau orange « Estimation · démo »). Deux modules IA complètent l'écran : le Cerveau Pub, qui analyse la performance réelle et la mémoire stratégique pour proposer une analyse et des recommandations, et le Pilote Pub, qui suggère des actions concrètes (pause, ajustement de budget, réactivation) à valider une par une.",
      en: "This screen shows your Meta ad performance (Facebook and Instagram): spend, impressions, clicks, conversions and average CPC, with a chart over time and a detailed per-ad table. As soon as a Meta ad account is connected, figures are real (green 'Real · Meta' banner); otherwise they are estimated from campaign budgets (amber 'Estimate · demo' banner). Two AI modules complete the screen: the Ad Brain, which analyses real performance and strategic memory to propose an analysis and recommendations, and the Ad Pilot, which suggests concrete actions (pause, budget adjustment, reactivation) to approve one by one.",
    },
    actions: [
      {
        label: { fr: "Connecter un compte publicitaire Meta", en: "Connect a Meta ad account" },
        detail: {
          fr: "Le panneau en haut de page liste vos comptes publicitaires Meta et permet d'en sélectionner un. C'est la condition pour passer des chiffres estimés aux chiffres réels.",
          en: "The panel at the top of the page lists your Meta ad accounts and lets you select one. This is what switches the screen from estimated to real figures.",
        },
      },
      {
        label: { fr: "Lancer le Cerveau Pub", en: "Run the Ad Brain" },
        detail: {
          fr: "Le bouton « Analyser la performance » combine vos chiffres réels, la mémoire stratégique (veille, pubs concurrentes, Page) et votre profil de marque pour produire un diagnostic, ce qui marche/à corriger, des pistes de budget et de créatifs — et, dès qu'assez de mesures existent, la campagne que le moteur d'apprentissage juge la plus prometteuse.",
          en: "The 'Analyze performance' button combines your real figures, strategic memory (competitor watch, ads, Page) and brand profile into a diagnostic, what works/what to fix, budget and creative angles — and, once enough measurements exist, the campaign the learning engine considers most promising.",
        },
      },
      {
        label: { fr: "Suivre les suggestions du Pilote Pub", en: "Follow the Ad Pilot's suggestions" },
        detail: {
          fr: "Chaque action proposée (pause, hausse/baisse de budget, réactivation) est étiquetée « sûre » ou « dépense » et s'applique individuellement d'un clic — rien n'est jamais changé automatiquement sur votre compte publicitaire.",
          en: "Each suggested action (pause, budget increase/decrease, reactivation) is tagged 'safe' or 'spend' and applies individually with one click — nothing is ever changed automatically on your ad account.",
        },
      },
      {
        label: { fr: "Sélectionner la période d'analyse", en: "Select the analysis period" },
        detail: {
          fr: "Le sélecteur de dates permet de choisir n'importe quelle plage : 7 derniers jours, 30 jours, 90 jours, l'année écoulée, tout le temps, ou une plage personnalisée. Toutes les métriques et le graphique se recalculent.",
          en: "The date picker lets you choose any range: last 7 days, 30 days, 90 days, last year, all time, or a custom range. All metrics and the chart recalculate.",
        },
      },
      {
        label: { fr: "Filtrer et trier le tableau des publicités", en: "Filter and sort the ads table" },
        detail: {
          fr: "Recherchez par nom, filtrez par campagne, par plateforme (Facebook/Instagram) ou par statut (actif/en pause), et triez les colonnes Dépenses, CTR, CPC ou Conversions.",
          en: "Search by name, filter by campaign, platform (Facebook/Instagram) or status (active/paused), and sort the Spend, CTR, CPC or Conversions columns.",
        },
      },
      {
        label: { fr: "Exporter les données", en: "Export the data" },
        detail: {
          fr: "Le bouton « Exporter » télécharge le tableau de publicités affiché au format CSV ou JSON.",
          en: "The 'Export' button downloads the displayed ads table as CSV or JSON.",
        },
      },
    ],
    tips: [
      {
        fr: "L'insight IA en bas de page (meilleure publicité par coût de conversion) porte toujours l'étiquette « estimation », même quand le reste de l'écran affiche des données réelles.",
        en: "The AI insight at the bottom of the page (best ad by cost per conversion) always carries the 'estimate' tag, even when the rest of the screen shows real data.",
      },
      {
        fr: "Le Cerveau Pub et le Pilote Pub sont complémentaires : le premier explique le « pourquoi », le second propose le « quoi faire » — consultez les deux avant de changer un budget.",
        en: "The Ad Brain and the Ad Pilot are complementary: the first explains the 'why', the second proposes the 'what to do' — check both before changing a budget.",
      },
      {
        fr: "Cliquez une carte-métrique (Dépenses, Impressions…) pour isoler sa courbe dans le graphique ; cliquez-la à nouveau pour revenir à la vue par défaut.",
        en: "Click a metric card (Spend, Impressions…) to isolate its curve in the chart; click it again to return to the default view.",
      },
    ],
    faq: [
      {
        q: { fr: "Les données sont-elles actualisées en temps réel ?", en: "Is the data updated in real time?" },
        a: {
          fr: "Dès qu'un compte Meta est connecté, l'écran interroge l'API Marketing à chaque changement de période — il n'y a pas de délai fixe. Sans compte connecté, les chiffres affichés sont une estimation basée sur le budget des campagnes, pas des données publicitaires réelles.",
          en: "Once a Meta account is connected, the screen queries the Marketing API on every period change — there is no fixed delay. Without a connected account, the figures shown are an estimate based on campaign budgets, not real ad data.",
        },
      },
      {
        q: { fr: "Le Pilote Pub applique-t-il les actions tout seul ?", en: "Does the Ad Pilot apply actions on its own?" },
        a: {
          fr: "Non. Chaque action proposée doit être validée individuellement ; rien n'est modifié sur votre compte publicitaire sans ce clic.",
          en: "No. Each suggested action must be approved individually; nothing changes on your ad account without that click.",
        },
      },
      {
        q: { fr: "Pourquoi je ne vois pas LinkedIn Ads ici ?", en: "Why don't I see LinkedIn Ads here?" },
        a: {
          fr: "Cet écran couvre aujourd'hui Facebook et Instagram Ads (Meta). LinkedIn n'y est pas encore intégré.",
          en: "This screen currently covers Facebook and Instagram Ads (Meta). LinkedIn is not yet integrated here.",
        },
      },
    ],
    related: [
      { label: { fr: "Campagnes", en: "Campaigns" }, href: "/campaigns" },
      { label: { fr: "Analytics", en: "Analytics" }, href: "/analytics" },
      { label: { fr: "Audiences", en: "Audiences" }, href: "/audiences" },
    ],
  },

  // ── /analytics ──────────────────────────────────────────────────────────────
  "/analytics": {
    title: {
      fr: "Analytics",
      en: "Analytics",
    },
    tagline: {
      fr: "Analysez en profondeur la performance organique de vos marques.",
      en: "Deep-dive into the organic performance of your brands.",
    },
    whatFor: {
      fr: "L'écran Analytics offre des graphiques sur l'évolution des publications, de l'engagement et — dès qu'un compte publicitaire est connecté — des dépenses et conversions payantes, pour chaque marque. Deux graphiques comparent l'engagement par entreprise et par plateforme (Facebook, Instagram ; LinkedIn affiché comme « non mesuré »).",
      en: "The Analytics screen shows charts on the evolution of posts, engagement and — once an ad account is connected — paid spend and conversions, for each brand. Two charts compare engagement by company and by platform (Facebook, Instagram; LinkedIn shown as 'not measured').",
    },
    actions: [
      {
        label: { fr: "Choisir la période", en: "Choose the period" },
        detail: {
          fr: "Choisissez une plage de dates (7 jours, 30 jours, 90 jours, 1 an ou période personnalisée) ; les données restent au jour le jour.",
          en: "Choose a date range (7 days, 30 days, 90 days, 1 year or custom); data stays daily.",
        },
      },
      {
        label: { fr: "Suivre la variation automatique", en: "Track the automatic comparison" },
        detail: {
          fr: "Chaque carte-métrique affiche automatiquement sa variation (%) par rapport à la période précédente de même durée.",
          en: "Each metric card automatically shows its variation (%) versus the previous period of equal length.",
        },
      },
      {
        label: { fr: "Filtrer par marque", en: "Filter by brand" },
        detail: {
          fr: "Le sélecteur « Portée » limite tous les graphiques à une marque ; cliquer sur Facebook, Instagram ou LinkedIn dans « Performance par plateforme » vous redirige vers l'écran dédié à ce réseau.",
          en: "The 'Scope' selector limits all charts to one brand; clicking Facebook, Instagram or LinkedIn in 'Performance by platform' takes you to that network's dedicated screen.",
        },
      },
      {
        label: { fr: "Comparer par entreprise et par réseau", en: "Compare by company and network" },
        detail: {
          fr: "Deux graphiques à barres classent l'engagement par entreprise et par plateforme.",
          en: "Two bar charts rank engagement by company and by platform.",
        },
      },
      {
        label: { fr: "Exporter les données", en: "Export the data" },
        detail: {
          fr: "Exportez les données de la période en CSV ou JSON.",
          en: "Export the period's data as CSV or JSON.",
        },
      },
    ],
    tips: [],
    faq: [
      {
        q: { fr: "Les analytics incluent-ils les données payantes ?", en: "Do analytics include paid data?" },
        a: {
          fr: "Pas seulement les données organiques : les cartes « Dépenses pub. » et « Conversions » proviennent aussi du compte publicitaire connecté, quand il existe.",
          en: "Not organic-only: the 'Ad spend' and 'Conversions' cards also come from the connected ad account, when one exists.",
        },
      },
      {
        q: { fr: "À quelle fréquence les données sont-elles mises à jour ?", en: "How often is data updated?" },
        a: {
          fr: "Les données sont mises en cache 5 minutes puis rechargées automatiquement à chaque changement de marque ou de période.",
          en: "Data is cached for 5 minutes and reloads automatically whenever you change brand or period.",
        },
      },
    ],
    related: [
      { label: { fr: "Tableau de bord", en: "Dashboard" }, href: "/dashboard" },
      { label: { fr: "Performances publicitaires", en: "Ad performance" }, href: "/ad-performance" },
      { label: { fr: "Historique", en: "History" }, href: "/history" },
    ],
  },

  // ── /accounts ───────────────────────────────────────────────────────────────
  "/accounts": {
    title: {
      fr: "Comptes connectés",
      en: "Connected accounts",
    },
    tagline: {
      fr: "Gérez les connexions aux réseaux sociaux de vos marques.",
      en: "Manage social network connections for your brands.",
    },
    whatFor: {
      fr: "L'écran Comptes présente une carte par réseau (Facebook, Instagram, LinkedIn, TikTok) avec un bouton « Connecter » qui lance un assistant guidé. Le statut de chaque réseau est visible en temps réel : « Connecté ✓ » ou « Non connecté ».",
      en: "The Accounts screen shows one card per network (Facebook, Instagram, LinkedIn, TikTok) with a 'Connect' button that launches a guided assistant. Each network's status is visible in real time: 'Connected ✓' or 'Not connected'.",
    },
    actions: [
      {
        label: { fr: "Connecter un compte", en: "Connect an account" },
        detail: {
          fr: "Cliquez sur « Connecter » sur la carte du réseau souhaité et suivez les étapes de l'assistant guidé — aucun token à copier. La connexion Meta (via Facebook) couvre Facebook ET Instagram en un seul clic.",
          en: "Click 'Connect' on the card for the network you want and follow the guided assistant's steps — no token to copy. The Meta connection (via Facebook) covers both Facebook AND Instagram in one click.",
        },
      },
      {
        label: { fr: "Reconnecter un compte", en: "Reconnect an account" },
        detail: {
          fr: "Le bouton « Reconnecter » (affiché dès qu'un réseau est connecté) relance l'assistant guidé pour rafraîchir la connexion.",
          en: "The 'Reconnect' button (shown as soon as a network is connected) reopens the guided assistant to refresh the connection.",
        },
      },
      {
        label: { fr: "Révoquer un accès", en: "Revoke access" },
        detail: {
          fr: "Le bouton « Déconnecter » supprime le token d'accès côté AXON-AI. Pensez également à révoquer les permissions depuis les paramètres de la plateforme concernée.",
          en: "The 'Disconnect' button removes the access token on the AXON-AI side. Also remember to revoke permissions from the settings of the relevant platform.",
        },
      },
    ],
    tips: [
      {
        fr: "Les tokens Facebook et Instagram expirent tous les 60 jours — programmez un rappel mensuel pour les renouveler avant qu'ils n'impactent vos publications.",
        en: "Facebook and Instagram tokens expire every 60 days — schedule a monthly reminder to renew them before they impact your publications.",
      },
      {
        fr: "Si le statut Facebook/Instagram reste « En attente » après connexion, c'est qu'aucune Page n'est encore associée : rendez-vous sur Mes Pages pour la choisir.",
        en: "If the Facebook/Instagram status stays 'Pending' after connecting, no Page is linked yet: go to My Pages to pick one.",
      },
    ],
    faq: [
      {
        q: { fr: "Quelle différence entre /accounts et /parametres-connecteurs ?", en: "What is the difference between /accounts and /parametres-connecteurs?" },
        a: {
          fr: "/accounts gère les connexions OAuth aux comptes sociaux (flux d'authentification). /parametres-connecteurs gère la configuration des APIs et tokens pour toutes les intégrations (social + ads + IA + mesure).",
          en: "/accounts manages OAuth connections to social accounts (authentication flow). /parametres-connecteurs manages API and token configuration for all integrations (social + ads + AI + measurement).",
        },
      },
      {
        q: { fr: "Un compte peut-il être lié à plusieurs marques ?", en: "Can one account be linked to multiple brands?" },
        a: {
          fr: "Non, chaque compte social est rattaché à une seule marque dans AXON-AI. Pour partager un compte entre marques, contactez votre administrateur.",
          en: "No, each social account is attached to a single brand in AXON-AI. To share an account across brands, contact your administrator.",
        },
      },
    ],
    related: [
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
      { label: { fr: "Mes Pages", en: "My Pages" }, href: "/pages-meta" },
      { label: { fr: "Paramètres", en: "Settings" }, href: "/settings" },
    ],
  },

  // ── /settings ───────────────────────────────────────────────────────────────
  "/settings": {
    title: {
      fr: "Paramètres",
      en: "Settings",
    },
    tagline: {
      fr: "Configurez AXON-AI selon les besoins de votre organisation.",
      en: "Configure AXON-AI to match your organisation's needs.",
    },
    whatFor: {
      fr: "Les paramètres sont organisés en trois groupes : Compte (Profil, Notifications), Organisation (Organisation, Entreprises, Équipe & rôles) et Plateforme (Préférences IA, Sécurité publicitaire, Journal d'audit). Chaque section a sa propre portée : certaines s'appliquent à l'ensemble de l'organisation, d'autres à la société active.",
      en: "Settings are organised into three groups: Account (Profile, Notifications), Organization (Organization, Companies, Team & roles) and Platform (AI preferences, Ad Safety, Audit log). Each section has its own scope: some apply to the whole organisation, others to the active company.",
    },
    actions: [
      {
        label: { fr: "Configurer les notifications", en: "Configure notifications" },
        detail: {
          fr: "Activez ou non l'e-mail et l'in-app pour chaque type d'événement (récapitulatif de dépenses, résumé hebdomadaire, bibliothèque basse, publication échouée, anomalie publicitaire, nouveau membre, synchronisation d'audience), avec une fréquence globale et des heures calmes.",
          en: "Turn email and in-app on or off for each event type (spend digest, weekly summary, low library, failed post, ad anomaly, new team member, audience sync), with a global frequency and quiet hours.",
        },
      },
      {
        label: { fr: "Gérer l'organisation", en: "Manage the organization" },
        detail: {
          fr: "Renommez l'organisation, indiquez son secteur d'activité, et consultez en un coup d'œil le nombre d'entreprises et de membres d'équipe. Un aperçu « Abonnement & facturation » y figure également.",
          en: "Rename the organisation, set its industry, and see the number of companies and team members at a glance. A 'Subscription & billing' overview is also shown there.",
        },
      },
      {
        label: { fr: "Gérer les entreprises", en: "Manage companies" },
        detail: {
          fr: "Ajoutez ou modifiez une entreprise : heure de publication par défaut, et activation du workflow de validation (les publications programmées par un membre passent alors « À valider » avant de partir).",
          en: "Add or edit a company: default posting time, and enabling the approval workflow (posts scheduled by a member then go 'To approve' before going out).",
        },
      },
      {
        label: { fr: "Gérer l'équipe et les rôles", en: "Manage the team and roles" },
        detail: {
          fr: "Invitez des collaborateurs par e-mail et assignez un rôle : Administrateur (accès total), Éditeur (composer et programmer) ou Lecteur (consultation seule), avec un accès limitable à certaines entreprises.",
          en: "Invite collaborators by email and assign a role: Administrator (full access), Editor (compose and schedule) or Viewer (view-only), with access that can be limited to specific companies.",
        },
      },
      {
        label: { fr: "Consulter le journal d'audit", en: "View the audit log" },
        detail: {
          fr: "Filtrez les actions par type (Publications, Campagnes, Audiences, Sécurité pub., Équipe, Paramètres), par utilisateur, par société ou par période, et exportez le résultat en CSV ou JSON.",
          en: "Filter actions by type (Posts, Campaigns, Audiences, Ad Safety, Team, Settings), by user, by company or by period, and export the result as CSV or JSON.",
        },
      },
    ],
    tips: [
      {
        fr: "Le bouton « Changer d'offre » de l'aperçu Abonnement & facturation est désactivé : la gestion de la facturation n'est pas encore active (prévue pour une prochaine phase), toutes les sociétés sont en essai gratuit.",
        en: "The 'Upgrade plan' button in the Subscription & billing overview is disabled: billing management is not active yet (planned for a future phase) — every company is on the free trial.",
      },
      {
        fr: "Entreprises, Préférences IA et Sécurité publicitaire se règlent par société active ; Profil, Notifications, Organisation, Équipe et Journal d'audit s'appliquent à tout le compte.",
        en: "Companies, AI preferences and Ad Safety are set per active company; Profile, Notifications, Organization, Team and Audit log apply to the whole account.",
      },
    ],
    faq: [
      {
        q: { fr: "Comment activer le workflow de validation des publications ?", en: "How do I enable the post approval workflow?" },
        a: {
          fr: "Dans Entreprises, ouvrez la société concernée et activez « Workflow de validation ». Les publications programmées par un membre (non owner/admin) passeront alors par l'onglet « À valider » de Publications programmées.",
          en: "In Companies, open the relevant company and enable 'Approval workflow'. Posts scheduled by a member (non owner/admin) will then go through the 'To approve' tab in Scheduled posts.",
        },
      },
      {
        q: { fr: "Comment révoquer l'accès d'un collaborateur ?", en: "How to revoke a collaborator's access?" },
        a: {
          fr: "Dans Équipe & rôles, retrouvez le collaborateur et retirez son accès depuis sa fiche.",
          en: "In Team & roles, find the collaborator and remove their access from their profile.",
        },
      },
    ],
    related: [
      { label: { fr: "Comptes connectés", en: "Connected accounts" }, href: "/accounts" },
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
      { label: { fr: "Publications programmées", en: "Scheduled posts" }, href: "/scheduled" },
    ],
  },

  // ── /demarrage ──────────────────────────────────────────────────────────────
  "/demarrage": {
    title: { fr: "Démarrage assisté", en: "Assisted onboarding" },
    tagline: {
      fr: "Votre parcours pas-à-pas pour devenir totalement autonome.",
      en: "Your step-by-step path to becoming fully autonomous.",
    },
    whatFor: {
      fr: "Le démarrage assisté est un parcours guidé en 6 étapes, sur une seule page, où l'IA fait le travail et vous propose une suggestion à chaque étape : 1. Mon identité — 2. Mes objectifs — 3. Concurrence & mots-clés — 4. Création des visuels — 5. Lancer les agents IA — 6. Diffusion & pilotage. Pour une marque tout juste créée et jamais analysée, une étape 0 optionnelle démarre d'abord : une conversation avec un consultant de marque IA qui construit et verrouille votre identité (philosophie, ton, univers visuel) avant d'entamer le parcours en 6 étapes. Une barre de progression indique simplement l'étape où vous êtes (par exemple 3 sur 6).",
      en: "Assisted onboarding is a guided 6-step journey, all on one page, where the AI does the work and offers a suggestion at each step: 1. My identity — 2. My objectives — 3. Competition & keywords — 4. Creative assets — 5. Launch AI agents — 6. Distribution & piloting. For a brand-new company that has never been analysed, an optional step 0 comes first: a conversation with an AI brand consultant who builds and locks your identity (philosophy, tone, visual world) before starting the 6-step journey. A progress bar simply shows which step you're on (e.g. 3 of 6).",
    },
    actions: [
      {
        label: { fr: "Suivre les étapes dans l'ordre", en: "Follow the steps in order" },
        detail: {
          fr: "Le rail en haut de page affiche les 6 étapes sous forme de cercles numérotés cliquables : le cercle de l'étape en cours est mis en avant, les étapes déjà accomplies passent en vert. Vous restez sur la même page — le contenu de l'étape s'affiche au centre, sans ouvrir d'autre page. Utilisez « Continuer » pour avancer, « Retour » pour revenir en arrière, ou cliquez directement sur un cercle pour sauter à une étape.",
          en: "The rail at the top of the page shows the 6 steps as clickable numbered circles: the current step's circle is highlighted, completed steps turn green. You stay on the same page — the step's content is shown in the centre, without opening another page. Use “Continue” to move forward, “Back” to go back, or click a circle directly to jump to a step.",
        },
      },
      {
        label: { fr: "Démarrer avec le consultant de marque (étape 0)", en: "Start with the brand consultant (step 0)" },
        detail: {
          fr: "Si votre marque n'a jamais été analysée, le parcours s'ouvre sur une conversation avec le consultant de marque IA. Cette étape est facultative : le bouton « Construire l'identité plus tard » saute directement à l'étape 1.",
          en: "If your brand has never been analysed, the journey opens with a conversation with the AI brand consultant. This step is optional: the “Build the identity later” button skips straight to step 1.",
        },
      },
      {
        label: { fr: "Suivre votre progression", en: "Track your progress" },
        detail: {
          fr: "La barre de progression sous le rail avance selon l'étape où vous êtes (par exemple 40 % à l'étape 3 sur 6). Elle ne dépend d'aucune connexion de réseau social ni de Telegram.",
          en: "The progress bar under the rail advances based on the step you're on (e.g. 40% at step 3 of 6). It has nothing to do with connected social networks or Telegram.",
        },
      },
    ],
    tips: [
      {
        fr: "N'oubliez pas de connecter vos réseaux à l'étape 1 (Mon identité) : sans réseaux connectés, les agents travaillent en mode estimation et ne peuvent pas publier réellement.",
        en: "Don't forget to connect your networks in step 1 (My identity): without connected networks, agents work in estimation mode and cannot publish for real.",
      },
      {
        fr: "Vous pouvez revenir sur cette page à tout moment via « Démarrage assisté » dans la barre latérale.",
        en: "You can return to this page anytime via 'Assisted onboarding' in the sidebar.",
      },
    ],
    faq: [
      {
        q: { fr: "Dois-je tout configurer d'un coup ?", en: "Do I have to set everything up at once?" },
        a: {
          fr: "Non. Vous pouvez avancer à votre rythme, sauter une étape avec « Passer cette étape » et y revenir plus tard — votre progression est sauvegardée automatiquement, sur tout appareil.",
          en: "No. You can move at your own pace, skip a step with “Skip this step” and come back to it later — your progress is saved automatically, on any device.",
        },
      },
    ],
    related: [
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
      { label: { fr: "Centre de pilotage", en: "Piloting center" }, href: "/pilotage" },
      { label: { fr: "Telegram", en: "Telegram" }, href: "/telegram" },
    ],
  },

  // ── /telegram ───────────────────────────────────────────────────────────────
  "/telegram": {
    title: { fr: "Chatbot Telegram", en: "Telegram Chatbot" },
    tagline: {
      fr: "Pilotez vos agents et campagnes depuis Telegram, jour et nuit.",
      en: "Pilot your agents and campaigns from Telegram, day and night.",
    },
    whatFor: {
      fr: "La connexion Telegram est quasi automatique : AXON-AI utilise UN bot central partagé par tous les comptes, vous n'avez aucun bot à créer. Vous cliquez sur « Ouvrir le bot & connecter », vous pressez Démarrer dans Telegram, et ce compte est relié grâce à un code de jumelage unique. Le bot devient alors un agent à part entière qui dialogue avec les autres : écrivez-lui en langage naturel pour lancer une campagne, demander une veille, fixer un objectif ou consulter l'état du compte — où que vous soyez, jour et nuit.",
      en: "Telegram connection is near-automatic: AXON-AI uses ONE central bot shared by all accounts, so you have no bot to create. You click “Open the bot & connect”, press Start in Telegram, and this account is linked via a unique pairing code. The bot then becomes a full agent that talks to the others: write to it in natural language to launch a campaign, request a market watch, set an objective or check account status — wherever you are, day and night.",
    },
    actions: [
      {
        label: { fr: "Se connecter en 1 clic", en: "Connect in 1 click" },
        detail: {
          fr: "Cliquez sur « Ouvrir le bot & connecter » : Telegram s'ouvre sur le bot AXON-AI. Pressez Démarrer / Start et le compte est relié automatiquement. La page se met à jour toute seule dès que c'est fait.",
          en: "Click “Open the bot & connect”: Telegram opens on the AXON-AI bot. Press Start and the account is linked automatically. The page updates itself as soon as it is done.",
        },
      },
      {
        label: { fr: "Connexion manuelle par code", en: "Manual connection by code" },
        detail: {
          fr: "Vous pouvez aussi chercher le bot dans Telegram et lui envoyer « /start <CODE> » avec le code affiché sur la page. Le résultat est identique.",
          en: "You can also search the bot in Telegram and send it “/start <CODE>” using the code shown on the page. The result is identical.",
        },
      },
      {
        label: { fr: "Piloter par message", en: "Pilot by message" },
        detail: {
          fr: "Une fois relié, utilisez /lancer, /veille, /objectif, /status, /aide — ou écrivez simplement votre demande en langage naturel.",
          en: "Once linked, use /lancer, /veille, /objectif, /status, /aide — or just write your request in natural language.",
        },
      },
      {
        label: { fr: "(Admin) Activer le bot central", en: "(Admin) Activate the central bot" },
        detail: {
          fr: "Si la connexion n'est pas encore disponible, l'administrateur doit ajouter TELEGRAM_BOT_TOKEN et TELEGRAM_BOT_USERNAME dans Vercel, redéployer, puis appeler une fois /api/telegram/bot/setup.",
          en: "If connection is not available yet, the administrator must add TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME in Vercel, redeploy, then call /api/telegram/bot/setup once.",
        },
      },
    ],
    tips: [
      {
        fr: "Commandes utiles : /lancer <objectif> démarre une orchestration, /veille lance une analyse concurrentielle, /status donne un résumé du compte.",
        en: "Useful commands: /lancer <objective> starts an orchestration, /veille launches a competitive analysis, /status gives an account summary.",
      },
      {
        fr: "Tout texte libre envoyé au bot est traité comme un /lancer — décrivez simplement ce que vous voulez.",
        en: "Any free text sent to the bot is treated as a /lancer — just describe what you want.",
      },
    ],
    faq: [
      {
        q: { fr: "Le bot fonctionne-t-il pour tous mes comptes ?", en: "Does the bot work for all my accounts?" },
        a: {
          fr: "Non, un seul bot Telegram central est partagé par tous les comptes. Sélectionnez d'abord le bon compte (en haut), puis reliez-le avec son propre code de jumelage sur cette page.",
          en: "No, a single central Telegram bot is shared across all accounts. First select the right account (top), then link it using its own pairing code on this page.",
        },
      },
      {
        q: { fr: "Que faire si le bouton reste indisponible ?", en: "What if the button stays unavailable?" },
        a: {
          fr: "Le bouton reste indisponible tant que l'administrateur n'a pas configuré le bot central (TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME dans Vercel, puis /api/telegram/bot/setup). Une fois cela fait, il s'active pour tous les comptes.",
          en: "The button stays unavailable until the administrator has configured the central bot (TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME in Vercel, then /api/telegram/bot/setup). Once done, it activates for every account.",
        },
      },
    ],
    related: [
      { label: { fr: "Démarrage assisté", en: "Assisted onboarding" }, href: "/demarrage" },
      { label: { fr: "Connecteur MCP", en: "MCP connector" }, href: "/mcp" },
      { label: { fr: "Centre de pilotage", en: "Piloting center" }, href: "/pilotage" },
    ],
  },

  // ── /mcp ────────────────────────────────────────────────────────────────────
  "/mcp": {
    title: { fr: "Connecteur MCP Claude", en: "Claude MCP Connector" },
    tagline: {
      fr: "Pilotez AXON-AI directement depuis Claude Desktop, en langage naturel.",
      en: "Pilot AXON-AI straight from Claude Desktop, in natural language.",
    },
    whatFor: {
      fr: "Le Model Context Protocol (MCP) permet à Claude d'utiliser des outils externes. Le connecteur AXON-AI expose vos comptes, agents et campagnes à Claude Desktop : vous demandez « lance une campagne pour la rentrée » et Claude exécute réellement l'action. L'installation est volontairement simple : 1) générez une clé API personnelle (liée à ce compte, révocable, stockée hachée) ; 2) lancez UNE commande dans le Terminal (Mac/Linux) ou PowerShell (Windows) — le script télécharge le serveur, installe le SDK et configure Claude Desktop tout seul ; 3) relancez Claude et testez. Aucune édition manuelle de fichier.",
      en: "The Model Context Protocol (MCP) lets Claude use external tools. The AXON-AI connector exposes your accounts, agents and campaigns to Claude Desktop: you ask “launch a back-to-school campaign” and Claude actually performs the action. Setup is deliberately simple: 1) generate a personal API key (bound to this account, revocable, stored hashed); 2) run ONE command in Terminal (Mac/Linux) or PowerShell (Windows) — the script downloads the server, installs the SDK and configures Claude Desktop on its own; 3) relaunch Claude and test. No manual file editing.",
    },
    actions: [
      {
        label: { fr: "Générer une clé API personnelle", en: "Generate a personal API key" },
        detail: {
          fr: "À l'étape 1, donnez un nom à votre clé et cliquez sur Créer. La clé en clair s'affiche UNE seule fois — copiez-la immédiatement. Elle est stockée hachée : personne ne peut la relire, et vous pouvez la révoquer à tout moment.",
          en: "In step 1, name your key and click Create. The plain key is shown ONCE — copy it immediately. It is stored hashed: nobody can read it back, and you can revoke it anytime.",
        },
      },
      {
        label: { fr: "Vérifier les pré-requis", en: "Check prerequisites" },
        detail: {
          fr: "Avant de lancer la commande, assurez-vous d'avoir Claude Desktop installé et Node.js 18+ (téléchargeable depuis nodejs.org, ou `brew install node` sur Mac).",
          en: "Before running the command, make sure Claude Desktop is installed and Node.js 18+ is available (download from nodejs.org, or `brew install node` on Mac).",
        },
      },
      {
        label: { fr: "Lancer la commande d'installation", en: "Run the install command" },
        detail: {
          fr: "Copiez la commande de votre système (macOS/Linux : curl … | bash ; Windows : iwr … | iex) et collez-la dans le terminal. Le script vous demandera l'URL et la clé que vous venez de générer.",
          en: "Copy the command for your system (macOS/Linux: curl … | bash ; Windows: iwr … | iex) and paste it into the terminal. The script will ask for the URL and the key you just generated.",
        },
      },
      {
        label: { fr: "Relancer et tester", en: "Relaunch and test" },
        detail: {
          fr: "Quittez complètement Claude Desktop puis relancez-le. Dans une nouvelle conversation, demandez « Liste mes comptes AXON-AI » : Claude répond via le connecteur.",
          en: "Quit Claude Desktop completely then relaunch it. In a new conversation, ask “List my AXON-AI accounts”: Claude answers through the connector.",
        },
      },
      {
        label: { fr: "Révoquer une clé", en: "Revoke a key" },
        detail: {
          fr: "Dans la liste des clés actives, cliquez sur l'icône corbeille pour révoquer immédiatement une clé compromise ou inutilisée. Le connecteur cesse aussitôt de fonctionner avec cette clé.",
          en: "In the active keys list, click the trash icon to immediately revoke a compromised or unused key. The connector stops working with that key at once.",
        },
      },
    ],
    tips: [
      {
        fr: "L'URL de votre espace est déjà insérée dans la configuration — vous n'avez qu'à corriger le chemin du fichier local.",
        en: "Your workspace URL is already inserted in the configuration — you only need to fix the local file path.",
      },
      {
        fr: "Vous pouvez brancher plusieurs serveurs MCP en parallèle (ex. GitHub) pour étendre les capacités de Claude.",
        en: "You can plug several MCP servers in parallel (e.g. GitHub) to extend Claude's capabilities.",
      },
    ],
    faq: [
      {
        q: { fr: "MCP est-il obligatoire ?", en: "Is MCP mandatory?" },
        a: {
          fr: "Non, c'est une option avancée. Vous pouvez tout piloter depuis l'interface web ou Telegram. MCP s'adresse à ceux qui veulent travailler depuis Claude Desktop.",
          en: "No, it is an advanced option. You can pilot everything from the web interface or Telegram. MCP is for those who want to work from Claude Desktop.",
        },
      },
      {
        q: { fr: "Mes actions via Claude sont-elles tracées ?", en: "Are my actions via Claude logged?" },
        a: {
          fr: "Oui. Chaque action effectuée via le connecteur MCP est enregistrée dans votre historique, comme une action réalisée depuis l'interface.",
          en: "Yes. Every action performed via the MCP connector is recorded in your history, like an action done from the interface.",
        },
      },
    ],
    related: [
      { label: { fr: "Telegram", en: "Telegram" }, href: "/telegram" },
      { label: { fr: "Démarrage assisté", en: "Assisted onboarding" }, href: "/demarrage" },
      { label: { fr: "Agents IA", en: "AI agents" }, href: "/agents" },
    ],
  },

  // ── /studio-video ───────────────────────────────────────────────────────────
  "/studio-video": {
    title: { fr: "Studio Créatif", en: "Creative Studio" },
    tagline: {
      fr: "Assemblez photos et vidéos en déclinaisons marketing professionnelles.",
      en: "Assemble photos and videos into professional marketing cuts.",
    },
    whatFor: {
      fr: "Le Studio Créatif assemble et markète automatiquement vos médias bruts — photos ET vidéos. Vous importez plusieurs fichiers (ou collez des URLs), choisissez ce que vous voulez en faire (carrousel, diaporama vidéo, collage, visuel unique, ré-édition ou montage vidéo, ou « Automatique »), puis l'IA produit un dispositif professionnel par réseau : assemblage au bon format (9:16, 1:1, 16:9), slides avec texte incrusté, accroche, sous-titres, textes à l'écran, ambiance musicale et rythme, instructions d'assemblage, légende prête à publier, hashtags, CTA et texte de couverture.",
      en: "The Creative Studio automatically assembles and markets your raw media — photos AND videos. You upload several files (or paste URLs), choose what to make (carousel, slideshow video, collage, single visual, video re-edit or montage, or “Automatic”), then the AI produces a professional kit per network: assembly in the right format (9:16, 1:1, 16:9), slides with burned-in text, hook, subtitles, on-screen text, music mood and pace, assembly instructions, a publish-ready caption, hashtags, CTA and cover text.",
    },
    actions: [
      {
        label: { fr: "Créer le média avec l'IA", en: "Create the media with AI" },
        detail: {
          fr: "Avant même d'importer un fichier, générez visuels, vidéos, musiques ou voix depuis quatre outils intégrés (Copilote, Réalisateur, Visuel, Musique & voix). Pour Facebook, Instagram et LinkedIn, les modèles vidéo proposés par défaut sont restreints aux mieux notés qualité/prix ; une case à cocher permet de débrider les modèles premium.",
          en: "Even before uploading a file, generate visuals, videos, music or voices from four built-in tools (Copilot, Director, Visual, Music & voice). For Facebook, Instagram and LinkedIn, the video models offered by default are restricted to the best quality/price options; a checkbox unlocks premium models.",
        },
      },
      {
        label: { fr: "Importer photos & vidéos", en: "Upload photos & videos" },
        detail: {
          fr: "Glissez-déposez plusieurs fichiers (JPG, PNG, MP4, MOV…) ou ajoutez des URLs. Mélangez images et vidéos : le studio s'adapte.",
          en: "Drag and drop several files (JPG, PNG, MP4, MOV…) or add URLs. Mix images and videos: the studio adapts.",
        },
      },
      {
        label: { fr: "Choisir l'assemblage", en: "Choose the assembly" },
        detail: {
          fr: "Carrousel, diaporama vidéo, collage, visuel unique, vidéo ou montage — ou « Automatique » pour laisser l'IA choisir le meilleur format par réseau (ex. : carrousel sur LinkedIn, diaporama sur TikTok).",
          en: "Carousel, slideshow video, collage, single visual, video or montage — or “Automatic” to let the AI pick the best format per network (e.g. carousel on LinkedIn, slideshow on TikTok).",
        },
      },
      {
        label: { fr: "Définir objectif & réseaux", en: "Set objective & networks" },
        detail: {
          fr: "Décrivez l'objectif et cochez un ou plusieurs des 13 formats de destination proposés — TikTok, Instagram Reels/Story/Feed/Portrait, Facebook/Facebook Portrait/Story/Paysage, YouTube Shorts/YouTube, LinkedIn 16:9/carré — chacun avec son ratio et sa durée maximale propres.",
          en: "Describe the objective and tick one or more of the 13 destination formats on offer — TikTok, Instagram Reels/Story/Feed/Portrait, Facebook/Facebook Portrait/Story/Landscape, YouTube Shorts/YouTube, LinkedIn 16:9/square — each with its own aspect ratio and maximum length.",
        },
      },
      {
        label: { fr: "Lancer le marketing automatique", en: "Run auto-marketing" },
        detail: {
          fr: "Cliquez sur « Assembler & marketer » : l'IA génère une carte par réseau avec accroches, sous-titres, montage, légende, hashtags et CTA — chaque champ reste modifiable avant le rendu final.",
          en: "Click “Assemble & market”: the AI generates one card per network with hooks, subtitles, edit notes, caption, hashtags and CTA — every field stays editable before the final render.",
        },
      },
      {
        label: { fr: "Récupérer les livrables", en: "Grab the deliverables" },
        detail: {
          fr: "Téléchargez les sous-titres .srt et copiez légendes, hashtags et textes de vignette en un clic pour publier ou transmettre à un monteur.",
          en: "Download the .srt subtitles and copy captions, hashtags and thumbnail texts in one click to publish or hand to an editor.",
        },
      },
      {
        label: { fr: "Diffuser directement depuis le studio", en: "Distribute straight from the studio" },
        detail: {
          fr: "Enregistrez le résultat dans la médiathèque, puis publiez-le ou programmez-le pour Facebook, Instagram ou LinkedIn — TikTok en est exclu (son API exige une application approuvée séparément ; le contenu généré pour TikTok se télécharge puis se publie depuis l'app TikTok). Le lien « Utiliser dans une pub Meta » redirige vers la création de campagne (/campaigns/new) avec le média et la légende pré-remplis — vous quittez le studio pour la finaliser.",
          en: "Save the result to the media library, then publish or schedule it for Facebook, Instagram or LinkedIn — TikTok is excluded (its API requires a separately-approved app; content generated for TikTok is downloaded then published from the TikTok app). The “Use in a Meta ad” link redirects to campaign creation (/campaigns/new) with the media and caption pre-filled — you leave the studio to finish it there.",
        },
      },
    ],
    tips: [
      {
        fr: "Une vidéo verticale filmée au smartphone suffit : le studio s'occupe du recadrage et du rythme.",
        en: "A vertical clip shot on a phone is enough: the studio handles reframing and pacing.",
      },
      {
        fr: "Pour un export vidéo entièrement automatique, un moteur de rendu doit être branché (clé SHOTSTACK_API_KEY). Sinon, vous obtenez le plan de montage complet à exécuter. Les formats statiques (carrousel/collage/visuel unique) passent par un pipeline séparé (Cloudinary), indépendant du rendu vidéo.",
        en: "For a fully automatic video export, a render engine must be connected (SHOTSTACK_API_KEY). Otherwise you get the complete edit plan to execute. Static formats (carousel/collage/single visual) go through a separate pipeline (Cloudinary), independent of the video render.",
      },
      {
        fr: "La bibliothèque musicale intégrée n'est qu'une sélection de DÉMONSTRATION (pistes SoundHelix), non libre de droits pour un usage commercial — remplacez-la par votre propre fichier ou une banque licenciée avant toute publication réelle.",
        en: "The built-in music library is a DEMO selection only (SoundHelix tracks), not royalty-free for commercial use — replace it with your own file or a licensed music library before any real publication.",
      },
      {
        fr: "Un panneau « Brand kit » persistant réutilise le logo et la charte graphique de la société sur les rendus. Le montage se réordonne par glisser-déposer ou par flèches, et un bouton « Réinitialiser » (avec confirmation) vide entièrement le projet en conservant le brand kit.",
        en: "A persistent “Brand kit” panel reuses the company's logo and colour palette on renders. The timeline reorders by drag-and-drop or arrows, and a “Reset” button (with a confirmation prompt) fully clears the project while keeping the brand kit.",
      },
    ],
    faq: [
      {
        q: { fr: "Le studio exporte-t-il la vidéo montée finale ?", en: "Does the studio export the final edited video?" },
        a: {
          fr: "Il produit le plan de montage professionnel complet (coupes, sous-titres .srt, overlays, specs par format). L'export automatique du fichier rendu nécessite un moteur de rendu branché.",
          en: "It produces the complete professional edit plan (cuts, .srt subtitles, overlays, per-format specs). Automatic export of the rendered file requires a connected render engine.",
        },
      },
    ],
    related: [
      { label: { fr: "Composer", en: "Compose" }, href: "/compose" },
      { label: { fr: "Médiathèque", en: "Media library" }, href: "/media" },
      { label: { fr: "Programmés", en: "Scheduled" }, href: "/scheduled" },
    ],
  },

  // ── /pages-meta ───────────────────────────────────────────────────────────
  "/pages-meta": {
    title: { fr: "Mes Pages & données", en: "My Pages & data" },
    tagline: { fr: "Vos Pages Meta connectées, leurs données et la publication", en: "Your connected Meta Pages, their data and publishing" },
    whatFor: {
      fr: "Le hub de chaque Page Facebook/Instagram connectée : choisir la Page à piloter, voir ses vraies données (abonnés, publications, engagement), publier (post normal ou publicité) et faire analyser sa stratégie par l'IA.",
      en: "The hub for each connected Facebook/Instagram Page: pick the Page to manage, see its real data (followers, posts, engagement), publish (normal post or ad) and get its strategy analysed by AI.",
    },
    actions: [
      { label: { fr: "Choisir la Page", en: "Pick the Page" }, detail: { fr: "Si votre compte gère plusieurs Pages, sélectionnez celle de cette société.", en: "If your account manages several Pages, select the one for this company." } },
      { label: { fr: "Publier (normal ou Ads)", en: "Publish (normal or Ads)" }, detail: { fr: "Onglet « Publication normale » pour un post gratuit à vos abonnés, « Publication via Ads » pour une publicité ciblée.", en: "“Normal post” tab for a free post to your followers, “Publish via Ads” for a targeted ad." } },
      { label: { fr: "Analyser la Page avec l'IA", en: "Analyze the Page with AI" }, detail: { fr: "L'IA lit vos contenus et leur engagement et recommande la suite (formats, cadence, idées, actions).", en: "The AI reads your content and engagement and recommends what's next (formats, cadence, ideas, actions)." } },
    ],
    tips: [
      { fr: "Connectez Meta depuis le Démarrage : un seul OAuth connecte Facebook ET Instagram.", en: "Connect Meta from the onboarding: a single OAuth connects both Facebook and Instagram." },
      { fr: "Pour publier sur Instagram, une image est obligatoire (le bouton « Générer un visuel » la fournit).", en: "To publish on Instagram an image is required (the “Generate a visual” button provides one)." },
    ],
    faq: [
      { q: { fr: "Mes publications partent-elles vraiment ?", en: "Are my posts really sent?" }, a: { fr: "Oui si la Page est connectée. Chaque publication réussie apparaît dans l'Historique. Sinon, l'app vous le dit clairement.", en: "Yes if the Page is connected. Each successful publish appears in History. Otherwise the app tells you clearly." } },
    ],
    related: [
      { label: { fr: "Espace LinkedIn", en: "LinkedIn space" }, href: "/linkedin" },
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
      { label: { fr: "Campagnes", en: "Campaigns" }, href: "/campaigns" },
    ],
  },

  // ── /linkedin ─────────────────────────────────────────────────────────────
  "/linkedin": {
    title: { fr: "Espace LinkedIn", en: "LinkedIn space" },
    tagline: { fr: "Votre compte LinkedIn : publier et affiner la stratégie", en: "Your LinkedIn account: publish and refine strategy" },
    whatFor: {
      fr: "L'espace dédié à LinkedIn, tout-en-un : voir le compte connecté, choisir où publier (votre profil ou une Page entreprise), rédiger un post court ou un article complet avec visuels générés par IA (mots-clés/texte → prompt éditable → article → visuels), le publier ou le programmer, gérer la file d'attente, et générer une stratégie de contenu LinkedIn.",
      en: "The dedicated, all-in-one LinkedIn space: see the connected account, choose where to publish (your profile or a company Page), write a short post or a full article with AI-generated visuals (keywords/text → editable prompt → article → visuals), publish or schedule it, manage the queue, and generate a LinkedIn content strategy.",
    },
    actions: [
      { label: { fr: "Connecter / reconnecter LinkedIn", en: "Connect / reconnect LinkedIn" }, detail: { fr: "Un clic lance l'OAuth LinkedIn ; la connexion est enregistrée pour cette société.", en: "One click starts the LinkedIn OAuth; the connection is saved for this company." } },
      { label: { fr: "Publier en tant que…", en: "Publish as…" }, detail: { fr: "Choisissez votre profil ou une Page entreprise (les Pages nécessitent l'accès « Community Management » de LinkedIn).", en: "Choose your profile or a company Page (Pages require LinkedIn's “Community Management” access)." } },
      { label: { fr: "① Générer le prompt d'un article", en: "① Generate an article prompt" }, detail: { fr: "À partir de mots-clés ou d'un texte, plus votre profil de marque, l'IA rédige un brief éditorial que vous pouvez ajuster.", en: "From keywords or text, plus your brand profile, the AI writes an editorial brief you can adjust." } },
      { label: { fr: "② Générer l'article et ses visuels", en: "② Generate the article and its visuals" }, detail: { fr: "Titre, accroche, corps structuré, points clés, hashtags et CTA, puis des visuels HD associés — le tout ajustable via un chatbot avant publication.", en: "Title, hook, structured body, key takeaways, hashtags and CTA, then associated HD visuals — all adjustable via a chatbot before publishing." } },
      { label: { fr: "Analyser ma stratégie", en: "Analyze my strategy" }, detail: { fr: "L'IA bâtit positionnement, cadence, piliers éditoriaux et idées de posts à partir de votre profil de marque.", en: "The AI builds positioning, cadence, content pillars and post ideas from your brand profile." } },
    ],
    tips: [
      { fr: "La génération de visuels d'article nécessite la clé Replicate (REPLICATE_API_TOKEN) côté serveur.", en: "Article visual generation requires the Replicate key (REPLICATE_API_TOKEN) server-side." },
      { fr: "Publier sur une Page entreprise demande l'activation du produit « Community Management » côté LinkedIn.", en: "Publishing on a company Page requires enabling the “Community Management” product on LinkedIn's side." },
    ],
    faq: [
      { q: { fr: "Pourquoi je ne vois que mon profil et pas mes Pages ?", en: "Why do I only see my profile and not my Pages?" }, a: { fr: "L'accès aux Pages entreprise est protégé par LinkedIn (produit Community Management, soumis à validation). Tant qu'il n'est pas accordé, seul le profil est disponible.", en: "Access to company Pages is gated by LinkedIn (Community Management product, review required). Until granted, only the profile is available." } },
      { q: { fr: "Faut-il LinkedIn connecté pour générer un article ?", en: "Do I need LinkedIn connected to generate an article?" }, a: { fr: "Non, la génération marche sans connexion. La connexion n'est requise que pour publier.", en: "No, generation works without a connection. A connection is only required to publish." } },
    ],
    related: [
      { label: { fr: "Mes Pages", en: "My Pages" }, href: "/pages-meta" },
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
      { label: { fr: "Composer", en: "Compose" }, href: "/compose" },
    ],
  },

  // ── /article-linkedin (page morte, fusionnée dans /linkedin) ────────────────
  "/article-linkedin": {
    title: { fr: "Article LinkedIn", en: "LinkedIn article" },
    tagline: { fr: "Cette page redirige désormais vers l'espace LinkedIn.", en: "This page now redirects to the LinkedIn space." },
    whatFor: {
      fr: "/article-linkedin redirige automatiquement vers l'Espace LinkedIn (/linkedin) : la génération d'article (① prompt → ② article + visuels) fait maintenant partie intégrante de cette page, plus besoin d'un écran séparé.",
      en: "/article-linkedin automatically redirects to the LinkedIn space (/linkedin): article generation (① prompt → ② article + visuals) is now built directly into that page, no separate screen needed.",
    },
    actions: [
      { label: { fr: "Aller à l'Espace LinkedIn", en: "Go to the LinkedIn space" }, detail: { fr: "Consultez l'aide de /linkedin pour le détail du flux de génération d'article.", en: "See the /linkedin help for the full article generation flow." } },
    ],
    tips: [],
    faq: [
      { q: { fr: "Où est passée la génération d'article LinkedIn ?", en: "Where did LinkedIn article generation go?" }, a: { fr: "Elle est désormais directement dans l'Espace LinkedIn (/linkedin) — il n'existe plus de page dédiée à l'article.", en: "It is now directly in the LinkedIn space (/linkedin) — there is no dedicated article page anymore." } },
    ],
    related: [
      { label: { fr: "Espace LinkedIn", en: "LinkedIn space" }, href: "/linkedin" },
    ],
  },

  // ── /inbox ────────────────────────────────────────────────────────────────
  "/inbox": {
    title: { fr: "Messagerie & agents", en: "Inbox & agents" },
    tagline: { fr: "Des agents qui répondent aux messages — et escaladent à un humain", en: "Agents that reply to messages — and escalate to a human" },
    whatFor: {
      fr: "Centralise les commentaires et messages privés de vos réseaux. Vous configurez des agents (un pour tout, ou un par canal) qui répondent dans la voix de la marque, en automatique ou en suggestion, et qui passent la main à un humain quand le sujet est sensible ou la confiance trop faible.",
      en: "Centralizes your social comments and private messages. You configure agents (one for everything, or one per channel) that reply in the brand voice, automatically or as a suggestion, and hand off to a human when a topic is sensitive or confidence is too low.",
    },
    actions: [
      { label: { fr: "Créer un agent", en: "Create an agent" }, detail: { fr: "Donnez-lui sa voix (persona), son périmètre, son autonomie et ses mots-clés d'escalade.", en: "Give it a voice (persona), scope, autonomy and escalation keywords." } },
      { label: { fr: "Synchroniser Meta", en: "Sync Meta" }, detail: { fr: "Importe les commentaires, avis et messages privés récents de vos Pages Facebook/Instagram.", en: "Imports recent comments, reviews and private messages from your Facebook/Instagram Pages." } },
      { label: { fr: "Répondre ou valider", en: "Reply or approve" }, detail: { fr: "Générez une réponse IA, éditez-la, envoyez ; ou laissez l'agent autonome envoyer s'il est confiant. Pour un commentaire ou un avis Facebook/Instagram, cochez « Répondre en privé » pour envoyer la réponse en message privé à l'auteur plutôt qu'en public.", en: "Generate an AI reply, edit it, send; or let the autonomous agent send when confident. For a Facebook or Instagram comment/review, tick 'Reply privately' to send the reply as a private message to the author instead of publicly." } },
      { label: { fr: "Diagnostiquer les DM Instagram", en: "Diagnose Instagram DMs" }, detail: { fr: "Vérifie pourquoi les messages privés Instagram n'arrivent pas (compte pro lié, permission accordée, webhook actif, portée réelle des permissions) et indique la cause probable et l'action à faire.", en: "Checks why Instagram private messages aren't arriving (linked professional account, granted permission, active webhook, actual permission scope) and shows the likely cause and next step." } },
      { label: { fr: "Simuler un message", en: "Simulate a message" }, detail: { fr: "Ajoute un message fictif (canal, auteur, texte) pour tester vos agents sans connexion réelle ; rien n'est envoyé sur les réseaux.", en: "Adds a fake message (channel, author, text) to test your agents without a live connection; nothing is sent to the networks." } },
    ],
    tips: [
      { fr: "« Suggérer » = vous validez chaque réponse. « Auto » = l'agent envoie seul s'il est confiant et qu'aucun sujet sensible n'est détecté.", en: "“Suggest” = you approve every reply. “Auto” = the agent sends on its own when confident and no sensitive topic is detected." },
      { fr: "Les sujets sensibles (remboursement, juridique, santé…) sont toujours escaladés à un humain.", en: "Sensitive topics (refunds, legal, health…) are always escalated to a human." },
      { fr: "Le bandeau « Humeur de vos audiences » résume le sentiment des messages chargés (négatif, question, neutre, positif) ; cliquez une catégorie pour filtrer la liste.", en: "The 'Audience mood' panel summarizes the sentiment of loaded messages (negative, question, neutral, positive); click a category to filter the list." },
    ],
    faq: [
      { q: { fr: "L'agent peut-il publier une bêtise tout seul ?", en: "Can the agent post something wrong on its own?" }, a: { fr: "En mode « Suggérer », jamais : vous validez. En mode « Auto », il n'envoie que s'il dépasse votre seuil de confiance et qu'aucun mot-clé d'escalade n'est présent.", en: "In “Suggest” mode, never: you approve. In “Auto” mode, it only sends above your confidence threshold and with no escalation keyword present." } },
    ],
    related: [
      { label: { fr: "Mes Pages", en: "My Pages" }, href: "/pages-meta" },
      { label: { fr: "Agents IA", en: "AI Agents" }, href: "/agents" },
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
    ],
  },

  // ── /publicites ───────────────────────────────────────────────────────────
  "/publicites": {
    title: { fr: "Pubs concurrentes", en: "Competitor Ads" },
    tagline: { fr: "Les publicités de vos concurrents, analysées", en: "Your competitors' ads, analysed" },
    whatFor: {
      fr: "Collecte et analyse les publicités de vos concurrents (Ad Library Meta). Identifiez les formats et angles qui tournent, et nourrissez votre stratégie : les enseignements alimentent la mémoire stratégique (RAG) utilisée par la génération de contenu et le Cerveau Pub.",
      en: "Collects and analyses your competitors' ads (Meta Ad Library). Spot the formats and angles that are running, and feed your strategy: the insights feed the strategic memory (RAG) used by content generation and the Ad Brain.",
    },
    actions: [
      { label: { fr: "Rechercher des pubs", en: "Search ads" }, detail: { fr: "Par marque ou mot-clé ; les pubs actives remontent en texte (titre, accroche, dépenses le cas échéant), avec un lien « Voir la publicité → » vers le visuel original sur Meta.", en: "By brand or keyword; active ads appear as text (title, copy, spend where available), with a 'View the ad →' link to the original creative on Meta." } },
      { label: { fr: "Analyser avec l'IA", en: "Analyze with AI" }, detail: { fr: "L'IA dégage les angles gagnants, formats et messages, et les conserve dans la mémoire stratégique.", en: "The AI extracts winning angles, formats and messaging, and stores them in strategic memory." } },
    ],
    tips: [
      { fr: "Les impressions/dépenses ne sont publiques que pour les pubs politiques ; ailleurs, on analyse les créatifs et messages.", en: "Impressions/spend are only public for political ads; elsewhere we analyse creatives and messaging." },
      { fr: "Ces analyses remontent automatiquement dans le Cerveau Pub (Performance Ads) pour affiner la stratégie.", en: "These analyses automatically feed the Ad Brain (Ad Performance) to refine strategy." },
    ],
    faq: [
      { q: { fr: "D'où viennent les données ?", en: "Where does the data come from?" }, a: { fr: "De la bibliothèque publicitaire Meta (Ad Library), via votre connexion Meta ou un collecteur dédié.", en: "From Meta's public Ad Library, via your Meta connection or a dedicated collector." } },
    ],
    related: [
      { label: { fr: "Veille & Marché", en: "Market Watch" }, href: "/veille" },
      { label: { fr: "Performance Ads", en: "Ad Performance" }, href: "/ad-performance" },
      { label: { fr: "Campagnes", en: "Campaigns" }, href: "/campaigns" },
    ],
  },

  // ── /mes-societes ───────────────────────────────────────────────────────────
  "/mes-societes": {
    title: { fr: "Mes sociétés", en: "My companies" },
    tagline: { fr: "Choisissez la société active et gérez vos comptes.", en: "Pick the active company and manage your accounts." },
    whatFor: {
      fr: "Mes sociétés est la surface de sélection et de gestion de vos sociétés (comptes). C'est ici que se verrouille votre périmètre de travail : la société active filtre toutes les données de l'application. Les administrateurs du compte peuvent créer, modifier (nom, voix de marque, couleur d'accent) et supprimer des sociétés, et accéder à leurs connexions.",
      en: "My companies is where you select and manage your companies (accounts). This is where your working scope is locked: the active company filters all data in the app. Account administrators can create, edit (name, brand voice, accent colour) and delete companies, and access their connections.",
    },
    actions: [
      {
        label: { fr: "Choisir la société active", en: "Select the active company" },
        detail: {
          fr: "Le bouton d'une carte affiche « Ouvrir → » si cette société est déjà active, ou « Choisir & ouvrir » si elle ne l'est pas encore — cliquer verrouille le périmètre sur cette société et bascule sur son tableau de bord.",
          en: "A card's button shows 'Open →' if that company is already active, or 'Select & open' if it isn't yet — clicking locks the scope on that company and jumps to its dashboard.",
        },
      },
      {
        label: { fr: "Accéder aux connexions", en: "Go to connections" },
        detail: {
          fr: "Le bouton « Connexions » de chaque carte bascule sur cette société puis ouvre directement ses comptes connectés (/accounts) — disponible pour tous les utilisateurs, pas seulement les administrateurs.",
          en: "Each card's 'Connections' button switches to that company and opens its connected accounts directly (/accounts) — available to every user, not just administrators.",
        },
      },
      {
        label: { fr: "Créer une société", en: "Create a company" },
        detail: {
          fr: "« + Nouvelle société » (admins) : donnez un nom et une couleur d'accent parmi 6 couleurs prédéfinies, puis le profil de marque est construit à l'étape suivante (Démarrage assisté). Si l'organisation n'a encore aucune société, un état vide propose directement « + Créer ma première société ».",
          en: "'+ New company' (admins): give a name and pick an accent colour from 6 predefined swatches, then the brand profile is built in the next step (assisted start). If the organisation has no company yet, an empty state offers '+ Create my first company' directly.",
        },
      },
      {
        label: { fr: "Modifier ou supprimer", en: "Edit or delete" },
        detail: {
          fr: "« Modifier » ajuste nom, voix de marque et couleur d'accent — ici via un sélecteur de couleur libre (n'importe quelle couleur), contrairement à la palette fixe de la création. « Supprimer » ouvre une confirmation — l'action est définitive.",
          en: "'Edit' adjusts name, brand voice and accent colour — here via a free colour picker (any colour), unlike the fixed palette used at creation. 'Delete' opens a confirmation — the action is permanent.",
        },
      },
    ],
    tips: [
      {
        fr: "La couleur d'accent identifie la société partout dans l'interface (avatar, sélecteur) — choisissez des couleurs distinctes entre vos sociétés.",
        en: "The accent colour identifies the company across the interface (avatar, selector) — pick distinct colours for your companies.",
      },
      {
        fr: "À la création, seules 6 couleurs prédéfinies sont proposées ; à la modification, n'importe quelle couleur est possible via un sélecteur libre.",
        en: "At creation, only 6 predefined colours are offered; when editing, any colour is possible via a free colour picker.",
      },
    ],
    faq: [
      {
        q: { fr: "Qui peut créer ou supprimer une société ?", en: "Who can create or delete a company?" },
        a: {
          fr: "Uniquement les administrateurs du compte (owner/admin). Les autres utilisateurs voient les sociétés auxquelles ils ont accès, peuvent en choisir une et accéder à ses connexions, mais ne voient pas « Modifier »/« Supprimer ».",
          en: "Only account administrators (owner/admin). Other users see the companies they have access to, can select one and reach its connections, but don't see 'Edit'/'Delete'.",
        },
      },
    ],
    related: [
      { label: { fr: "Mon équipe", en: "My team" }, href: "/mon-equipe" },
      { label: { fr: "Comptes connectés", en: "Connected accounts" }, href: "/accounts" },
      { label: { fr: "Démarrage assisté", en: "Assisted start" }, href: "/demarrage" },
    ],
  },

  // ── /mon-equipe ─────────────────────────────────────────────────────────────
  "/mon-equipe": {
    title: { fr: "Mon équipe", en: "My team" },
    tagline: { fr: "Ajoutez des utilisateurs et gérez leurs accès par société.", en: "Add users and manage their per-company access." },
    whatFor: {
      fr: "Mon équipe permet aux administrateurs du compte d'ajouter des utilisateurs et de leur accorder un accès à une ou plusieurs sociétés, en édition ou en lecture. Les administrateurs ont accès à tout. Un utilisateur qui a déjà un compte est ajouté immédiatement ; sinon, une invitation est créée et un e-mail d'invitation lui est envoyé (avec un texte copiable en secours) — ses accès s'activeront à sa première connexion.",
      en: "My team lets account administrators add users and grant them access to one or several companies, in edit or view mode. Administrators have full access. A user who already has an account is added immediately; otherwise an invitation is created and an invitation email is sent (with a copyable text as backup) — their access activates on first sign-in.",
    },
    actions: [
      {
        label: { fr: "Ajouter un utilisateur", en: "Add a user" },
        detail: {
          fr: "« + Ajouter un utilisateur » : saisissez son e-mail, choisissez le rôle et, pour un Utilisateur, l'accès par société. S'il a déjà un compte, il rejoint l'équipe immédiatement.",
          en: "'+ Add a user': enter their email, choose the role and, for a User, the per-company access. If they already have an account, they join the team immediately.",
        },
      },
      {
        label: { fr: "Choisir le rôle", en: "Choose the role" },
        detail: {
          fr: "Admin : accès total à toutes les sociétés et à la gestion de l'équipe. Utilisateur : accès limité aux sociétés que vous lui assignez, en Lecture ou en Édition.",
          en: "Admin: full access to all companies and to team management. User: access limited to the companies you assign, in View or Edit mode.",
        },
      },
      {
        label: { fr: "Régler l'accès par société", en: "Set per-company access" },
        detail: {
          fr: "Pour chaque société, choisissez Aucun, Lecture (consultation) ou Édition (création et modification). Le bouton « Accès » d'un membre rouvre cette matrice à tout moment.",
          en: "For each company, choose None, View (read-only) or Edit (create and modify). A member's 'Access' button reopens this matrix at any time.",
        },
      },
      {
        label: { fr: "Suivre les invitations", en: "Track invitations" },
        detail: {
          fr: "L'envoi automatique d'e-mails est inactif sur cet espace : les invitations en attente affichent « ✉️ Envoyer depuis ma messagerie » (ouvre un brouillon pré-rempli dans votre messagerie) et « 📋 Copier » (copie le texte et le lien d'inscription, à coller où vous voulez) ; « Annuler » révoque l'invitation.",
          en: "Automatic email sending is inactive on this space: pending invitations show '✉️ Send from my mailbox' (opens a pre-filled draft in your mail client) and '📋 Copy' (copies the text and signup link, to paste anywhere); 'Cancel' revokes the invitation.",
        },
      },
      {
        label: { fr: "Retirer un membre", en: "Remove a member" },
        detail: {
          fr: "« Retirer » enlève le membre de l'équipe et révoque ses accès. Le propriétaire du compte ne peut pas être retiré.",
          en: "'Remove' takes the member out of the team and revokes their access. The account owner cannot be removed.",
        },
      },
    ],
    tips: [
      {
        fr: "L'envoi automatique d'e-mails est inactif sur cet espace (variable RESEND_API_KEY non définie) : les invitations ne partent jamais toutes seules. Utilisez « ✉️ Envoyer depuis ma messagerie » ou « 📋 Copier » pour les transmettre vous-même.",
        en: "Automatic email sending is inactive on this space (RESEND_API_KEY not set): invitations never go out on their own. Use '✉️ Send from my mailbox' or '📋 Copy' to send them yourself.",
      },
      {
        fr: "Privilégiez le mode Lecture pour les parties prenantes qui doivent consulter sans risquer de modifier (direction, client final).",
        en: "Prefer View mode for stakeholders who need to consult without risking changes (management, end client).",
      },
    ],
    faq: [
      {
        q: { fr: "L'invité n'a pas reçu l'e-mail — que faire ?", en: "The invitee did not receive the email — what now?" },
        a: {
          fr: "Normal : l'envoi automatique est inactif sur cet espace. Utilisez « ✉️ Envoyer depuis ma messagerie » (brouillon pré-rempli) ou « 📋 Copier » sur l'invitation en attente, et transmettez-la vous-même. Ses accès s'activeront dès sa première connexion avec cette adresse.",
          en: "That's expected: automatic sending is inactive on this space. Use '✉️ Send from my mailbox' (pre-filled draft) or '📋 Copy' on the pending invitation, and send it yourself. Their access activates on their first sign-in with that address.",
        },
      },
      {
        q: { fr: "Qui peut gérer l'équipe ?", en: "Who can manage the team?" },
        a: {
          fr: "Cet espace est réservé aux administrateurs du compte (owner/admin).",
          en: "This area is reserved for account administrators (owner/admin).",
        },
      },
    ],
    related: [
      { label: { fr: "Mes sociétés", en: "My companies" }, href: "/mes-societes" },
      { label: { fr: "Paramètres", en: "Settings" }, href: "/settings" },
    ],
  },

  // ── /identite ───────────────────────────────────────────────────────────────
  "/identite": {
    title: { fr: "Identité de marque", en: "Brand identity" },
    tagline: { fr: "Construisez et verrouillez l'ADN de la marque avec le consultant IA.", en: "Build and lock the brand's DNA with the AI consultant." },
    whatFor: {
      fr: "Espace de dialogue avec le consultant IA pour construire puis verrouiller l'identité de la marque (ADN), avant ou en parallèle des campagnes. Réutilisé comme étape 0 du démarrage guidé ; tout est réversible et l'identité peut être remise à zéro.",
      en: "A dialogue space with the AI consultant to build then lock the brand identity (DNA), before or alongside campaigns. Reused as step 0 of the guided start; everything is reversible and the identity can be reset.",
    },
    actions: [
      {
        label: { fr: "Discuter avec le consultant IA", en: "Chat with the AI consultant" },
        detail: {
          fr: "Répondez aux questions du consultant pour affiner positionnement, ton et piliers de contenu de la marque.",
          en: "Answer the consultant's questions to refine the brand's positioning, tone and content pillars.",
        },
      },
      {
        label: { fr: "Verrouiller l'identité", en: "Lock the identity" },
        detail: {
          fr: "Une fois l'ADN validé, verrouillez-le : il sert de référence aux générations de contenu. Vous pouvez à tout moment tout recommencer à zéro pour redéfinir l'identité (pas un simple déverrouillage — un reset complet).",
          en: "Once the DNA is validated, lock it: it becomes the reference for content generation. You can start over from scratch at any time to redefine the identity (not a simple unlock — a full reset).",
        },
      },
      {
        label: { fr: "Gérer la mémoire stratégique (RAG)", en: "Manage strategic memory (RAG)" },
        detail: {
          fr: "Consultez le nombre d'insights mémorisés (veille, pubs, Pages) et remettez la mémoire à zéro si besoin — action irréversible.",
          en: "View how many insights are stored (watch, ads, Pages) and reset the memory if needed — this action is irreversible.",
        },
      },
      {
        label: { fr: "Tester les visuels (moodboard IA)", en: "Test visuals (AI moodboard)" },
        detail: {
          fr: "Dès que le consultant propose des pistes visuelles, « Générer le moodboard » crée jusqu'à 3 images IA ; marquez vos préférées (★) pour les intégrer à la direction artistique de l'ADN au verrouillage, et testez-en une en courte vidéo avec « Tester vidéo ».",
          en: "Once the consultant proposes visual directions, 'Generate moodboard' creates up to 3 AI images; star (★) your favourites to fold them into the DNA's art direction on lock, and turn one into a short test video with 'Test video'.",
        },
      },
    ],
    tips: [
      {
        fr: "Une identité verrouillée rend les contenus générés plus cohérents d'une campagne à l'autre.",
        en: "A locked identity makes generated content more consistent from one campaign to the next.",
      },
      {
        fr: "Cette page est réservée aux utilisateurs ayant un accès en édition ; les lecteurs voient un message d'accès restreint.",
        en: "This page is reserved for users with edit access; read-only users see a restricted-access message.",
      },
      {
        fr: "Si l'ADN a été rédigé dans une autre langue que celle affichée, un bandeau le détecte et propose « Régénérer en français/anglais » pour le réexprimer dans la langue active.",
        en: "If the DNA was written in a different language than the one shown, a banner detects it and offers 'Regenerate in French/English' to re-express it in the active language.",
      },
    ],
    faq: [],
    related: [
      { label: { fr: "Démarrage assisté", en: "Assisted start" }, href: "/demarrage" },
      { label: { fr: "Composer", en: "Compose" }, href: "/compose" },
    ],
  },

  // ── /benchmark ──────────────────────────────────────────────────────────────
  "/benchmark": {
    title: { fr: "Benchmark concurrentiel", en: "Competitive benchmark" },
    tagline: { fr: "Comparez-vous à vos concurrents sur 12 dimensions.", en: "Compare yourself to competitors across 12 dimensions." },
    whatFor: {
      fr: "Le benchmark compare votre offre à des concurrents que vous saisissez (avec URL de pricing optionnelle). Le serveur récupère les pages puis l'IA produit une matrice de scores sur 12 dimensions, une SWOT, le positionnement et un prix conseillé.",
      en: "The benchmark compares your offer to competitors you enter (with an optional pricing URL). The server fetches the pages then the AI produces a 12-dimension score matrix, a SWOT, the positioning and a suggested price.",
    },
    actions: [
      {
        label: { fr: "Saisir les concurrents", en: "Enter competitors" },
        detail: {
          fr: "La liste démarre pré-remplie avec 4 concurrents génériques du secteur (Hootsuite, Sprout Social, Metricool, HeyGen) que vous pouvez modifier ou remplacer, avec leur URL de pricing si disponible pour affiner l'analyse tarifaire.",
          en: "The list starts pre-filled with 4 generic sector competitors (Hootsuite, Sprout Social, Metricool, HeyGen) that you can edit or replace, with their pricing URL if available to refine the price analysis.",
        },
      },
      {
        label: { fr: "Suggérer des concurrents (IA)", en: "Suggest competitors (AI)" },
        detail: {
          fr: "Le bouton « ✨ Suggérer des concurrents » propose jusqu'à 6 concurrents pertinents (avec URL de pricing pré-remplie) à partir de la description de votre produit.",
          en: "The '✨ Suggest competitors' button proposes up to 6 relevant competitors (with a prefilled pricing URL) based on your product description.",
        },
      },
      {
        label: { fr: "Lancer l'analyse", en: "Run the analysis" },
        detail: {
          fr: "L'IA produit la matrice de scores, la SWOT et le positionnement — utilisez-les pour ajuster votre stratégie.",
          en: "The AI produces the score matrix, the SWOT and the positioning — use them to adjust your strategy.",
        },
      },
    ],
    tips: [],
    faq: [],
    related: [
      { label: { fr: "Veille & Marché", en: "Watch & Market" }, href: "/veille" },
      { label: { fr: "Centre de pilotage", en: "Piloting center" }, href: "/pilotage" },
    ],
  },

  // ── /series ─────────────────────────────────────────────────────────────────
  "/series": {
    title: { fr: "Séries multi-réseaux", en: "Multi-network series" },
    tagline: { fr: "Générez une série de posts + visuels adaptée à chaque réseau.", en: "Generate a series of posts + visuals adapted to each network." },
    whatFor: {
      fr: "Les séries génèrent plusieurs publications d'un coup pour UN réseau à la fois (Facebook, Instagram ou TikTok — LinkedIn garde son espace dédié). Le texte de chaque publication est généré d'abord ; les visuels (image ou vidéo selon le réseau) se génèrent ensuite, séparément.",
      en: "Series generate several posts at once for ONE network at a time (Facebook, Instagram or TikTok — LinkedIn keeps its dedicated space). Each post's text is generated first; visuals (image or video depending on the network) are generated afterwards, separately.",
    },
    actions: [
      {
        label: { fr: "Générer les textes de la série", en: "Generate the series' text" },
        detail: {
          fr: "Choisissez d'abord un réseau, puis décrivez le thème : l'IA génère le texte de chaque publication de la série.",
          en: "First choose a network, then describe the theme: the AI generates the text for each post in the series.",
        },
      },
      {
        label: { fr: "Générer les visuels", en: "Generate the visuals" },
        detail: {
          fr: "Générez ensuite les visuels — élément par élément, ou en un clic pour tous les éléments qui n'en ont pas encore.",
          en: "Then generate the visuals — one by one, or in a single click for every item still missing one.",
        },
      },
      {
        label: { fr: "Diffuser la série", en: "Distribute the series" },
        detail: {
          fr: "Pour Facebook et Instagram, définissez une date de départ, une cadence et une heure : la série est programmée automatiquement. Pour TikTok, la diffusion est immédiate (pas de programmation).",
          en: "For Facebook and Instagram, set a start date, a cadence and a time: the series is scheduled automatically. For TikTok, distribution is immediate (no scheduling).",
        },
      },
    ],
    tips: [],
    faq: [],
    related: [
      { label: { fr: "Espace LinkedIn", en: "LinkedIn space" }, href: "/linkedin" },
      { label: { fr: "Publications programmées", en: "Scheduled posts" }, href: "/scheduled" },
    ],
  },

  // ── /simulateur ─────────────────────────────────────────────────────────────
  "/simulateur": {
    title: { fr: "Prédiction & Simulation", en: "Prediction & Simulation" },
    tagline: { fr: "Simulez la réception d'une campagne avant de dépenser.", en: "Simulate how a campaign will land before spending." },
    whatFor: {
      fr: "Avant de dépenser, simulez : le Copilote de lancement (mode par défaut) dialogue avec vous pour construire le brief à partir de votre marque et de votre mémoire stratégique, lance la simulation puis génère une stratégie applicable en un clic à vos campagnes. Le Mode manuel vous laisse saisir directement produit, cible et message. Dans les deux cas, l'IA génère des personas représentatifs, simule leurs réactions et agrège une prédiction de réception avec des recommandations. Résultat directionnel — une aide à la décision, pas un oracle.",
      en: "Before spending, simulate: the Launch Copilot (default mode) chats with you to build the brief from your brand and strategic memory, runs the simulation, then generates a strategy you can apply to your campaigns in one click. Manual mode lets you enter product, target and message directly. Either way, the AI generates representative personas, simulates their reactions and aggregates a reception prediction with recommendations. Directional output — a decision aid, not an oracle.",
    },
    actions: [
      {
        label: { fr: "Dialoguer avec le Copilote de lancement", en: "Chat with the Launch Copilot" },
        detail: {
          fr: "Mode par défaut : le copilote récupère votre identité de marque et votre mémoire stratégique (veille, pubs, benchmark, campagnes), construit le brief par la conversation, lance la simulation puis propose une stratégie applicable directement.",
          en: "Default mode: the copilot pulls your brand identity and strategic memory (watch, ads, benchmark, campaigns), builds the brief through conversation, runs the simulation, then proposes a strategy you can apply directly.",
        },
      },
      {
        label: { fr: "Basculer en Mode manuel", en: "Switch to Manual mode" },
        detail: {
          fr: "Renseignez directement produit, cible et message, puis lancez la simulation. Requiert un accès en Édition — les accès en Lecture ne peuvent pas la lancer.",
          en: "Fill in product, target and message directly, then run the simulation. Requires Edit access — View-only users cannot run one.",
        },
      },
    ],
    tips: [
      {
        fr: "Prenez la prédiction comme une tendance directionnelle : confirmez-la avec un petit test réel avant d'engager le budget complet.",
        en: "Treat the prediction as a directional trend: confirm it with a small real test before committing the full budget.",
      },
      {
        fr: "Quand il est activé côté serveur, un moteur « Premium · MiroFish » (multi-agents) peut remplacer le moteur standard pour une simulation plus poussée.",
        en: "When enabled server-side, a 'Premium · MiroFish' multi-agent engine can replace the standard engine for a deeper simulation.",
      },
    ],
    faq: [],
    related: [
      { label: { fr: "Veille & Marché", en: "Watch & Market" }, href: "/veille" },
      { label: { fr: "Campagnes", en: "Campaigns" }, href: "/campaigns" },
    ],
  },

  // ── /studio-affiche ─────────────────────────────────────────────────────────
  "/studio-affiche": {
    title: { fr: "Studio Affiches & Visuels", en: "Poster & Visual Studio" },
    tagline: { fr: "Créez affiches et visuels de marque, print et réseaux.", en: "Create brand posters and visuals, print and social." },
    whatFor: {
      fr: "Un studio visuel piloté par IA : formats print (A4/A3) et réseaux (carré, story, portrait, paysage), fond généré par IA ou image uploadée, texte en surimpression (titre + sous-titre, couleur, position), logo de la marque, grand aperçu en temps réel et export PNG haute définition.",
      en: "An AI-driven visual studio: print (A4/A3) and social formats (square, story, portrait, landscape), AI-generated background or uploaded image, text overlay (title + subtitle, colour, position), brand logo, large real-time preview and high-definition PNG export.",
    },
    actions: [
      {
        label: { fr: "Choisir le format", en: "Choose the format" },
        detail: {
          fr: "Sélectionnez un format print (A4/A3) ou réseau (carré, story, portrait, paysage) selon la destination du visuel.",
          en: "Pick a print (A4/A3) or social format (square, story, portrait, landscape) depending on where the visual will be used.",
        },
      },
      {
        label: { fr: "Composer le visuel", en: "Compose the visual" },
        detail: {
          fr: "Générez un fond par IA ou uploadez une image, ajoutez titre/sous-titre et le logo, puis ajustez couleurs et positions dans l'aperçu.",
          en: "Generate an AI background or upload an image, add title/subtitle and the logo, then adjust colours and positions in the preview.",
        },
      },
      {
        label: { fr: "Exporter en PNG", en: "Export as PNG" },
        detail: {
          fr: "Exportez le visuel final en PNG haute définition, utilisable hors réseaux également (print).",
          en: "Export the final visual as a high-definition PNG, also usable outside social networks (print).",
        },
      },
      {
        label: { fr: "Décliner en un clic pour tous les réseaux", en: "One-click decline for every network" },
        detail: {
          fr: "« Décliner en pub — IA plein cadre » recompose le fond par IA pour chaque format publicitaire sans coupe ni flou (nécessite un fond généré par IA). « Décliner sans coupe — instantané » remplit le cadre par un fond flouté et fonctionne aussi avec une image importée.",
          en: "'Decline as ad — AI full-frame' recomposes the background with AI for each ad format with no crop or blur (requires an AI-generated background). 'Decline without cropping — instant' fills the frame with a blurred background and also works with an uploaded image.",
        },
      },
      {
        label: { fr: "Enregistrer et diffuser", en: "Save and distribute" },
        detail: {
          fr: "Enregistrez le résultat dans la médiathèque, puis publiez-le, programmez-le ou transformez-le en publicité Meta directement depuis le studio.",
          en: "Save the result to the media library, then publish it, schedule it or turn it into a Meta ad directly from the studio.",
        },
      },
    ],
    tips: [],
    faq: [],
    related: [
      { label: { fr: "Médiathèque", en: "Media library" }, href: "/media" },
      { label: { fr: "Composer", en: "Compose" }, href: "/compose" },
    ],
  },

  // ── /studio-avatar ──────────────────────────────────────────────────────────
  "/studio-avatar": {
    title: { fr: "Studio Avatar", en: "Avatar Studio" },
    tagline: { fr: "Créez une vidéo d'avatar parlant à partir d'un visage et d'un sujet.", en: "Create a talking-avatar video from a face and a topic." },
    whatFor: {
      fr: "Le Studio Avatar transforme un visage et un sujet en vidéo d'avatar parlant : script généré par l'IA, voix (synthèse vocale), puis synchronisation labiale. La vidéo produite est téléchargeable et publiable.",
      en: "The Avatar Studio turns a face and a topic into a talking-avatar video: AI-generated script, voice (text-to-speech), then lip-sync. The resulting video is downloadable and publishable.",
    },
    actions: [
      {
        label: { fr: "Fournir ou générer le visage", en: "Provide or generate the face" },
        detail: {
          fr: "Uploadez le visage (avec consentement de la personne) ou générez-le par IA à partir d'un prompt, et décrivez le sujet de la vidéo : l'IA rédige le script.",
          en: "Upload the face (with the person's consent) or generate it with AI from a prompt, and describe the video topic: the AI writes the script.",
        },
      },
      {
        label: { fr: "Personnaliser la scène, le modèle et la voix", en: "Customize the scene, model and voice" },
        detail: {
          fr: "Changez le décor du portrait par IA, choisissez un modèle d'avatar adapté à une photo ou à une vidéo source, et clonez votre propre voix (avec consentement) via micro ou fichier audio plutôt que la synthèse vocale par défaut.",
          en: "Change the portrait's background with AI, pick an avatar model suited to a photo or a source video, and clone your own voice (with consent) via mic or audio file instead of the default text-to-speech.",
        },
      },
      {
        label: { fr: "Générer puis publier", en: "Generate then publish" },
        detail: {
          fr: "Lancez la génération (voix + lip-sync, avec sous-titres incrustés optionnels), prévisualisez, puis téléchargez ou publiez la vidéo. Les avatars générés sont enregistrés pour réutilisation.",
          en: "Launch generation (voice + lip-sync, with optional burned-in subtitles), preview, then download or publish the video. Generated avatars are saved for reuse.",
        },
      },
    ],
    tips: [],
    faq: [],
    related: [
      { label: { fr: "Studio Vidéo", en: "Video Studio" }, href: "/studio-video" },
      { label: { fr: "Médiathèque", en: "Media library" }, href: "/media" },
    ],
  },

  // ── /media ──────────────────────────────────────────────────────────────────
  "/media": {
    title: { fr: "Médiathèque", en: "Media library" },
    tagline: { fr: "Tous les visuels et vidéos de la marque, au même endroit.", en: "All the brand's visuals and videos, in one place." },
    whatFor: {
      fr: "La médiathèque est la galerie filtrable des visuels et vidéos de la marque. Depuis chaque vignette, vous pouvez publier directement, décliner un visuel par IA, l'utiliser comme base d'une publicité, importer de nouveaux médias ou en supprimer.",
      en: "The media library is the filterable gallery of the brand's visuals and videos. From each thumbnail, you can publish directly, decline a visual with AI, use it as the basis of an ad, import new media or delete one.",
    },
    actions: [
      {
        label: { fr: "Importer un média", en: "Import media" },
        detail: {
          fr: "Utilisez « Importer des fichiers » pour envoyer une ou plusieurs images/vidéos depuis votre ordinateur, ou collez une URL directe puis cliquez sur « Ajouter ».",
          en: "Use 'Upload files' to send one or more images/videos from your computer, or paste a direct URL then click 'Add'.",
        },
      },
      {
        label: { fr: "Publier directement", en: "Publish directly" },
        detail: {
          fr: "Le bouton « Publier », en haut de chaque vignette, ouvre Composer avec ce média déjà attaché, prêt à programmer ou publier.",
          en: "The 'Publish' button, at the top of each thumbnail, opens Composer with that media already attached, ready to schedule or publish.",
        },
      },
      {
        label: { fr: "Décliner ou créer une pub", en: "Decline or create an ad" },
        detail: {
          fr: "« Décliner » (images uniquement) génère des variantes par IA ; « Créer une pub » envoie le média comme base d'une nouvelle publicité.",
          en: "'Decline' (images only) generates AI variants; 'Create an ad' sends the media as the basis of a new advertisement.",
        },
      },
      {
        label: { fr: "Supprimer un média", en: "Delete a media item" },
        detail: {
          fr: "Le bouton « Supprimer » retire définitivement le fichier après confirmation (irréversible). Les visuels du kit de marque ne peuvent pas être supprimés depuis cet écran.",
          en: "The 'Delete' button permanently removes the file after confirmation (irreversible). Brand-kit visuals cannot be deleted from this screen.",
        },
      },
    ],
    tips: [],
    faq: [],
    related: [
      { label: { fr: "Composer un post", en: "Compose a post" }, href: "/compose" },
      { label: { fr: "Studio Affiches", en: "Poster Studio" }, href: "/studio-affiche" },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Alias (redirections) : /connecteurs → /parametres-connecteurs
// ─────────────────────────────────────────────────────────────────────────────

HELP_BILINGUAL["/connecteurs"] = HELP_BILINGUAL["/parametres-connecteurs"];

// ─────────────────────────────────────────────────────────────────────────────
// Fallback générique bilingue
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_BILINGUAL: BilingualEntry = {
  title: {
    fr: "Aide contextuelle",
    en: "Contextual help",
  },
  tagline: {
    fr: "Bienvenue dans AXON-AI · Social Hub.",
    en: "Welcome to AXON-AI · Social Hub.",
  },
  whatFor: {
    fr: "AXON-AI Social Hub vous permet de gérer la présence social media de vos marques depuis une interface unifiée : composition, programmation, automations, analytics et pilotage des campagnes payantes. Naviguez dans la barre latérale pour accéder aux différentes rubriques.",
    en: "AXON-AI Social Hub lets you manage your brands' social media presence from a unified interface: composition, scheduling, automations, analytics and paid campaign management. Navigate the sidebar to access the different sections.",
  },
  actions: [
    {
      label: { fr: "Naviguer dans l'application", en: "Navigate the application" },
      detail: {
        fr: "Utilisez la barre latérale gauche pour accéder aux rubriques. Le sélecteur de marque en haut filtre toutes les données selon l'entité active.",
        en: "Use the left sidebar to access sections. The brand selector at the top filters all data according to the active entity.",
      },
    },
    {
      label: { fr: "Obtenir de l'aide", en: "Get help" },
      detail: {
        fr: "Cliquez sur le bouton « ? » en haut à droite depuis n'importe quelle rubrique pour afficher l'aide contextuelle adaptée à la page en cours.",
        en: "Click the '?' button in the top right from any section to display contextual help adapted to the current page.",
      },
    },
  ],
  tips: [
    {
      fr: "Commencez par Connecteurs pour configurer vos accès, puis par Composer pour publier votre premier post.",
      en: "Start with Connectors to set up your access, then with Compose to publish your first post.",
    },
  ],
  faq: [
    {
      q: { fr: "Comment changer de langue ?", en: "How to change language?" },
      a: {
        fr: "Utilisez le sélecteur FR / EN dans l'en-tête de l'application pour basculer entre le français et l'anglais.",
        en: "Use the FR / EN selector in the application header to switch between French and English.",
      },
    },
  ],
  related: [
    { label: { fr: "Tableau de bord", en: "Dashboard" }, href: "/dashboard" },
    { label: { fr: "Comptes connectés", en: "Connected accounts" }, href: "/accounts" },
    { label: { fr: "Paramètres", en: "Settings" }, href: "/settings" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Résolveur : traduit une entrée bilingue dans la langue demandée
// ─────────────────────────────────────────────────────────────────────────────

function resolve(entry: BilingualEntry, lang: Lang): HelpEntry {
  const l = lang === "en" ? "en" : "fr";
  return {
    title: entry.title[l],
    tagline: entry.tagline[l],
    whatFor: entry.whatFor[l],
    actions: entry.actions.map((a) => ({
      label: a.label[l],
      detail: a.detail[l],
    })),
    tips: entry.tips.map((t) => t[l]),
    faq: entry.faq.map((f) => ({ q: f.q[l], a: f.a[l] })),
    shortcuts: entry.shortcuts?.map((s) => s[l]),
    related: entry.related.map((r) => ({
      label: r.label[l],
      href: r.href,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper public
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne l'entrée d'aide la plus spécifique qui correspond au pathname
 * fourni (correspondance par préfixe, de la plus longue à la plus courte),
 * dans la langue demandée.
 * Si aucune route ne correspond, retourne le fallback générique bilingue.
 */
export function getHelp(pathname: string, lang: Lang = "fr"): HelpEntry {
  const path = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  // 1) Correspondance EXACTE (priorité absolue → bon contenu par page).
  if (HELP_BILINGUAL[path]) return resolve(HELP_BILINGUAL[path], lang);
  // 2) Sinon, préfixe par SEGMENT (ex. /campaigns/123 → /campaigns), du plus
  //    long au plus court — jamais de collision partielle (ex. /ad ≠ /ad-x).
  const keys = Object.keys(HELP_BILINGUAL).sort((a, b) => b.length - a.length);
  const match = keys.find((key) => path === key || path.startsWith(key + "/"));
  const bilingual = match ? HELP_BILINGUAL[match] : FALLBACK_BILINGUAL;
  return resolve(bilingual, lang);
}
