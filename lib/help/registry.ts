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
          fr: "Cliquez sur la carte d'un compte pour le sélectionner comme entité active. L'application charge automatiquement toutes les données (publications, analytics, automations) liées à ce compte.",
          en: "Click an account card to select it as the active entity. The app automatically loads all data (posts, analytics, automations) related to that account.",
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
        fr: "Si vous gérez plusieurs clients, marquez les comptes fréquemment utilisés : ils apparaîtront en premier selon l'ordre défini par l'administrateur.",
        en: "If you manage multiple clients, frequently used accounts appear first according to the order set by the administrator.",
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
      fr: "Le tableau de bord centralise les indicateurs clés de performance (KPI) de toutes vos marques : portée, engagement, publications programmées et alertes en cours. C'est votre point d'entrée quotidien pour évaluer la santé globale de vos activités social media d'un seul coup d'œil. Les cartes métriques comparent la semaine courante à la précédente pour détecter instantanément les variations.",
      en: "The dashboard centralises the key performance indicators (KPIs) for all your brands: reach, engagement, scheduled posts and active alerts. It's your daily entry point for assessing the overall health of your social media activities at a glance. Metric cards compare the current week to the previous one so you can instantly spot variations.",
    },
    actions: [
      {
        label: { fr: "Changer de marque", en: "Switch brand" },
        detail: {
          fr: "Utilisez le sélecteur de marque en haut à gauche pour basculer entre vos entités. Chaque marque dispose de son propre périmètre de données — KPIs, alertes et publications.",
          en: "Use the brand selector in the top-left to switch between your entities. Each brand has its own data scope — KPIs, alerts and posts.",
        },
      },
      {
        label: { fr: "Lire les alertes actives", en: "Read active alerts" },
        detail: {
          fr: "Les cartes d'alerte signalent les publications en échec, les automations suspendues, les tokens expirés ou les seuils d'engagement atteints. Cliquez sur une alerte pour accéder directement à l'élément concerné.",
          en: "Alert cards flag failed posts, suspended automations, expired tokens or reached engagement thresholds. Click an alert to navigate directly to the affected item.",
        },
      },
      {
        label: { fr: "Consulter les métriques rapides", en: "Check quick metrics" },
        detail: {
          fr: "Les tuiles de métriques affichent portée, engagement et nombre de publications de la semaine en cours vs. semaine précédente, avec indicateur de tendance (flèche verte/rouge).",
          en: "Metric tiles display reach, engagement and post count for the current week vs. the previous one, with a trend indicator (green/red arrow).",
        },
      },
      {
        label: { fr: "Naviguer vers une rubrique depuis le tableau", en: "Navigate to a section from the board" },
        detail: {
          fr: "Chaque bloc du tableau de bord est cliquable et mène directement à la rubrique détaillée concernée (Publications programmées, Analytics, etc.).",
          en: "Each block on the dashboard is clickable and leads directly to the relevant detailed section (Scheduled posts, Analytics, etc.).",
        },
      },
    ],
    tips: [
      {
        fr: "Consultez le tableau de bord chaque matin pour identifier rapidement les contenus qui nécessitent une intervention.",
        en: "Check the dashboard every morning to quickly spot content that needs attention.",
      },
      {
        fr: "Les variations de métriques affichées en rouge ou en vert vous donnent une tendance instantanée sans avoir à naviguer vers Analytics.",
        en: "Metric variations displayed in red or green give you an instant trend without navigating to Analytics.",
      },
      {
        fr: "Un badge orange sur une alerte signifie « avertissement » ; rouge signifie « critique » — priorisez les rouges.",
        en: "An orange badge on an alert means 'warning'; red means 'critical' — prioritise the red ones.",
      },
    ],
    faq: [
      {
        q: { fr: "Les données sont-elles en temps réel ?", en: "Is the data real-time?" },
        a: {
          fr: "Les KPIs sont rafraîchis à chaque chargement de page. Dès que vos connecteurs (Meta, LinkedIn) sont actifs, les données proviennent directement des APIs des plateformes.",
          en: "KPIs are refreshed on every page load. Once your connectors (Meta, LinkedIn) are active, data comes directly from the platform APIs.",
        },
      },
      {
        q: { fr: "Pourquoi certaines métriques affichent « — » ?", en: "Why do some metrics show '—'?" },
        a: {
          fr: "Un connecteur non configuré ou un token expiré empêche la récupération de données réelles. Rendez-vous dans Connecteurs pour configurer l'accès.",
          en: "An unconfigured connector or an expired token prevents real data from being fetched. Go to Connectors to set up access.",
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
      fr: "Le centre de pilotage est la tour de contrôle stratégique. Il agrège les KPIs de tous vos réseaux, affiche le benchmark concurrentiel de votre marché, remonte les insights de veille et centralise les recommandations des agents IA à valider. Vous y définissez l'objectif global et le niveau d'autonomie des agents, puis lancez des cycles de pilotage pour obtenir des décisions actionnables.",
      en: "The piloting center is the strategic control tower. It aggregates KPIs across all your networks, displays the competitive benchmark for your market, surfaces watch insights and centralises agent AI recommendations for your review. You define the global objective and agent autonomy level, then launch piloting cycles to get actionable decisions.",
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
          fr: "Le bouton « Lancer un cycle » appelle l'API /agents/run avec l'objectif et le niveau d'autonomie configurés. Les 8 agents travaillent en séquence et leurs recommandations apparaissent dans la file de décisions.",
          en: "The 'Launch cycle' button calls the /agents/run API with the configured objective and autonomy level. The 8 agents work in sequence and their recommendations appear in the decision queue.",
        },
      },
      {
        label: { fr: "Valider ou ignorer une recommandation", en: "Approve or dismiss a recommendation" },
        detail: {
          fr: "Chaque décision affiche l'agent source, son raisonnement et l'impact estimé. « Valider » envoie la décision en exécution ; « Ignorer » la marque comme rejetée sans la supprimer du journal.",
          en: "Each decision shows the source agent, its rationale and estimated impact. 'Approve' sends the decision to execution; 'Dismiss' marks it as rejected without removing it from the log.",
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
          fr: "Le tableau de benchmark compare vos métriques aux moyennes du marché local (pays sélectionné). Une flèche verte indique que vous surpassez la moyenne ; rouge que vous êtes en dessous.",
          en: "The benchmark table compares your metrics to local market averages (selected country). A green arrow means you are above average; red means below.",
        },
      },
      {
        label: { fr: "Consulter les insights de veille", en: "Check watch insights" },
        detail: {
          fr: "Les insights de veille (formats, angles, benchmarks) proviennent du dernier run de la page Veille & Marché. Ils sont automatiquement injectés dans la file de décisions comme recommandations priorisées.",
          en: "Watch insights (formats, angles, benchmarks) come from the last run of the Watch & Market page. They are automatically injected into the decision queue as prioritised recommendations.",
        },
      },
      {
        label: { fr: "Filtrer par réseau", en: "Filter by network" },
        detail: {
          fr: "La section « Par réseau » liste Facebook, Instagram et LinkedIn avec leur taux d'engagement et la tendance sur la période. Identifiez le réseau le plus performant d'un coup d'œil.",
          en: "The 'By network' section lists Facebook, Instagram and LinkedIn with their engagement rate and period trend. Identify your best-performing network at a glance.",
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
        fr: "Les recommandations de veille (issues de /veille) apparaissent en tête de file avec la priorité « haute » — traitez-les en premier.",
        en: "Watch recommendations (from /veille) appear at the top of the queue with 'high' priority — handle them first.",
      },
      {
        fr: "Un cycle complet prend en moyenne 10–30 secondes selon la charge du serveur IA.",
        en: "A full cycle takes about 10–30 seconds depending on the AI server load.",
      },
    ],
    faq: [
      {
        q: { fr: "Quelle différence entre /pilotage et /agents ?", en: "What is the difference between /pilotage and /agents?" },
        a: {
          fr: "/pilotage est la vue stratégique : KPIs, benchmark, décisions, veille. /agents est la vue technique : configuration et timeline d'exécution de chaque agent.",
          en: "/pilotage is the strategic view: KPIs, benchmark, decisions, watch. /agents is the technical view: configuration and execution timeline for each agent.",
        },
      },
      {
        q: { fr: "Les indicateurs sont-ils basés sur des données réelles ?", en: "Are the indicators based on real data?" },
        a: {
          fr: "Ils basculent sur les données réelles dès que les connecteurs Meta/LinkedIn sont actifs. En l'absence de connecteurs, des données estimées à partir du marché et des mots-clés sont affichées.",
          en: "They switch to real data as soon as Meta/LinkedIn connectors are active. Without connectors, market- and keyword-estimated data is displayed.",
        },
      },
      {
        q: { fr: "Puis-je annuler une décision validée ?", en: "Can I cancel an approved decision?" },
        a: {
          fr: "Une fois validée, la décision est envoyée en exécution. Pour annuler, rendez-vous dans Automations ou Historique selon le type d'action exécutée.",
          en: "Once approved, the decision is sent for execution. To cancel, go to Automations or History depending on the type of action executed.",
        },
      },
    ],
    shortcuts: [
      {
        fr: "Le sélecteur de pays (scope) en haut de page filtre à la fois les KPIs, le benchmark et les insights de veille.",
        en: "The country selector (scope) at the top of the page filters KPIs, benchmark and watch insights simultaneously.",
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
      fr: "Pilotez l'orchestration multi-agent de vos campagnes sociales.",
      en: "Control the multi-agent orchestration of your social campaigns.",
    },
    whatFor: {
      fr: "Le centre Agents expose les 8 agents IA spécialisés d'AXON-AI : Stratège, Copywriter, Creative, Media Buyer, Analyste, Conformité, Planificateur et Optimiseur. Depuis cette page vous configurez le brief, le niveau d'autonomie et la cible benchmark, puis lancez un run d'orchestration. La timeline d'exécution détaille chaque étape : statut, sortie et éventuelles erreurs de chaque agent.",
      en: "The Agents center exposes AXON-AI's 8 specialised AI agents: Strategist, Copywriter, Creative, Media Buyer, Analyst, Compliance, Planner and Optimiser. From this page you configure the brief, autonomy level and benchmark target, then launch an orchestration run. The execution timeline details every step: status, output and any errors from each agent.",
    },
    actions: [
      {
        label: { fr: "Choisir la marque active", en: "Choose the active brand" },
        detail: {
          fr: "Le sélecteur de marque en haut de page (pastille couleur + nom) filtre les données et le brief pour l'entité sélectionnée. Changez de marque avant de lancer un run pour cibler la bonne entité.",
          en: "The brand selector at the top of the page (colour dot + name) filters data and the brief for the selected entity. Switch brand before launching a run to target the right entity.",
        },
      },
      {
        label: { fr: "Rédiger l'objectif de campagne", en: "Write the campaign objective" },
        detail: {
          fr: "Dans le panneau de lancement, décrivez votre objectif en langage naturel (ex. : « Augmenter les leads B2B via LinkedIn en Q2 »). Plus le brief est précis, plus les sorties des agents sont exploitables.",
          en: "In the launch panel, describe your objective in natural language (e.g. 'Increase B2B leads via LinkedIn in Q2'). The more precise the brief, the more actionable the agent outputs.",
        },
      },
      {
        label: { fr: "Sélectionner le niveau d'autonomie", en: "Select the autonomy level" },
        detail: {
          fr: "Niveau 1 : recommandations uniquement. Niveau 2 : semi-automatique (certaines actions sans validation). Niveau 3 : entièrement automatique. Commencez par le niveau 1.",
          en: "Level 1: recommendations only. Level 2: semi-automatic (some actions without validation). Level 3: fully automatic. Start with level 1.",
        },
      },
      {
        label: { fr: "Définir la cible benchmark", en: "Set the benchmark target" },
        detail: {
          fr: "Indiquez la cible concurrentielle (ex. : « concurrents France secteur santé ») que les agents utiliseront pour calibrer leurs recommandations et évaluer vos performances relatives.",
          en: "Specify the competitive target (e.g. 'France healthcare sector competitors') that agents will use to calibrate their recommendations and assess your relative performance.",
        },
      },
      {
        label: { fr: "Lancer le run d'orchestration", en: "Launch the orchestration run" },
        detail: {
          fr: "Le bouton « Lancer » appelle /api/agents/run et déclenche la séquence des 8 agents. Un indicateur de chargement s'affiche pendant l'exécution (10–30 s). La timeline apparaît dès la fin.",
          en: "The 'Launch' button calls /api/agents/run and triggers the 8-agent sequence. A loading indicator is shown during execution (10–30 s). The timeline appears as soon as it is done.",
        },
      },
      {
        label: { fr: "Lire la timeline d'exécution", en: "Read the execution timeline" },
        detail: {
          fr: "La timeline liste chaque étape avec : nom de l'agent, statut (succès / avertissement / erreur), contenu produit et durée. Développez une étape pour lire la sortie complète de l'agent.",
          en: "The timeline lists each step with: agent name, status (success / warning / error), produced content and duration. Expand a step to read the agent's full output.",
        },
      },
      {
        label: { fr: "Vérifier le statut de conformité", en: "Check compliance status" },
        detail: {
          fr: "L'agent Conformité vérifie chaque contenu produit au regard des règles réglementaires. Un verdict « block » signale un contenu non conforme — examinez la raison avant de le modifier.",
          en: "The Compliance agent checks each produced piece of content against regulatory rules. A 'block' verdict flags non-compliant content — review the reason before editing.",
        },
      },
    ],
    tips: [
      {
        fr: "Activez toujours la relecture humaine (niveau 1 ou 2) pour les contenus à caractère médical ou réglementé.",
        en: "Always enable human review (level 1 or 2) for medical or regulated content.",
      },
      {
        fr: "Fournissez un brief détaillé avec le ton, les mots-clés à inclure et les contraintes pour obtenir des sorties exploitables dès le premier run.",
        en: "Provide a detailed brief with tone, keywords to include and constraints to get actionable outputs from the first run.",
      },
      {
        fr: "Commencez par l'agent Planificateur pour optimiser vos créneaux de publication avant d'introduire les agents de génération de contenu.",
        en: "Start with the Planner agent to optimise your publishing slots before introducing content generation agents.",
      },
      {
        fr: "Les résultats de run sont disponibles dans l'Historique — vous pouvez y retrouver les sorties passées même après navigation.",
        en: "Run results are available in History — you can retrieve past outputs even after navigating away.",
      },
    ],
    faq: [
      {
        q: { fr: "Combien d'agents sont disponibles ?", en: "How many agents are available?" },
        a: {
          fr: "8 agents : Stratège, Copywriter, Creative, Media Buyer, Analyste, Conformité, Planificateur et Optimiseur. Ils s'exécutent toujours en séquence lors d'un run.",
          en: "8 agents: Strategist, Copywriter, Creative, Media Buyer, Analyst, Compliance, Planner and Optimiser. They always run sequentially during a run.",
        },
      },
      {
        q: { fr: "Que faire si un agent retourne une erreur ?", en: "What if an agent returns an error?" },
        a: {
          fr: "Vérifiez la clé API Anthropic dans Connecteurs (variable ANTHROPIC_API_KEY). Si la clé est valide, relancez le run — les erreurs transitoires se résolvent généralement seules.",
          en: "Check the Anthropic API key in Connectors (ANTHROPIC_API_KEY variable). If the key is valid, relaunch the run — transient errors typically resolve on their own.",
        },
      },
      {
        q: { fr: "Les agents peuvent-ils publier directement ?", en: "Can agents publish directly?" },
        a: {
          fr: "Uniquement en niveau 3 (Auto) et si les connecteurs de publication (Facebook, Instagram, LinkedIn) sont configurés avec les droits en écriture.",
          en: "Only at level 3 (Auto) and if publication connectors (Facebook, Instagram, LinkedIn) are configured with write permissions.",
        },
      },
    ],
    related: [
      { label: { fr: "Centre de pilotage", en: "Piloting center" }, href: "/pilotage" },
      { label: { fr: "Automations", en: "Automations" }, href: "/automations" },
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
          fr: "Sélectionnez le pays cible dans la liste déroulante. Ce paramètre filtre les données concurrentielles et oriente l'identification automatique de concurrents vers les acteurs locaux pertinents.",
          en: "Select the target country from the dropdown. This parameter filters competitive data and directs automatic competitor identification towards relevant local players.",
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
          fr: "Sélectionnez le réseau (Instagram, TikTok, YouTube, LinkedIn, X, Facebook), entrez le @handle et un nom affiché optionnel, puis cliquez sur « Ajouter manuellement ». Le compétiteur est sauvegardé en base et persiste entre les sessions.",
          en: "Select the network (Instagram, TikTok, YouTube, LinkedIn, X, Facebook), enter the @handle and an optional display name, then click 'Add manually'. The competitor is saved in the database and persists between sessions.",
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
        fr: "Programmez une analyse hebdomadaire (via Automations) pour suivre l'évolution des tendances concurrentielles dans le temps.",
        en: "Schedule a weekly analysis (via Automations) to track competitive trend evolution over time.",
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
          fr: "Non, c'est une analyse lancée manuellement (ou via Automation). Les données sont collectées au moment du run et restent disponibles jusqu'au prochain run.",
          en: "No, it is an analysis launched manually (or via Automation). Data is collected at run time and remains available until the next run.",
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
      fr: "La page Connecteurs centralise la configuration de toutes les intégrations externes d'AXON-AI : réseaux sociaux (Facebook, Instagram, LinkedIn, TikTok), publicité (Meta Ads), mesure (Meta Pixel + CAPI, Google Analytics 4), IA (Anthropic Claude, Replicate) et veille (YouTube Data API). Chaque connecteur documente ses capacités de lecture (statistiques, insights) et d'écriture (publication, campagnes) ainsi que la procédure pour obtenir les clés nécessaires.",
      en: "The Connectors page centralises the configuration of all AXON-AI external integrations: social networks (Facebook, Instagram, LinkedIn, TikTok), advertising (Meta Ads), measurement (Meta Pixel + CAPI, Google Analytics 4), AI (Anthropic Claude, Replicate) and watch (YouTube Data API). Each connector documents its read (stats, insights) and write (publishing, campaigns) capabilities and the procedure to obtain the required keys.",
    },
    actions: [
      {
        label: { fr: "Configurer un connecteur réseau social", en: "Configure a social network connector" },
        detail: {
          fr: "Développez la carte d'un réseau (Facebook, Instagram, LinkedIn, TikTok), renseignez les champs requis (Page ID, Access Token, Organization URN…) et cliquez sur « Enregistrer ». Le statut passe à « Connecté » si tous les champs obligatoires sont remplis.",
          en: "Expand a network card (Facebook, Instagram, LinkedIn, TikTok), fill in the required fields (Page ID, Access Token, Organization URN…) and click 'Save'. Status switches to 'Connected' when all required fields are filled.",
        },
      },
      {
        label: { fr: "Configurer Meta Ads", en: "Configure Meta Ads" },
        detail: {
          fr: "Renseignez l'Ad Account ID (format act_XXXXXXXXX) et l'Access Token du compte publicitaire pour permettre la lecture des campagnes et performances ainsi que la création de publicités.",
          en: "Fill in the Ad Account ID (format act_XXXXXXXXX) and the advertising account Access Token to enable reading campaign/performance data and creating ads.",
        },
      },
      {
        label: { fr: "Configurer la mesure (Pixel + GA4)", en: "Configure measurement (Pixel + GA4)" },
        detail: {
          fr: "Meta Pixel + CAPI : renseignez le Pixel ID et le CAPI Access Token pour le suivi des conversions navigateur et serveur. GA4 : renseignez le Property ID, Measurement ID et l'API Secret pour les rapports et le Measurement Protocol.",
          en: "Meta Pixel + CAPI: enter the Pixel ID and CAPI Access Token for browser and server-side conversion tracking. GA4: enter the Property ID, Measurement ID and API Secret for reports and the Measurement Protocol.",
        },
      },
      {
        label: { fr: "Configurer les connecteurs IA (Anthropic, Replicate)", en: "Configure AI connectors (Anthropic, Replicate)" },
        detail: {
          fr: "Les connecteurs IA et veille (Anthropic Claude, Replicate, YouTube) utilisent des variables d'environnement (ANTHROPIC_API_KEY, REPLICATE_API_TOKEN, YOUTUBE_API_KEY) et non des champs de formulaire. Suivez les instructions de la carte « envHint » pour les ajouter dans Vercel ou .env.local.",
          en: "AI and watch connectors (Anthropic Claude, Replicate, YouTube) use environment variables (ANTHROPIC_API_KEY, REPLICATE_API_TOKEN, YOUTUBE_API_KEY) rather than form fields. Follow the 'envHint' card instructions to add them in Vercel or .env.local.",
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
          fr: "Le badge de statut (Connecté / En attente / Déconnecté / Simulé) est mis à jour à chaque sauvegarde. Le compteur « X/Y connectés » en haut de chaque groupe donne une vue rapide du taux de configuration.",
          en: "The status badge (Connected / Pending / Disconnected / Simulated) is updated on every save. The 'X/Y connected' counter at the top of each group gives a quick configuration rate view.",
        },
      },
    ],
    tips: [
      {
        fr: "Commencez par configurer Facebook et Instagram (ils partagent le même token Meta) avant les autres réseaux.",
        en: "Start by configuring Facebook and Instagram (they share the same Meta token) before other networks.",
      },
      {
        fr: "Les tokens Facebook/Instagram expirent tous les 60 jours en mode utilisateur. Utilisez un System User Token pour une durée illimitée.",
        en: "Facebook/Instagram tokens expire every 60 days in user mode. Use a System User Token for unlimited duration.",
      },
      {
        fr: "Vérifiez les niveaux de permission (lecture seule vs. publication) pour éviter les erreurs silencieuses lors des publications automatiques.",
        en: "Check permission levels (read-only vs. publishing) to avoid silent errors during automatic publishing.",
      },
      {
        fr: "Les variables d'environnement pour Anthropic et Replicate doivent être ajoutées dans Vercel → Settings → Environment Variables et redéployées pour être prises en compte.",
        en: "Environment variables for Anthropic and Replicate must be added in Vercel → Settings → Environment Variables and redeployed to take effect.",
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
      { label: { fr: "Agents IA", en: "AI agents" }, href: "/agents" },
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
      fr: "L'éditeur de composition vous permet de rédiger, illustrer et cibler un post pour Facebook, Instagram ou LinkedIn. Vous pouvez publier immédiatement, programmer à une date précise ou sauvegarder en brouillon dans la Bibliothèque. L'assistant IA intégré génère des variantes de texte adaptées à chaque réseau et l'aperçu en temps réel respecte les contraintes de format de chaque plateforme.",
      en: "The composition editor lets you write, illustrate and target a post for Facebook, Instagram or LinkedIn. You can publish immediately, schedule for a specific date or save as a draft in the Library. The built-in AI assistant generates text variants adapted to each network and the real-time preview respects each platform's format constraints.",
    },
    actions: [
      {
        label: { fr: "Choisir les réseaux cibles", en: "Choose target networks" },
        detail: {
          fr: "Cochez un ou plusieurs réseaux sociaux en haut du formulaire. L'aperçu se met à jour pour refléter les contraintes de format propres à chaque plateforme (longueur du texte, ratio d'image).",
          en: "Check one or more social networks at the top of the form. The preview updates to reflect each platform's format constraints (text length, image ratio).",
        },
      },
      {
        label: { fr: "Rédiger le texte du post", en: "Write the post text" },
        detail: {
          fr: "Utilisez l'éditeur de texte principal pour rédiger votre contenu. Un compteur de caractères indique si vous approchez de la limite de chaque réseau sélectionné.",
          en: "Use the main text editor to write your content. A character counter indicates when you are approaching each selected network's limit.",
        },
      },
      {
        label: { fr: "Générer du contenu avec l'IA", en: "Generate content with AI" },
        detail: {
          fr: "L'icône étoile ouvre l'assistant IA. Décrivez votre intention en quelques mots et l'IA génère une proposition de texte adaptée au réseau et à la brand voice configurée.",
          en: "The star icon opens the AI assistant. Describe your intent in a few words and the AI generates a text proposal adapted to the network and the configured brand voice.",
        },
      },
      {
        label: { fr: "Ajouter des médias", en: "Add media" },
        detail: {
          fr: "Glissez-déposez une image ou une vidéo, ou sélectionnez un média depuis la Bibliothèque. Les formats acceptés et les dimensions recommandées sont indiqués dynamiquement selon le réseau choisi.",
          en: "Drag and drop an image or video, or select media from the Library. Accepted formats and recommended dimensions are shown dynamically based on the selected network.",
        },
      },
      {
        label: { fr: "Programmer la publication", en: "Schedule the post" },
        detail: {
          fr: "Cliquez sur « Programmer » pour choisir une date et une heure précises. Le post passe dans l'onglet « Publications programmées » et sera publié automatiquement à l'heure indiquée.",
          en: "Click 'Schedule' to choose a specific date and time. The post moves to the 'Scheduled posts' tab and will be published automatically at the indicated time.",
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
        label: { fr: "Sauvegarder en brouillon", en: "Save as draft" },
        detail: {
          fr: "Le bouton « Enregistrer en brouillon » stocke le contenu dans la Bibliothèque, prêt à être réutilisé ou modifié ultérieurement sans délai de publication.",
          en: "The 'Save as draft' button stores the content in the Library, ready to be reused or edited later without any publishing delay.",
        },
      },
      {
        label: { fr: "Cibler une audience", en: "Target an audience" },
        detail: {
          fr: "Pour LinkedIn, sélectionnez un segment défini dans la page Audiences pour restreindre la portée du post à un groupe professionnel spécifique.",
          en: "For LinkedIn, select a segment defined in the Audiences page to restrict the post's reach to a specific professional group.",
        },
      },
    ],
    tips: [
      {
        fr: "Rédigez d'abord pour le réseau avec les contraintes les plus strictes (Twitter/X : 280 caractères), puis adaptez pour les autres.",
        en: "Write first for the network with the strictest constraints (Twitter/X: 280 characters), then adapt for the others.",
      },
      {
        fr: "Utilisez l'assistant IA pour générer 3 variantes et choisir la meilleure plutôt que de partir de zéro.",
        en: "Use the AI assistant to generate 3 variants and choose the best one rather than starting from scratch.",
      },
      {
        fr: "Les médias ajoutés sont automatiquement redimensionnés selon les spécifications du réseau sélectionné — vérifiez quand même l'aperçu.",
        en: "Added media is automatically resized according to the selected network's specs — still check the preview.",
      },
      {
        fr: "Sauvegardez régulièrement en brouillon pour ne pas perdre votre travail en cas de rechargement de page.",
        en: "Save regularly as draft to avoid losing your work if the page reloads.",
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
          fr: "Oui, en cochant plusieurs réseaux dans le sélecteur. Chaque réseau reçoit le même contenu — adaptez le texte via l'IA si les contraintes de format diffèrent.",
          en: "Yes, by checking multiple networks in the selector. Each network receives the same content — adapt the text via AI if format constraints differ.",
        },
      },
    ],
    related: [
      { label: { fr: "Publications programmées", en: "Scheduled posts" }, href: "/scheduled" },
      { label: { fr: "Bibliothèque", en: "Library" }, href: "/library" },
      { label: { fr: "Audiences", en: "Audiences" }, href: "/audiences" },
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
      fr: "Les publications programmées listent l'ensemble des posts planifiés, triés par date de diffusion. Vous pouvez les modifier, les déprogrammer, changer leur créneau ou les réorganiser. La vue calendrier facilite la détection des jours sans publication et garantit la cohérence éditoriale avant diffusion.",
      en: "Scheduled posts list all planned posts sorted by publication date. You can edit, unschedule, reschedule or reorganise them. The calendar view makes it easy to spot days with no posts and ensures editorial consistency before publishing.",
    },
    actions: [
      {
        label: { fr: "Modifier un post programmé", en: "Edit a scheduled post" },
        detail: {
          fr: "Cliquez sur la carte d'un post pour ouvrir l'éditeur pré-rempli. Toutes les modifications sont sauvegardées et le post reste programmé à la même date sauf si vous la changez.",
          en: "Click a post card to open the pre-filled editor. All changes are saved and the post remains scheduled for the same date unless you change it.",
        },
      },
      {
        label: { fr: "Reprogrammer par glisser-déposer", en: "Reschedule by drag and drop" },
        detail: {
          fr: "En vue calendrier, faites glisser un post sur un nouveau créneau pour le reprogrammer instantanément. La modification est confirmée par une notification verte.",
          en: "In calendar view, drag a post to a new slot to reschedule it instantly. The change is confirmed by a green notification.",
        },
      },
      {
        label: { fr: "Déprogrammer un post", en: "Unschedule a post" },
        detail: {
          fr: "Le bouton « Déprogrammer » transforme le post en brouillon dans la Bibliothèque. Il n'est pas supprimé et reste modifiable à tout moment.",
          en: "The 'Unschedule' button converts the post to a draft in the Library. It is not deleted and remains editable at any time.",
        },
      },
      {
        label: { fr: "Filtrer par marque ou réseau", en: "Filter by brand or network" },
        detail: {
          fr: "Utilisez les filtres en haut pour afficher uniquement les publications d'une marque ou d'un réseau précis. Utile pour vérifier la charge de publication d'une entité spécifique.",
          en: "Use the top filters to display only posts for a specific brand or network. Useful to check the publishing load for a specific entity.",
        },
      },
      {
        label: { fr: "Basculer entre vue liste et vue calendrier", en: "Switch between list and calendar view" },
        detail: {
          fr: "Le sélecteur de vue permet de passer d'une liste chronologique à un calendrier mensuel ou hebdomadaire pour une vision éditoriale globale.",
          en: "The view selector switches from a chronological list to a monthly or weekly calendar for a global editorial view.",
        },
      },
    ],
    tips: [
      {
        fr: "Activez la vue « Semaine » pour détecter les jours sans publication et combler les vides de votre calendrier éditorial.",
        en: "Enable the 'Week' view to detect days with no posts and fill gaps in your editorial calendar.",
      },
      {
        fr: "Un code couleur par marque vous permet de voir d'un coup d'œil quelle marque publie quand, sans confusion.",
        en: "A colour code per brand lets you see at a glance which brand publishes when, without confusion.",
      },
      {
        fr: "Planifiez les posts importants (lancement, événement) au moins 48h à l'avance pour avoir le temps de les ajuster si nécessaire.",
        en: "Schedule important posts (launch, event) at least 48h in advance to have time to adjust them if needed.",
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
        q: { fr: "Les automations peuvent-elles créer des posts programmés ?", en: "Can automations create scheduled posts?" },
        a: {
          fr: "Oui, une automation de type « cycle récurrent » peut générer et programmer automatiquement des posts selon une fréquence définie.",
          en: "Yes, a 'recurring cycle' automation can automatically generate and schedule posts according to a defined frequency.",
        },
      },
    ],
    related: [
      { label: { fr: "Composer un post", en: "Compose a post" }, href: "/compose" },
      { label: { fr: "Automations", en: "Automations" }, href: "/automations" },
      { label: { fr: "Historique", en: "History" }, href: "/history" },
    ],
  },

  // ── /library ────────────────────────────────────────────────────────────────
  "/library": {
    title: {
      fr: "Bibliothèque",
      en: "Library",
    },
    tagline: {
      fr: "Stockez, organisez et réutilisez vos contenus et modèles.",
      en: "Store, organise and reuse your content and templates.",
    },
    whatFor: {
      fr: "La Bibliothèque centralise tous vos brouillons, modèles de posts, visuels validés et contenus archivés. Vous pouvez filtrer par marque, réseau, statut ou tag pour retrouver rapidement un contenu existant et l'adapter sans repartir de zéro. C'est le centre de réutilisation des actifs éditoriaux de votre organisation.",
      en: "The Library centralises all your drafts, post templates, approved visuals and archived content. You can filter by brand, network, status or tag to quickly find existing content and adapt it without starting from scratch. It is the editorial asset reuse centre for your organisation.",
    },
    actions: [
      {
        label: { fr: "Rechercher et filtrer", en: "Search and filter" },
        detail: {
          fr: "Utilisez la barre de recherche plein texte et les filtres (marque, réseau, tag, statut, date) pour localiser précisément un contenu. La recherche est en temps réel.",
          en: "Use the full-text search bar and filters (brand, network, tag, status, date) to precisely locate content. Search is real-time.",
        },
      },
      {
        label: { fr: "Dupliquer un contenu", en: "Duplicate content" },
        detail: {
          fr: "Le bouton « Dupliquer » crée une copie modifiable du post ou du modèle sélectionné, utile pour décliner un format qui a bien fonctionné vers une autre marque ou réseau.",
          en: "The 'Duplicate' button creates an editable copy of the selected post or template, useful for adapting a successful format to another brand or network.",
        },
      },
      {
        label: { fr: "Créer un modèle depuis un brouillon", en: "Create a template from a draft" },
        detail: {
          fr: "Depuis n'importe quel brouillon, cliquez sur « Enregistrer comme modèle » pour le rendre disponible dans Composer et accélérer la production future de contenus similaires.",
          en: "From any draft, click 'Save as template' to make it available in Composer and speed up future production of similar content.",
        },
      },
      {
        label: { fr: "Archiver un contenu", en: "Archive content" },
        detail: {
          fr: "L'archivage retire le contenu de la vue principale tout en le conservant indéfiniment. Les contenus archivés sont accessibles via le filtre « Archivé » — préférez archiver plutôt que supprimer.",
          en: "Archiving removes content from the main view while keeping it indefinitely. Archived content is accessible via the 'Archived' filter — prefer archiving over deleting.",
        },
      },
      {
        label: { fr: "Ouvrir un contenu dans Composer", en: "Open content in Composer" },
        detail: {
          fr: "Cliquez sur « Modifier » sur un brouillon ou modèle pour l'ouvrir dans l'éditeur Composer pré-rempli. Vous pouvez alors le modifier et le programmer ou le publier directement.",
          en: "Click 'Edit' on a draft or template to open it in the pre-filled Composer editor. You can then modify and schedule or publish it directly.",
        },
      },
      {
        label: { fr: "Gérer les tags", en: "Manage tags" },
        detail: {
          fr: "Ajoutez, modifiez ou supprimez des tags depuis la fiche d'un contenu. Les tags sont libres — définissez une convention interne (ex. : campagne-été, produit-X) pour faciliter les recherches futures.",
          en: "Add, edit or remove tags from a content card. Tags are free-form — define an internal convention (e.g. summer-campaign, product-X) to facilitate future searches.",
        },
      },
    ],
    tips: [
      {
        fr: "Taggez systématiquement vos contenus dès la création pour retrouver les assets d'une campagne en quelques secondes.",
        en: "Tag your content systematically at creation time so you can find campaign assets in seconds.",
      },
      {
        fr: "Les contenus archivés sont conservés indéfiniment — pensez à archiver plutôt que supprimer pour garder une trace historique exploitable.",
        en: "Archived content is kept indefinitely — prefer archiving over deleting to maintain a usable historical record.",
      },
      {
        fr: "Créez des modèles pour vos formats récurrents (post de lancement produit, post d'événement) et partagez-les avec toute votre équipe.",
        en: "Create templates for your recurring formats (product launch post, event post) and share them with your whole team.",
      },
    ],
    faq: [
      {
        q: { fr: "Quelle différence entre un brouillon et un modèle ?", en: "What is the difference between a draft and a template?" },
        a: {
          fr: "Un brouillon est un contenu en cours de rédaction, destiné à une publication spécifique. Un modèle est un contenu réutilisable, sans date ni réseau fixe, utilisé comme base dans Composer.",
          en: "A draft is content being written, intended for a specific publication. A template is reusable content, with no fixed date or network, used as a base in Composer.",
        },
      },
      {
        q: { fr: "La Bibliothèque est-elle partagée entre toutes les marques ?", en: "Is the Library shared across all brands?" },
        a: {
          fr: "Non, chaque marque dispose de sa propre bibliothèque. Le filtre de marque en haut permet de passer de l'une à l'autre.",
          en: "No, each brand has its own library. The brand filter at the top lets you switch between them.",
        },
      },
    ],
    related: [
      { label: { fr: "Composer un post", en: "Compose a post" }, href: "/compose" },
      { label: { fr: "Campagnes", en: "Campaigns" }, href: "/campaigns" },
      { label: { fr: "Historique", en: "History" }, href: "/history" },
    ],
  },

  // ── /automations ────────────────────────────────────────────────────────────
  "/automations": {
    title: {
      fr: "Automations",
      en: "Automations",
    },
    tagline: {
      fr: "Automatisez les actions répétitives et les workflows éditoriaux.",
      en: "Automate repetitive actions and editorial workflows.",
    },
    whatFor: {
      fr: "Les automations permettent de créer des règles qui déclenchent des actions automatiques sans intervention manuelle : republication d'un top-post, notification lorsqu'un seuil d'engagement est atteint, cycle de publication récurrent ou déclenchement d'un run d'agents IA. Chaque automation est auditable, suspendable et modifiable sans suppression.",
      en: "Automations allow you to create rules that trigger automatic actions without manual intervention: republishing a top post, notifying when an engagement threshold is reached, running a recurring publication cycle or triggering an AI agents run. Each automation is auditable, suspendable and editable without deletion.",
    },
    actions: [
      {
        label: { fr: "Créer une automation", en: "Create an automation" },
        detail: {
          fr: "Cliquez sur « Nouvelle automation », choisissez un déclencheur (calendrier, seuil de métrique, événement externe) et définissez l'action associée. Un résumé en langage naturel confirme la logique configurée avant l'activation.",
          en: "Click 'New automation', choose a trigger (schedule, metric threshold, external event) and define the associated action. A natural language summary confirms the configured logic before activation.",
        },
      },
      {
        label: { fr: "Activer ou suspendre une automation", en: "Activate or suspend an automation" },
        detail: {
          fr: "Le toggle à droite de chaque automation l'active ou la suspend sans la supprimer. Les automations suspendues sont listées en gris et réactivables à tout moment.",
          en: "The toggle to the right of each automation activates or suspends it without deleting it. Suspended automations are listed in grey and can be reactivated at any time.",
        },
      },
      {
        label: { fr: "Modifier une automation existante", en: "Edit an existing automation" },
        detail: {
          fr: "Cliquez sur le nom ou l'icône d'édition d'une automation pour ouvrir le formulaire de configuration. Les modifications sont appliquées au prochain déclenchement.",
          en: "Click the name or edit icon of an automation to open the configuration form. Changes are applied on the next trigger.",
        },
      },
      {
        label: { fr: "Consulter le journal d'exécution", en: "View the execution log" },
        detail: {
          fr: "Chaque automation affiche son dernier déclenchement, son résultat (succès / échec) et la durée. Cliquez sur « Voir les logs » pour accéder au détail complet de chaque exécution.",
          en: "Each automation shows its last trigger, result (success / failure) and duration. Click 'View logs' to access the full detail of each execution.",
        },
      },
      {
        label: { fr: "Supprimer une automation", en: "Delete an automation" },
        detail: {
          fr: "Le bouton « Supprimer » retire définitivement l'automation. Préférez la suspension si vous souhaitez conserver la configuration pour une réactivation future.",
          en: "The 'Delete' button permanently removes the automation. Prefer suspending if you want to keep the configuration for future reactivation.",
        },
      },
    ],
    tips: [
      {
        fr: "Commencez par automatiser la republication hebdomadaire de vos meilleurs posts — c'est le cas d'usage le plus rapide à configurer et le plus rentable.",
        en: "Start by automating the weekly republication of your best posts — it's the quickest use case to configure and the most cost-effective.",
      },
      {
        fr: "Testez une automation sur une marque secondaire avant de la déployer sur votre marque principale.",
        en: "Test an automation on a secondary brand before deploying it on your main brand.",
      },
      {
        fr: "Configurez une alerte automation (webhook ou email) pour être notifié immédiatement en cas d'échec d'exécution.",
        en: "Configure an automation alert (webhook or email) to be notified immediately on execution failure.",
      },
    ],
    faq: [
      {
        q: { fr: "Une automation peut-elle déclencher un run d'agents IA ?", en: "Can an automation trigger an AI agents run?" },
        a: {
          fr: "Oui, en choisissant l'action « Lancer un cycle de pilotage IA » lors de la configuration. Les recommandations générées apparaissent dans le centre de pilotage.",
          en: "Yes, by choosing the action 'Launch an AI piloting cycle' during configuration. Generated recommendations appear in the piloting center.",
        },
      },
      {
        q: { fr: "Combien d'automations puis-je créer ?", en: "How many automations can I create?" },
        a: {
          fr: "Le nombre dépend de votre abonnement. Consultez la page Paramètres pour connaître les limites de votre plan.",
          en: "The number depends on your subscription. Check the Settings page to see your plan's limits.",
        },
      },
    ],
    related: [
      { label: { fr: "Publications programmées", en: "Scheduled posts" }, href: "/scheduled" },
      { label: { fr: "Agents IA", en: "AI agents" }, href: "/agents" },
      { label: { fr: "Historique", en: "History" }, href: "/history" },
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
      fr: "L'Historique archive l'intégralité des posts publiés avec leur date, réseau, statut (succès / échec) et métriques d'engagement post-publication. Vous pouvez filtrer, exporter ou relancer un post existant directement depuis cet écran. C'est la mémoire éditoriale de votre organisation.",
      en: "History archives all published posts with their date, network, status (success / failure) and post-publication engagement metrics. You can filter, export or relaunch an existing post directly from this screen. It is your organisation's editorial memory.",
    },
    actions: [
      {
        label: { fr: "Filtrer par période, réseau et statut", en: "Filter by period, network and status" },
        detail: {
          fr: "Sélectionnez une plage de dates, un ou plusieurs réseaux et un statut (succès, échec, tous) pour affiner la liste. Les filtres s'accumulent et peuvent être réinitialisés d'un clic.",
          en: "Select a date range, one or more networks and a status (success, failure, all) to refine the list. Filters accumulate and can be reset with one click.",
        },
      },
      {
        label: { fr: "Relancer un post existant", en: "Relaunch an existing post" },
        detail: {
          fr: "Le bouton « Réutiliser » ouvre l'éditeur Composer pré-rempli avec le contenu du post sélectionné. Modifiez-le puis programmez ou publiez directement.",
          en: "The 'Reuse' button opens the Composer editor pre-filled with the selected post's content. Edit it then schedule or publish directly.",
        },
      },
      {
        label: { fr: "Exporter les données", en: "Export data" },
        detail: {
          fr: "Exportez l'historique filtré en CSV pour l'intégrer dans un rapport externe, votre outil de BI ou un audit de performance.",
          en: "Export the filtered history as CSV to integrate it in an external report, your BI tool or a performance audit.",
        },
      },
      {
        label: { fr: "Consulter les métriques d'un post", en: "View a post's metrics" },
        detail: {
          fr: "Cliquez sur un post pour ouvrir sa fiche détaillée : impressions, portée, likes, commentaires, partages et taux d'engagement sur les 7 jours suivant la publication.",
          en: "Click a post to open its detail sheet: impressions, reach, likes, comments, shares and engagement rate over the 7 days following publication.",
        },
      },
      {
        label: { fr: "Republier un post en échec", en: "Republish a failed post" },
        detail: {
          fr: "Les posts marqués « Échec » peuvent être republié via « Réutiliser ». Vérifiez d'abord que le connecteur concerné est correctement configuré dans la page Connecteurs.",
          en: "Posts marked 'Failure' can be republished via 'Reuse'. First check that the relevant connector is correctly configured in the Connectors page.",
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
      {
        fr: "Utilisez l'export CSV mensuel pour construire vos rapports de performance et les partager avec votre direction.",
        en: "Use the monthly CSV export to build your performance reports and share them with management.",
      },
    ],
    faq: [
      {
        q: { fr: "L'historique inclut-il les posts publiés par les automations ?", en: "Does history include posts published by automations?" },
        a: {
          fr: "Oui, tous les posts publiés via AXON-AI — manuellement ou automatiquement — apparaissent dans l'Historique.",
          en: "Yes, all posts published via AXON-AI — manually or automatically — appear in History.",
        },
      },
      {
        q: { fr: "Combien de temps les données sont-elles conservées ?", en: "How long is data retained?" },
        a: {
          fr: "L'historique est conservé indéfiniment dans votre compte. Les métriques d'engagement sont mises à jour pendant 7 jours après publication, puis figées.",
          en: "History is kept indefinitely in your account. Engagement metrics are updated for 7 days after publication, then frozen.",
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
      fr: "Une campagne regroupe un ensemble de posts organiques, d'annonces payantes et d'audiences autour d'un objectif commun (lancement produit, événement, sensibilisation). L'écran Campagnes offre une vue consolidée du budget, de la portée cumulée, du taux de réalisation et de l'avancement de chaque campagne active, répartis par marque et par canal.",
      en: "A campaign groups together a set of organic posts, paid ads and audiences around a common objective (product launch, event, awareness). The Campaigns screen offers a consolidated view of budget, cumulative reach, completion rate and progress of each active campaign, broken down by brand and channel.",
    },
    actions: [
      {
        label: { fr: "Créer une campagne", en: "Create a campaign" },
        detail: {
          fr: "Définissez un nom, des dates de début et de fin, un objectif (notoriété, trafic, conversion) et assignez les marques et réseaux concernés. Les posts programmés dans la même période peuvent être rattachés à la campagne.",
          en: "Define a name, start and end dates, an objective (awareness, traffic, conversion) and assign the relevant brands and networks. Scheduled posts within the same period can be linked to the campaign.",
        },
      },
      {
        label: { fr: "Suivre la progression", en: "Track progress" },
        detail: {
          fr: "La jauge de progression indique le taux de réalisation des publications prévues. Un indicateur budgétaire montre le consommé vs. le budget alloué pour les campagnes payantes.",
          en: "The progress gauge shows the completion rate of planned publications. A budget indicator shows actual spend vs. allocated budget for paid campaigns.",
        },
      },
      {
        label: { fr: "Lier des posts organiques", en: "Link organic posts" },
        detail: {
          fr: "Depuis la fiche campagne, ajoutez des posts organiques existants (depuis la Bibliothèque ou les Publications programmées) à la campagne pour consolider les métriques.",
          en: "From the campaign card, add existing organic posts (from the Library or Scheduled posts) to the campaign to consolidate metrics.",
        },
      },
      {
        label: { fr: "Créer des publicités liées", en: "Create linked ads" },
        detail: {
          fr: "Depuis la fiche campagne, créez de nouvelles publicités payantes directement rattachées à la campagne. Le budget est automatiquement imputé au total de la campagne.",
          en: "From the campaign card, create new paid ads directly linked to the campaign. The budget is automatically charged to the campaign total.",
        },
      },
      {
        label: { fr: "Archiver ou clôturer une campagne", en: "Archive or close a campaign" },
        detail: {
          fr: "À la fin d'une campagne, clôturez-la pour figer les métriques finales. L'archivage la retire de la vue active tout en conservant toutes les données pour les comparaisons futures.",
          en: "At the end of a campaign, close it to freeze the final metrics. Archiving removes it from the active view while keeping all data for future comparisons.",
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
      {
        fr: "Comparez vos campagnes en activant le mode comparaison dans Analytics pour mesurer l'impact réel de chaque itération.",
        en: "Compare your campaigns by enabling comparison mode in Analytics to measure the real impact of each iteration.",
      },
    ],
    faq: [
      {
        q: { fr: "Peut-on associer une campagne à plusieurs marques ?", en: "Can a campaign be associated with multiple brands?" },
        a: {
          fr: "Oui, lors de la création vous pouvez sélectionner plusieurs marques. Les métriques sont alors agrégées au niveau campagne et ventilées par marque dans la fiche détaillée.",
          en: "Yes, during creation you can select multiple brands. Metrics are then aggregated at campaign level and broken down by brand in the detail sheet.",
        },
      },
      {
        q: { fr: "Où voir le détail d'une publicité liée à une campagne ?", en: "Where to see the detail of an ad linked to a campaign?" },
        a: {
          fr: "Depuis la fiche campagne, cliquez sur une publicité pour accéder à sa page dans Performances publicitaires ou Ad Sets.",
          en: "From the campaign card, click an ad to access its page in Ad performance or Ad sets.",
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
      fr: "L'écran Audiences vous permet de créer des segments réutilisables à partir de critères démographiques, comportementaux ou de listes personnalisées. Ces segments sont ensuite utilisables dans Composer (ciblage organique LinkedIn) et dans les campagnes payantes (Facebook Ads, LinkedIn Ads). L'indicateur de taille estimée donne un ordre de grandeur avant de lancer une campagne.",
      en: "The Audiences screen lets you create reusable segments based on demographic, behavioural or custom list criteria. These segments can then be used in Composer (LinkedIn organic targeting) and paid campaigns (Facebook Ads, LinkedIn Ads). The estimated size indicator gives a rough figure before launching a campaign.",
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
          fr: "L'indicateur de taille estimée vous donne un ordre de grandeur de l'audience potentielle sur chaque réseau avant de lancer une campagne payante. Visez 500 000 à 5 M de personnes pour un CPC optimal.",
          en: "The estimated size indicator gives a rough figure for the potential audience on each network before launching a paid campaign. Aim for 500,000 to 5M people for optimal CPC.",
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
      {
        fr: "Segmentez par profession sur LinkedIn pour les campagnes B2B médicales (médecins, pharmaciens, décideurs hospitaliers).",
        en: "Segment by profession on LinkedIn for medical B2B campaigns (doctors, pharmacists, hospital decision-makers).",
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
          fr: "Les e-mails sont hachés (SHA-256) côté serveur avant tout envoi aux APIs Meta/LinkedIn. La liste brute n'est jamais transmise aux plateformes.",
          en: "Emails are hashed (SHA-256) server-side before any transmission to Meta/LinkedIn APIs. The raw list is never transmitted to the platforms.",
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
      fr: "Cet écran agrège les données publicitaires de toutes vos plateformes (Facebook Ads, Instagram Ads, LinkedIn Ads) en un seul tableau de bord. Vous y suivez les dépenses, le coût par clic (CPC), le taux de conversion et le retour sur investissement publicitaire (ROAS) de chaque campagne. Des benchmarks sectoriels sont affichés en référence pour chaque réseau.",
      en: "This screen aggregates advertising data from all your platforms (Facebook Ads, Instagram Ads, LinkedIn Ads) into a single dashboard. You track spend, cost per click (CPC), conversion rate and return on ad spend (ROAS) for each campaign. Industry benchmarks are shown as reference for each network.",
    },
    actions: [
      {
        label: { fr: "Comparer des campagnes", en: "Compare campaigns" },
        detail: {
          fr: "Utilisez le tableau comparatif pour mettre côte à côte deux campagnes ou deux marques sur la même période. Les colonnes sont triables pour identifier rapidement les campagnes les plus performantes.",
          en: "Use the comparison table to place two campaigns or two brands side by side over the same period. Columns are sortable to quickly identify the top-performing campaigns.",
        },
      },
      {
        label: { fr: "Analyser par réseau", en: "Analyse by network" },
        detail: {
          fr: "Filtrez par plateforme pour isoler les performances Facebook, Instagram ou LinkedIn. Chaque réseau affiche ses propres benchmarks sectoriels en ligne de référence.",
          en: "Filter by platform to isolate Facebook, Instagram or LinkedIn performance. Each network displays its own industry benchmarks as a reference line.",
        },
      },
      {
        label: { fr: "Sélectionner la période d'analyse", en: "Select the analysis period" },
        detail: {
          fr: "Le sélecteur de dates permet de choisir n'importe quelle plage : aujourd'hui, les 7 derniers jours, le mois en cours ou une plage personnalisée. Toutes les métriques se recalculent en temps réel.",
          en: "The date picker lets you choose any range: today, last 7 days, current month or a custom range. All metrics recalculate in real time.",
        },
      },
      {
        label: { fr: "Exporter le rapport", en: "Export the report" },
        detail: {
          fr: "Générez un rapport PDF ou CSV de la période sélectionnée, prêt à partager avec votre direction ou votre agence publicitaire.",
          en: "Generate a PDF or CSV report for the selected period, ready to share with management or your advertising agency.",
        },
      },
      {
        label: { fr: "Accéder au détail d'un Ad Set", en: "Access an Ad Set's detail" },
        detail: {
          fr: "Cliquez sur le nom d'une campagne pour accéder à la vue Ad Sets (/ad-sets) et voir les performances de chaque groupe de publicités.",
          en: "Click a campaign name to access the Ad Sets view (/ad-sets) and see the performance of each ad group.",
        },
      },
    ],
    tips: [
      {
        fr: "Un CPC supérieur au benchmark sectoriel (~2–4 € pour le secteur médical) est un signal pour revoir votre ciblage ou vos visuels publicitaires.",
        en: "A CPC above the industry benchmark (~€2–4 for the medical sector) is a signal to review your targeting or ad visuals.",
      },
      {
        fr: "Croisez ces données avec l'Analytics organique pour évaluer l'effet de halo de vos publicités sur l'engagement naturel.",
        en: "Cross these figures with organic Analytics to assess the halo effect of your ads on natural engagement.",
      },
      {
        fr: "Un ROAS > 3 est généralement considéré comme rentable dans le secteur B2B médical — utilisez-le comme seuil de décision pour réallouer les budgets.",
        en: "A ROAS > 3 is generally considered profitable in the medical B2B sector — use it as a decision threshold for budget reallocation.",
      },
    ],
    faq: [
      {
        q: { fr: "Les données sont-elles actualisées en temps réel ?", en: "Is the data updated in real time?" },
        a: {
          fr: "Les données sont importées depuis les APIs Meta et LinkedIn toutes les 6 heures. Un rafraîchissement manuel est possible via le bouton « Actualiser ».",
          en: "Data is imported from Meta and LinkedIn APIs every 6 hours. A manual refresh is available via the 'Refresh' button.",
        },
      },
      {
        q: { fr: "Pourquoi les dépenses affichées diffèrent-elles du Business Manager ?", en: "Why does the displayed spend differ from Business Manager?" },
        a: {
          fr: "Les données AXON-AI peuvent avoir jusqu'à 6h de décalage. Pour les montants exacts en temps réel, consultez directement le Business Manager Meta.",
          en: "AXON-AI data can have up to a 6h lag. For exact real-time figures, check Meta Business Manager directly.",
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
      fr: "L'écran Analytics offre des graphiques détaillés sur l'évolution de la portée, de l'engagement, des abonnés et des clics sur lien pour chaque marque et chaque réseau. Des rapports prédéfinis couvrent les performances hebdomadaires, mensuelles et comparatives entre marques ou entre périodes. Le tableau Top Posts identifie vos contenus les plus performants.",
      en: "The Analytics screen provides detailed charts on the evolution of reach, engagement, followers and link clicks for each brand and network. Pre-defined reports cover weekly, monthly and comparative performance across brands or periods. The Top Posts table identifies your best-performing content.",
    },
    actions: [
      {
        label: { fr: "Choisir la période et la granularité", en: "Choose period and granularity" },
        detail: {
          fr: "Sélectionnez une plage de dates via le sélecteur de période et choisissez la granularité (jour, semaine, mois) pour ajuster le niveau de détail des graphiques.",
          en: "Select a date range via the period picker and choose the granularity (day, week, month) to adjust the chart detail level.",
        },
      },
      {
        label: { fr: "Comparer deux périodes", en: "Compare two periods" },
        detail: {
          fr: "Activez le mode « Comparaison » pour superposer deux périodes sur le même graphique et mesurer l'évolution d'une campagne ou d'un changement de stratégie.",
          en: "Enable 'Comparison' mode to overlay two periods on the same chart and measure the evolution of a campaign or strategy change.",
        },
      },
      {
        label: { fr: "Filtrer par réseau et par marque", en: "Filter by network and brand" },
        detail: {
          fr: "Isolez les données d'un réseau spécifique (Facebook, Instagram, LinkedIn) ou d'une marque pour des analyses ciblées sans pollution par les autres entités.",
          en: "Isolate data for a specific network (Facebook, Instagram, LinkedIn) or brand for targeted analysis without pollution from other entities.",
        },
      },
      {
        label: { fr: "Identifier le meilleur contenu", en: "Identify best content" },
        detail: {
          fr: "Le tableau « Top posts » classe vos publications par taux d'engagement pour la période sélectionnée. Cliquez sur un post pour voir son détail ou le réutiliser dans Composer.",
          en: "The 'Top posts' table ranks your publications by engagement rate for the selected period. Click a post to see its detail or reuse it in Composer.",
        },
      },
      {
        label: { fr: "Exporter un rapport Analytics", en: "Export an Analytics report" },
        detail: {
          fr: "Exportez les graphiques et tableaux en PDF ou les données brutes en CSV pour intégration dans vos outils de reporting internes.",
          en: "Export charts and tables as PDF or raw data as CSV for integration into your internal reporting tools.",
        },
      },
      {
        label: { fr: "Lire les rapports prédéfinis", en: "Read pre-defined reports" },
        detail: {
          fr: "Les rapports « Semaine » et « Mois » sont préconfigurés et se chargent en un clic. Ils incluent un résumé exécutif des variations principales et des recommandations automatiques.",
          en: "The 'Week' and 'Month' reports are pre-configured and load in one click. They include an executive summary of main variations and automatic recommendations.",
        },
      },
    ],
    tips: [
      {
        fr: "Consultez les analytics le lendemain d'une publication importante : les 24 premières heures donnent 80 % de l'engagement final.",
        en: "Check analytics the day after an important publication: the first 24 hours account for 80% of the final engagement.",
      },
      {
        fr: "Un taux d'engagement > 3 % sur LinkedIn est excellent dans le secteur médical — utilisez-le comme seuil de référence pour valider vos formats.",
        en: "An engagement rate > 3% on LinkedIn is excellent in the medical sector — use it as a reference threshold to validate your formats.",
      },
      {
        fr: "Le mode comparaison est idéal pour mesurer l'impact d'un changement de fréquence de publication ou d'un nouveau format visuel.",
        en: "Comparison mode is ideal for measuring the impact of a posting frequency change or a new visual format.",
      },
    ],
    faq: [
      {
        q: { fr: "Les analytics incluent-ils les données payantes ?", en: "Do analytics include paid data?" },
        a: {
          fr: "Non, la page Analytics couvre uniquement les performances organiques. Pour les données payantes, rendez-vous dans Performances publicitaires.",
          en: "No, the Analytics page covers only organic performance. For paid data, go to Ad performance.",
        },
      },
      {
        q: { fr: "À quelle fréquence les données sont-elles mises à jour ?", en: "How often is data updated?" },
        a: {
          fr: "Les données organiques sont rafraîchies toutes les 6 heures depuis les APIs des plateformes. Un rafraîchissement manuel est disponible.",
          en: "Organic data is refreshed every 6 hours from platform APIs. A manual refresh is available.",
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
      fr: "L'écran Comptes liste tous les comptes de réseaux sociaux connectés à AXON-AI pour chacune de vos marques. Vous pouvez ajouter de nouveaux comptes, reconnecter un compte dont le token a expiré ou révoquer un accès. Le statut de chaque connexion est visible en temps réel et les alertes signalent proactivement les tokens à renouveler.",
      en: "The Accounts screen lists all social network accounts connected to AXON-AI for each of your brands. You can add new accounts, reconnect an account whose token has expired or revoke access. Each connection's status is visible in real time and alerts proactively flag tokens that need renewal.",
    },
    actions: [
      {
        label: { fr: "Connecter un nouveau compte", en: "Connect a new account" },
        detail: {
          fr: "Cliquez sur « Ajouter un compte », sélectionnez la plateforme (Facebook, Instagram, LinkedIn…) et suivez le flux OAuth. Les permissions requises sont listées avant validation pour assurer la transparence.",
          en: "Click 'Add account', select the platform (Facebook, Instagram, LinkedIn…) and follow the OAuth flow. Required permissions are listed before confirmation to ensure transparency.",
        },
      },
      {
        label: { fr: "Reconnecter un compte expiré", en: "Reconnect an expired account" },
        detail: {
          fr: "Un badge rouge « Token expiré » signale les connexions à renouveler. Cliquez sur « Reconnecter » pour relancer le flux d'authentification sans perdre les publications programmées.",
          en: "A red 'Token expired' badge flags connections to renew. Click 'Reconnect' to restart the authentication flow without losing scheduled posts.",
        },
      },
      {
        label: { fr: "Révoquer un accès", en: "Revoke access" },
        detail: {
          fr: "Le bouton « Déconnecter » supprime le token d'accès côté AXON-AI. Pensez également à révoquer les permissions depuis les paramètres de la plateforme concernée.",
          en: "The 'Disconnect' button removes the access token on the AXON-AI side. Also remember to revoke permissions from the settings of the relevant platform.",
        },
      },
      {
        label: { fr: "Vérifier les niveaux de permission", en: "Check permission levels" },
        detail: {
          fr: "Pour chaque compte, la liste des permissions accordées (lecture seule, publication, gestion des publicités) est affichée. Un niveau insuffisant peut causer des échecs silencieux lors des publications.",
          en: "For each account, the list of granted permissions (read-only, publishing, ad management) is displayed. An insufficient level can cause silent failures during publications.",
        },
      },
    ],
    tips: [
      {
        fr: "Les tokens Facebook et Instagram expirent tous les 60 jours — programmez un rappel mensuel pour les renouveler avant qu'ils n'impactent vos publications.",
        en: "Facebook and Instagram tokens expire every 60 days — schedule a monthly reminder to renew them before they impact your publications.",
      },
      {
        fr: "Utilisez un System User Token (Meta Business Manager) pour une durée de token illimitée sur Facebook et Instagram.",
        en: "Use a System User Token (Meta Business Manager) for unlimited token duration on Facebook and Instagram.",
      },
      {
        fr: "Après une révocation, vérifiez que les automations concernées ne tentent pas de publier avec l'ancien token — suspendez-les si nécessaire.",
        en: "After revoking, check that concerned automations are not trying to publish with the old token — suspend them if necessary.",
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
      { label: { fr: "Paramètres", en: "Settings" }, href: "/settings" },
      { label: { fr: "Automations", en: "Automations" }, href: "/automations" },
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
      fr: "Les paramètres regroupent la configuration générale de l'application : gestion des marques et des entités, préférences de notification, fuseaux horaires, accès des membres de l'équipe, rôles et permissions, intégrations webhook et API. C'est également ici que vous gérez votre abonnement, vos données de facturation et les options de conformité RGPD.",
      en: "Settings group the application's general configuration: brand and entity management, notification preferences, time zones, team member access, roles and permissions, webhook and API integrations. This is also where you manage your subscription, billing data and GDPR compliance options.",
    },
    actions: [
      {
        label: { fr: "Gérer les marques", en: "Manage brands" },
        detail: {
          fr: "Ajoutez, renommez ou archivez une marque. Chaque marque dispose de son propre espace de données, de ses comptes connectés et de sa brand voice.",
          en: "Add, rename or archive a brand. Each brand has its own data space, connected accounts and brand voice.",
        },
      },
      {
        label: { fr: "Inviter des collaborateurs", en: "Invite collaborators" },
        detail: {
          fr: "Envoyez des invitations par e-mail et assignez des rôles : Administrateur (accès total), Éditeur (composer et programmer), Lecteur (consultation seule). Les invitations expirent après 7 jours.",
          en: "Send email invitations and assign roles: Administrator (full access), Editor (compose and schedule), Reader (view-only). Invitations expire after 7 days.",
        },
      },
      {
        label: { fr: "Configurer les notifications", en: "Configure notifications" },
        detail: {
          fr: "Choisissez les événements déclencheurs (publication réussie, échec, seuil d'engagement, token expiré) et le canal de livraison (e-mail, notification in-app, webhook Slack).",
          en: "Choose trigger events (successful publication, failure, engagement threshold, expired token) and delivery channel (email, in-app notification, Slack webhook).",
        },
      },
      {
        label: { fr: "Définir le fuseau horaire", en: "Set the time zone" },
        detail: {
          fr: "Configurez le fuseau horaire par défaut au niveau de chaque marque. Les publications programmées respectent le fuseau de la marque — essentiel pour les équipes multi-pays.",
          en: "Configure the default time zone at brand level. Scheduled posts respect the brand's time zone — essential for multi-country teams.",
        },
      },
      {
        label: { fr: "Activer les webhooks sortants", en: "Enable outbound webhooks" },
        detail: {
          fr: "Configurez une URL de webhook pour recevoir les événements AXON-AI (publication, alerte, run d'agent) dans votre CRM, Slack ou outil de reporting interne.",
          en: "Configure a webhook URL to receive AXON-AI events (publication, alert, agent run) in your CRM, Slack or internal reporting tool.",
        },
      },
      {
        label: { fr: "Gérer l'abonnement et la facturation", en: "Manage subscription and billing" },
        detail: {
          fr: "Consultez votre plan actuel, les limites d'utilisation (automations, runs d'agents) et gérez vos informations de paiement depuis l'onglet Facturation.",
          en: "View your current plan, usage limits (automations, agent runs) and manage your payment information from the Billing tab.",
        },
      },
    ],
    tips: [
      {
        fr: "Définissez le fuseau horaire au niveau de chaque marque si vos équipes travaillent dans des zones géographiques différentes.",
        en: "Define the time zone at brand level if your teams work across different geographic zones.",
      },
      {
        fr: "Activez les webhooks sortants pour intégrer AXON-AI à votre CRM ou à votre outil de reporting — un simple endpoint HTTP suffit.",
        en: "Enable outbound webhooks to integrate AXON-AI with your CRM or reporting tool — a simple HTTP endpoint is enough.",
      },
      {
        fr: "Limitez le rôle Éditeur aux collaborateurs qui publient effectivement — le rôle Lecteur est suffisant pour les clients en accès consultation.",
        en: "Limit the Editor role to collaborators who actually publish — the Reader role is sufficient for clients with view-only access.",
      },
    ],
    faq: [
      {
        q: { fr: "Puis-je avoir des paramètres différents par marque ?", en: "Can I have different settings per brand?" },
        a: {
          fr: "Oui, certains paramètres (fuseau horaire, brand voice, notifications) sont configurables par marque. D'autres (facturation, rôles globaux) s'appliquent à l'ensemble du compte.",
          en: "Yes, some settings (time zone, brand voice, notifications) are configurable per brand. Others (billing, global roles) apply to the whole account.",
        },
      },
      {
        q: { fr: "Comment révoquer l'accès d'un collaborateur ?", en: "How to revoke a collaborator's access?" },
        a: {
          fr: "Dans l'onglet Équipe, trouvez le collaborateur et cliquez sur « Révoquer l'accès ». La session est fermée immédiatement et l'utilisateur ne peut plus se connecter.",
          en: "In the Team tab, find the collaborator and click 'Revoke access'. The session is closed immediately and the user can no longer log in.",
        },
      },
    ],
    related: [
      { label: { fr: "Comptes connectés", en: "Connected accounts" }, href: "/accounts" },
      { label: { fr: "Connecteurs", en: "Connectors" }, href: "/parametres-connecteurs" },
      { label: { fr: "Tableau de bord", en: "Dashboard" }, href: "/dashboard" },
    ],
  },

  // ── /demarrage ──────────────────────────────────────────────────────────────
  "/demarrage": {
    title: { fr: "Démarrage guidé", en: "Guided onboarding" },
    tagline: {
      fr: "Votre parcours pas-à-pas pour devenir totalement autonome.",
      en: "Your step-by-step path to becoming fully autonomous.",
    },
    whatFor: {
      fr: "Le démarrage guidé est conçu pour qu'un nouveau client puisse mettre son compte en pilotage automatique sans aucune assistance. Il enchaîne, dans le bon ordre, les 6 étapes essentielles : connecter ses réseaux, analyser son marché, fixer un objectif et lancer les agents, créer et programmer du contenu, activer le bot Telegram, puis brancher Claude (MCP). Une barre de progression indique en temps réel ce qui est déjà fait (réseaux connectés, Telegram activé) et ce qu'il reste à faire. Chaque étape comporte un bouton qui ouvre directement la page concernée.",
      en: "Guided onboarding is designed so a new client can put their account on autopilot with zero assistance. It walks, in the right order, through the 6 essential steps: connect your networks, analyse your market, set an objective and launch the agents, create and schedule content, activate the Telegram bot, then connect Claude (MCP). A progress bar shows in real time what is already done (networks connected, Telegram activated) and what remains. Each step has a button that opens the relevant page directly.",
    },
    actions: [
      {
        label: { fr: "Suivre les étapes dans l'ordre", en: "Follow the steps in order" },
        detail: {
          fr: "Chaque carte numérotée décrit une étape, son utilité et l'action concrète à réaliser. Cliquez sur le bouton de la carte pour ouvrir la page correspondante, faites l'action, puis revenez : la pastille devient verte une fois l'étape accomplie.",
          en: "Each numbered card describes a step, its purpose and the concrete action to take. Click the card button to open the matching page, perform the action, then come back: the dot turns green once the step is complete.",
        },
      },
      {
        label: { fr: "Suivre votre progression", en: "Track your progress" },
        detail: {
          fr: "La barre de progression en haut compte les étapes actionnables réalisées (réseaux connectés, Telegram activé). Les étapes « À explorer » sont des découvertes recommandées qui ne bloquent pas la progression.",
          en: "The progress bar at the top counts completed actionable steps (networks connected, Telegram activated). 'To explore' steps are recommended discoveries that do not block progress.",
        },
      },
    ],
    tips: [
      {
        fr: "Ne sautez pas l'étape 1 (Connecteurs) : sans réseaux connectés, les agents travaillent en mode estimation et ne peuvent pas publier réellement.",
        en: "Don't skip step 1 (Connectors): without connected networks, agents work in estimation mode and cannot publish for real.",
      },
      {
        fr: "Vous pouvez revenir sur cette page à tout moment via « Démarrage guidé » dans la barre latérale.",
        en: "You can return to this page anytime via 'Get started' in the sidebar.",
      },
    ],
    faq: [
      {
        q: { fr: "Dois-je tout configurer d'un coup ?", en: "Do I have to set everything up at once?" },
        a: {
          fr: "Non. Faites au moins les étapes 1 et 3 pour un premier résultat ; le reste (Telegram, MCP) peut être ajouté plus tard. Votre progression est sauvegardée automatiquement.",
          en: "No. Do at least steps 1 and 3 for a first result; the rest (Telegram, MCP) can be added later. Your progress is saved automatically.",
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
          fr: "Chaque entité a son propre bot. Sélectionnez d'abord le bon compte (en haut), puis configurez son bot sur cette page.",
          en: "Each entity has its own bot. First select the right account (top), then configure its bot on this page.",
        },
      },
      {
        q: { fr: "Que faire si le bouton Activer est grisé ?", en: "What if the Activate button is greyed out?" },
        a: {
          fr: "Vous devez d'abord enregistrer un token bot valide. Le bouton s'active automatiquement une fois le token sauvegardé.",
          en: "You must first save a valid bot token. The button activates automatically once the token is saved.",
        },
      },
    ],
    related: [
      { label: { fr: "Démarrage guidé", en: "Guided onboarding" }, href: "/demarrage" },
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
      { label: { fr: "Démarrage guidé", en: "Guided onboarding" }, href: "/demarrage" },
      { label: { fr: "Agents IA", en: "AI agents" }, href: "/agents" },
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
  const keys = Object.keys(HELP_BILINGUAL).sort((a, b) => b.length - a.length);
  const match = keys.find((key) => pathname.startsWith(key));
  const bilingual = match ? HELP_BILINGUAL[match] : FALLBACK_BILINGUAL;
  return resolve(bilingual, lang);
}
