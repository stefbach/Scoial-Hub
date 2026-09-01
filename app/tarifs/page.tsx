"use client";

/* Page publique TARIFS — bilingue FR/EN.
   Reprend l'habillage « Mission Control » de la landing (.mc-root, .mc-nav,
   .mc-section, .mc-btn…) et n'ajoute que les blocs propres à la tarification
   (préfixe .tf-, définis dans globals.css).

   Positionnement tenu par la page : les publications sont ILLIMITÉES sur toutes
   les formules — seule la vidéo GÉNÉRÉE par IA est plafonnée, parce qu'elle est
   le seul poste au coût unitaire réellement significatif. */

import { Fragment } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/lib/i18n";
import { LogoMark } from "@/components/brand/Logo";

/* ── Types ────────────────────────────────────────────────────────────────── */

/** Texte bilingue : [français, anglais]. */
type L = readonly [string, string];

/** Valeur d'une cellule : incluse, exclue, ou une limite chiffrée bilingue. */
type Cell = "y" | "n" | L;

interface Plan {
  id: string;
  name: string;
  audience: L;
  rs: string;
  eur: string;
  feature?: boolean;
  feats: { t: L; key?: boolean; off?: boolean }[];
}

/* ── Formules ─────────────────────────────────────────────────────────────── */

const PLANS: Plan[] = [
  {
    id: "executive",
    name: "LinkedIn Executive",
    audience: ["Dirigeants, consultants, cabinets", "Executives, consultants, firms"],
    rs: "2 500",
    eur: "49",
    feats: [
      { t: ["Publications LinkedIn illimitées", "Unlimited LinkedIn posts"], key: true },
      { t: ["Trois mots-clés suffisent : article, posts et visuels", "Three keywords is enough: article, posts and visuals"], key: true },
      { t: ["Articles longs et séries thématiques", "Long-form articles and themed series"] },
      { t: ["Visuels générés à votre charte", "Visuals generated in your brand style"] },
      { t: ["Mémoire de marque : la plateforme retient ce qui marche", "Brand memory: the platform remembers what works"] },
      { t: ["Montage de vos photos et vidéos", "Editing of your own photos and videos"] },
      { t: ["Réponses aux commentaires assistées", "Assisted comment replies"] },
      { t: ["Facebook et Instagram", "Facebook and Instagram"], off: true },
      { t: ["Vidéo générée par IA", "AI-generated video"], off: true },
    ],
  },
  {
    id: "presence",
    name: "Présence",
    audience: ["Commerces, PME, marques locales", "Shops, SMEs, local brands"],
    rs: "7 900",
    eur: "159",
    feature: true,
    feats: [
      { t: ["LinkedIn + Facebook + Instagram", "LinkedIn + Facebook + Instagram"], key: true },
      { t: ["Publications illimitées", "Unlimited posts"], key: true },
      { t: ["Trois mots-clés suffisent : un mois de contenu cohérent", "Three keywords is enough: a coherent month of content"], key: true },
      { t: ["Stratégie, calendrier et validation mensuelle", "Strategy, calendar and monthly approval"] },
      { t: ["Visuels et affiches à votre charte", "Visuals and posters in your brand style"] },
      { t: ["Montage vidéo illimité de vos médias", "Unlimited editing of your own media"] },
      { t: ["Sous-titres automatiques", "Automatic subtitles"] },
      { t: ["Messagerie unifiée avec agent IA", "Unified inbox with AI agent"] },
      { t: ["Veille concurrentielle", "Competitor watch"] },
      { t: ["60 secondes de vidéo générée par IA / mois", "60 seconds of AI-generated video / month"], key: true },
    ],
  },
  {
    id: "studio",
    name: "Studio",
    audience: ["Marques qui produisent beaucoup", "Brands that publish at volume"],
    rs: "15 900",
    eur: "329",
    feats: [
      { t: ["Tout ce que contient Présence", "Everything in Présence"], key: true },
      { t: ["60 secondes de vidéo générée par IA / mois", "60 seconds of AI-generated video / month"], key: true },
      { t: ["Studio Avatar : porte-parole de synthèse", "Avatar Studio: synthetic spokesperson"] },
      { t: ["Voix de marque clonée", "Cloned brand voice"] },
      { t: ["Storyboard et direction vidéo assistés", "Assisted storyboard and video direction"] },
      { t: ["Benchmark concurrentiel approfondi", "In-depth competitive benchmark"] },
      { t: ["Régie publicitaire Meta en autonomie", "Self-serve Meta ads console"] },
      { t: ["Secondes supplémentaires à 75 Rs", "Extra seconds at Rs 75"] },
    ],
  },
];

/* ── Démarrage ────────────────────────────────────────────────────────────── */

const START: { t: L; d: L }[] = [
  {
    t: ["Connexion en un clic", "One-click connection"],
    d: [
      "LinkedIn, Facebook, Instagram et vos comptes publicitaires s'autorisent depuis l'écran Connecteurs. Rien à installer, aucun dossier à monter.",
      "LinkedIn, Facebook, Instagram and your ad accounts authorise straight from the Connectors screen. Nothing to install, no paperwork.",
    ],
  },
  {
    t: ["Deux heures de prise en main", "Two hours of onboarding"],
    d: [
      "Incluses dans toutes les formules. Un consultant règle avec vous la charte de marque et valide votre premier mois de publications.",
      "Included in every plan. A consultant sets up your brand style with you and approves your first month of posts.",
    ],
  },
  {
    t: ["Service client inclus", "Customer support included"],
    d: [
      "Par messagerie et e-mail, réponse sous un jour ouvré. Ligne prioritaire pour les formules Studio et Agence.",
      "By chat and email, answered within one business day. Priority line for Studio and Agency plans.",
    ],
  },
];

/* ── Agences ──────────────────────────────────────────────────────────────── */

const AGENCY: { t: L; d: L }[] = [
  {
    t: ["Dix marques incluses", "Ten brands included"],
    d: [
      "Chaque client a son identité, sa mémoire stratégique et son calendrier, entièrement séparés des autres.",
      "Each client gets its own identity, strategic memory and calendar, fully separated from the others.",
    ],
  },
  {
    t: ["Bascule instantanée", "Instant switching"],
    d: [
      "Un sélecteur en haut d'écran pour passer d'un client à l'autre. Rôles par collaborateur et journal d'audit complet.",
      "A selector at the top of the screen to move between clients. Per-user roles and a full audit trail.",
    ],
  },
  {
    t: ["Facturation unique", "Single invoice"],
    d: [
      "Une seule facture pour tout votre portefeuille, quel que soit le nombre de marques que vous pilotez.",
      "One invoice for your whole portfolio, however many brands you run.",
    ],
  },
];

const AGENCY_FIGURES: { k: L; v: string; sub?: L }[] = [
  { k: ["Formule Agence", "Agency plan"], v: "29 900 Rs", sub: ["/ 590 € par mois", "/ €590 per month"] },
  { k: ["Marques incluses", "Brands included"], v: "10" },
  { k: ["Marque supplémentaire", "Extra brand"], v: "2 500 Rs", sub: ["/ 49 €", "/ €49"] },
  { k: ["Vidéo IA partagée", "Shared AI video"], v: "180 s", sub: ["/ mois", "/ month"] },
];

/* ── Benchmark marché ─────────────────────────────────────────────────────── */

/** Cellule de benchmark : oui, non, ou nuance bilingue. */
type BCell = "y" | "n" | L;

/**
 * Comparatif ramené à UN MÊME scénario : une marque, trois réseaux, deux
 * utilisateurs. Sans cette normalisation, les prix affichés ne sont pas
 * comparables — Hootsuite, Sprout et Agorapulse facturent par utilisateur,
 * Buffer par canal. Tarifs publics relevés en août 2026.
 */
const BENCH: { name: string; price: L; kw: BCell; visual: BCell; ads: BCell; pilot: BCell; memory: BCell; us?: boolean }[] = [
  {
    name: "AXON·AI — Présence", us: true,
    price: ["159 €", "€159"],
    kw: "y", visual: "y", ads: [" Studio", "Studio"], pilot: "y", memory: "y",
  },
  { name: "Hootsuite — Standard", price: ["198 $", "$198"], kw: ["partiel", "partial"], visual: "y", ads: "n", pilot: "n", memory: "n" },
  { name: "Sprout Social — Essentials", price: ["198 $", "$198"], kw: ["partiel", "partial"], visual: "n", ads: "n", pilot: "n", memory: "n" },
  { name: "Agorapulse — Standard", price: ["198 $", "$198"], kw: ["partiel", "partial"], visual: "n", ads: "n", pilot: "n", memory: "n" },
  { name: "Predis.ai — Rise", price: ["40 $", "$40"], kw: "y", visual: "y", ads: "n", pilot: "n", memory: "n" },
  { name: "Taplio (LinkedIn)", price: ["65 $", "$65"], kw: "y", visual: "n", ads: "n", pilot: "n", memory: "n" },
  { name: "Buffer — Team", price: ["30 $", "$30"], kw: ["partiel", "partial"], visual: "n", ads: "n", pilot: "n", memory: "n" },
  { name: "Metricool — Starter", price: ["20 €", "€20"], kw: ["limité", "limited"], visual: "n", ads: "n", pilot: "n", memory: "n" },
];

const WHY: { t: L; d: L }[] = [
  {
    t: ["Une veille stratégique qui travaille pour vous", "Strategic watch working for you"],
    d: [
      "Nous suivons en continu ce que publient vos concurrents — y compris leurs publicités, via la bibliothèque publicitaire officielle. Vous savez ce qui se dit sur votre marché sans y passer une heure par semaine.",
      "We continuously track what your competitors publish — including their ads, through the official ad library. You know what's happening in your market without spending an hour a week on it.",
    ],
  },
  {
    t: ["Un pilotage assisté par IA, jamais à votre insu", "AI-assisted piloting, never behind your back"],
    d: [
      "L'IA lit vos performances publicitaires réelles et propose les décisions : mettre en pause, augmenter un budget, réactiver. Chaque action est marquée « sûre » ou « dépense », et rien ne s'applique sans votre clic.",
      "The AI reads your real ad performance and proposes the decisions: pause, raise a budget, reactivate. Each action is flagged “safe” or “spend”, and nothing is applied without your click.",
    ],
  },
  {
    t: ["Personne d'autre ne crée vos publicités", "No one else builds your ads"],
    d: [
      "Les autres plateformes publient et mesurent. Aucune ne construit campagne, ciblage, créative et formulaire de prospects. C'est la différence la moins contestable de cette page.",
      "The others publish and measure. None of them builds a campaign, targeting, creative and lead form. It is the least contestable difference on this page.",
    ],
  },
  {
    t: ["Trois mots-clés, un mois de contenu", "Three keywords, a month of content"],
    d: [
      "Article long, posts déclinés pour chaque réseau, visuels à votre charte, calendrier prêt à valider. Ailleurs, vous obtenez un post à la fois.",
      "A long-form article, posts adapted per network, visuals in your brand style, a calendar ready to approve. Elsewhere, you get one post at a time.",
    ],
  },
  {
    t: ["La plateforme retient ce qui marche", "The platform remembers what works"],
    d: [
      "Les assistants concurrents repartent de zéro à chaque demande. Le nôtre accumule le contexte de votre marque et s'en sert à la publication suivante.",
      "Rival assistants start from scratch every time. Ours accumulates your brand context and uses it on the next post.",
    ],
  },
  {
    t: ["Un prix qui ne punit pas la croissance", "Pricing that doesn't punish growth"],
    d: [
      "Nous facturons par marque. Hootsuite, Sprout et Agorapulse facturent par utilisateur : dès la deuxième personne, ils coûtent plus cher que nous en faisant moins.",
      "We bill per brand. Hootsuite, Sprout and Agorapulse bill per user: from the second person on, they cost more than us while doing less.",
    ],
  },
];

/* ── Inventaire des capacités ─────────────────────────────────────────────── */

const MATRIX: { g: L; rows: { l: L; s?: L; v: [Cell, Cell, Cell] }[] }[] = [
  {
    g: ["Stratégie & marque", "Strategy & brand"],
    rows: [
      { l: ["Analyse automatique de votre entreprise", "Automatic analysis of your business"], s: ["Site, offres, positionnement, cible", "Website, offers, positioning, audience"], v: ["y", "y", "y"] },
      { l: ["Charte de marque", "Brand style guide"], s: ["Couleurs, logo, typographies, ton de voix", "Colours, logo, type, tone of voice"], v: ["y", "y", "y"] },
      { l: ["Mémoire stratégique persistante", "Persistent strategic memory"], s: ["La plateforme retient ce qui a fonctionné", "The platform remembers what worked"], v: ["y", "y", "y"] },
      { l: ["Consultant IA", "AI consultant"], s: ["Posez vos questions de stratégie, obtenez un plan", "Ask strategy questions, get a plan"], v: ["y", "y", "y"] },
      { l: ["Simulateur de scénarios", "Scenario simulator"], s: ["Testez une campagne avant de la lancer", "Test a campaign before launching it"], v: ["n", "y", "y"] },
    ],
  },
  {
    g: ["Création de contenu", "Content creation"],
    rows: [
      { l: ["Rédaction de publications", "Post copywriting"], v: [["illimité", "unlimited"], ["illimité", "unlimited"], ["illimité", "unlimited"]] },
      { l: ["Séries éditoriales", "Editorial series"], s: ["Une thématique déclinée sur plusieurs semaines", "One theme spread across several weeks"], v: ["y", "y", "y"] },
      { l: ["Articles longs LinkedIn", "Long-form LinkedIn articles"], v: ["y", "y", "y"] },
      { l: ["Visuels générés à votre charte", "Visuals in your brand style"], v: [["illimité", "unlimited"], ["illimité", "unlimited"], ["illimité", "unlimited"]] },
      { l: ["Studio Affiche", "Poster Studio"], s: ["Mise en page automatique aux formats de chaque réseau", "Automatic layout for each network's formats"], v: ["y", "y", "y"] },
      { l: ["Retouche et extension d'images", "Image editing and outpainting"], v: ["y", "y", "y"] },
      { l: ["Montage de vos photos et vidéos", "Editing of your own photos and videos"], v: [["illimité", "unlimited"], ["illimité", "unlimited"], ["illimité", "unlimited"]] },
      { l: ["Sous-titres automatiques", "Automatic subtitles"], v: ["y", "y", "y"] },
      { l: ["Vidéo générée par IA", "AI-generated video"], s: ["Aucun tournage nécessaire", "No filming required"], v: ["n", [" 60 s / mois", "60 s / month"], [" 60 s / mois", "60 s / month"]] },
      { l: ["Studio Avatar & voix clonée", "Avatar Studio & cloned voice"], s: ["Un porte-parole de synthèse à votre image", "A synthetic spokesperson in your image"], v: ["n", "n", "y"] },
      { l: ["Bibliothèque de médias", "Media library"], v: ["y", "y", "y"] },
    ],
  },
  {
    g: ["Publication", "Publishing"],
    rows: [
      { l: ["LinkedIn", "LinkedIn"], v: ["y", "y", "y"] },
      { l: ["Facebook & Instagram", "Facebook & Instagram"], v: ["n", "y", "y"] },
      { l: ["TikTok, X, Pinterest, Threads", "TikTok, X, Pinterest, Threads"], v: ["n", "y", "y"] },
      { l: ["Calendrier et programmation", "Calendar and scheduling"], s: ["Validation en un clic, publication automatique", "One-click approval, automatic publishing"], v: ["y", "y", "y"] },
      { l: ["Historique complet et traçabilité", "Full history and traceability"], v: ["y", "y", "y"] },
    ],
  },
  {
    g: ["Relation client", "Customer conversations"],
    rows: [
      { l: ["Messagerie unifiée", "Unified inbox"], s: ["Commentaires et messages privés, tous réseaux", "Comments and direct messages, all networks"], v: ["y", "y", "y"] },
      { l: ["Agent IA de réponse", "AI reply agent"], s: ["Répond dans votre ton, sous votre contrôle", "Replies in your tone, under your control"], v: ["n", "y", "y"] },
      { l: ["Analyse de sentiment", "Sentiment analysis"], s: ["Chaque message classé : positif, neutre, négatif, question", "Every message classified: positive, neutral, negative, question"], v: ["y", "y", "y"] },
      { l: ["Tableau d'humeur de vos audiences", "Audience mood dashboard"], s: ["L'évolution du sentiment dans le temps", "How sentiment shifts over time"], v: ["n", "y", "y"] },
      { l: ["Alertes Telegram", "Telegram alerts"], v: ["y", "y", "y"] },
    ],
  },
  {
    g: ["Publicité Meta", "Meta advertising"],
    rows: [
      { l: ["Création de campagnes", "Campaign creation"], s: ["Campagne, ciblage, créatives, budget", "Campaign, targeting, creatives, budget"], v: ["n", "n", "y"] },
      { l: ["Formulaires de prospects", "Lead forms"], v: ["n", "n", "y"] },
      { l: ["Audiences et pixels", "Audiences and pixels"], v: ["n", "n", "y"] },
      { l: ["Garde-fou budgétaire", "Budget safeguard"], s: ["Tout est créé en pause, plafond de dépense", "Everything is created paused, with a spend cap"], v: ["n", "n", "y"] },
      { l: ["Pilote Pub assisté par IA", "AI-assisted ad pilot"], s: ["L'IA propose pause, budget et activation d'après vos résultats réels — appliqué sur votre clic", "The AI proposes pause, budget and activation from your real results — applied on your click"], v: ["n", "n", "y"] },
    ],
  },
  {
    g: ["Veille & performance", "Watch & performance"],
    rows: [
      { l: ["Veille concurrentielle", "Competitor watch"], v: ["n", "y", "y"] },
      { l: ["Analyse des publicités concurrentes", "Competitor ad analysis"], v: ["n", "n", "y"] },
      { l: ["Benchmark de positionnement", "Positioning benchmark"], v: ["n", "y", "y"] },
      { l: ["Tableau de performance", "Performance dashboard"], v: ["y", "y", "y"] },
      { l: ["Recommandations mensuelles", "Monthly recommendations"], v: ["n", "y", "y"] },
    ],
  },
  {
    g: ["Équipe & gouvernance", "Team & governance"],
    rows: [
      { l: ["Utilisateurs", "Users"], v: [["2", "2"], ["5", "5"], ["illimité", "unlimited"]] },
      { l: ["Rôles et permissions", "Roles and permissions"], v: ["y", "y", "y"] },
      { l: ["Journal d'audit", "Audit trail"], v: ["y", "y", "y"] },
      { l: ["Accès API", "API access"], s: ["Branchez AXON sur vos propres outils", "Plug AXON into your own tools"], v: ["n", "n", "y"] },
    ],
  },
];

/* ── Options à la carte ───────────────────────────────────────────────────── */

const CARTE: { t: L; d: L; price: L; note?: L }[] = [
  {
    t: ["Formation de vos équipes", "Team training"],
    d: [
      "Une demi-journée, sur site ou à distance, pour rendre vos collaborateurs pleinement autonomes. Recommandée aux agences.",
      "Half a day, on site or remote, to make your team fully autonomous. Recommended for agencies.",
    ],
    price: ["8 000 Rs", "Rs 8,000"],
    note: ["· 160 € · une fois", "· €160 · one-off"],
  },
  {
    t: ["Marque supplémentaire", "Extra brand"],
    d: [
      "Une seconde enseigne ou filiale, avec sa propre identité, sa mémoire stratégique et son calendrier.",
      "A second brand or subsidiary, with its own identity, strategic memory and calendar.",
    ],
    price: ["3 900 Rs / mois", "Rs 3,900 / month"],
    note: ["· 79 €", "· €79"],
  },
  {
    t: ["Secondes vidéo supplémentaires", "Extra video seconds"],
    d: [
      "Au-delà du quota mensuel de votre formule, sans engagement de volume et facturé à l'usage.",
      "Beyond your plan's monthly quota, with no volume commitment, billed on use.",
    ],
    price: ["75 Rs / seconde", "Rs 75 / second"],
    note: ["· 1,50 €", "· €1.50"],
  },
  {
    t: ["Production sur mesure", "Bespoke production"],
    d: [
      "Film de marque, séance photo, refonte complète de charte : nous chiffrons au projet.",
      "Brand film, photo shoot, full identity redesign: we quote per project.",
    ],
    price: ["Sur devis", "On quote"],
  },
];

/* ── Mentions ─────────────────────────────────────────────────────────────── */

const NOTES: L[] = [
  ["Prix hors taxes. Tarifs en roupies pour les entreprises établies à Maurice, en euros ailleurs.", "Prices exclude tax. Rupee pricing for businesses based in Mauritius, euro pricing elsewhere."],
  ["« Illimité » signifie sans compteur, dans le cadre d'un usage professionnel normal pour une marque.", "“Unlimited” means no counter, within normal professional use for a single brand."],
  ["La seconde de vidéo générée est décomptée à la seconde produite, arrondie à la seconde supérieure. Quota non reportable.", "Generated video is counted per second produced, rounded up. Quotas do not roll over."],
  ["Engagement initial de trois mois, puis mensuel sans préavis. Formule annuelle : dix mois payés.", "Three-month initial term, then monthly with no notice period. Annual plan: ten months paid."],
  ["Les deux heures de prise en main et le service client sont inclus dans toutes les formules, sans frais d'ouverture.", "The two onboarding hours and customer support are included in every plan, with no setup fee."],
];

/* ── Rendu ────────────────────────────────────────────────────────────────── */

export default function TarifsPage() {
  const t = useT();
  const tr = (l: L) => t(l[0], l[1]);

  const cell = (c: Cell) => {
    if (c === "y") return <span className="tf-yes" aria-label={t("inclus", "included")}>●</span>;
    if (c === "n") return <span className="tf-no" aria-label={t("non inclus", "not included")}>○</span>;
    return <span className="tf-lim">{tr(c)}</span>;
  };

  return (
    <div className="mc-root">
      <div className="mc-mesh" aria-hidden />
      <div className="mc-grain" aria-hidden />

      {/* ── Nav ── */}
      <header className="mc-nav">
        <Link href="/" className="mc-brand"><LogoMark size={26} onDark /> AXON<span>·AI</span></Link>
        <nav className="mc-navlinks">
          <Link href="/">{t("Accueil", "Home")}</Link>
          <a href="#formules">{t("Formules", "Plans")}</a>
          <a href="#benchmark">{t("Comparatif", "Comparison")}</a>
          <a href="#detail">{t("Le détail", "Full detail")}</a>
          <a href="#agences">{t("Agences", "Agencies")}</a>
        </nav>
        <div className="mc-navcta">
          <LanguageSwitcher />
          <Link href="/dashboard" className="mc-btn mc-btn-ghost">{t("Entrer", "Enter")}</Link>
          <Link href="/demarrage" className="mc-btn mc-btn-glow">{t("Commencer", "Start")}</Link>
        </div>
      </header>

      {/* ── Ouverture ── */}
      <section className="mc-section tf-hero">
        <div>
          <span className="mc-kicker">{t("Tarifs 2026 · Maurice & export", "Pricing 2026 · Mauritius & export")}</span>
          <h1 className="mc-h2 tf-h1">
            {t("Vous publiez tous les jours.", "You publish every day.")}<br />
            <span className="mc-grad">{t("Sans y penser une seule fois.", "Without thinking about it once.")}</span>
          </h1>
          <p className="mc-sec-sub tf-lede">
            {t(
              "AXON écrit, illustre, programme et publie sur vos réseaux — et répond à vos clients. Vous validez le calendrier une fois par mois. C'est tout.",
              "AXON writes, illustrates, schedules and publishes across your networks — and answers your customers. You approve the calendar once a month. That's it."
            )}
          </p>
        </div>

        {/* Grille de cadence : la promesse rendue visible — 3 réseaux × 7 jours. */}
        <div
          className="tf-cadence"
          role="img"
          aria-label={t(
            "Une semaine type : une publication par jour sur LinkedIn, Facebook et Instagram, du lundi au dimanche, soit 21 publications.",
            "A typical week: one post a day on LinkedIn, Facebook and Instagram, Monday to Sunday — 21 posts."
          )}
        >
          <div className="tf-cadence-head">
            <span className="mc-kicker">{t("Une semaine type", "A typical week")}</span>
            <span className="mc-kicker">{t("21 publications", "21 posts")}</span>
          </div>
          <div className="tf-week">
            {(t("L,M,M,J,V,S,D", "M,T,W,T,F,S,S").split(",")).map((d, i) => (
              <div key={i} className="tf-day">
                <div className="tf-slots">
                  <i className="tf-slot a" /><i className="tf-slot b" /><i className="tf-slot c" />
                </div>
                <span className="tf-day-l">{d}</span>
              </div>
            ))}
          </div>
          <div className="tf-legend">
            <span><i className="tf-chip a" /> LinkedIn</span>
            <span><i className="tf-chip b" /> Facebook</span>
            <span><i className="tf-chip c" /> Instagram</span>
          </div>
        </div>
      </section>

      {/* ── Formules ── */}
      <section id="formules" className="mc-section">
        <header className="mc-sec-head mc-sec-head--left">
          <span className="mc-kicker">{t("Formules mensuelles", "Monthly plans")}</span>
          <h2 className="mc-h2">{t("Publications illimitées, sur toutes les formules.", "Unlimited posts, on every plan.")}</h2>
          <p className="mc-sec-sub">
            {t(
              "Vous donnez trois mots-clés, vous récupérez un mois de contenu cohérent : articles, posts déclinés par réseau, visuels et calendrier. Nous ne comptons pas vos publications — seule la vidéo générée par IA est plafonnée, parce qu'elle coûte réellement cher à produire.",
              "Give us three keywords and get a coherent month of content: articles, posts adapted per network, visuals and a calendar. We don't count your posts — only AI-generated video is capped, because it genuinely costs a lot to produce."
            )}
          </p>
        </header>

        <div className="tf-plans">
          {PLANS.map((p) => (
            <article key={p.id} className={`tf-plan${p.feature ? " is-feature" : ""}`}>
              {p.feature && <span className="tf-badge">{t("Le plus choisi", "Most chosen")}</span>}
              <h3 className="tf-plan-name">{p.name}</h3>
              <p className="tf-plan-for">{tr(p.audience)}</p>
              <p className="tf-price"><b>{p.rs}</b><span>{t("Rs / mois", "Rs / month")}</span></p>
              <p className="tf-price-alt">{t(`${p.eur} € hors Maurice`, `€${p.eur} outside Mauritius`)}</p>
              <ul className="tf-feat">
                {p.feats.map((f, i) => (
                  <li key={i} className={f.off ? "off" : f.key ? "key" : undefined}>{tr(f.t)}</li>
                ))}
              </ul>
              <Link href="/demarrage" className={`mc-btn ${p.feature ? "mc-btn-glow" : "mc-btn-outline"} tf-cta`}>
                {t("Commencer", "Get started")}
              </Link>
            </article>
          ))}
        </div>
      </section>


      {/* ── Benchmark & pourquoi nous ── */}
      <section id="benchmark" className="mc-section">
        <header className="mc-sec-head mc-sec-head--left">
          <span className="mc-kicker">{t("Comparatif marché", "Market comparison")}</span>
          <h2 className="mc-h2">{t("Pourquoi nous plutôt qu'un autre.", "Why us rather than someone else.")}</h2>
          <p className="mc-sec-sub">
            {t(
              "Publier, tout le monde sait le faire. Ce qui ne se trouve nulle part ailleurs, c'est la veille stratégique de votre marché et le pilotage de vos campagnes assisté par IA. Les prix ci-dessous sont ramenés au même scénario : une marque, trois réseaux, deux utilisateurs.",
              "Anyone can publish. What you won't find elsewhere is strategic market watch and AI-assisted campaign piloting. The prices below are normalised to one scenario: one brand, three networks, two users."
            )}
          </p>
        </header>

        <div className="tf-matrix-scroll">
          <table className="tf-matrix">
            <caption>
              {t(
                "Tarifs publics relevés en août 2026 · ● inclus · ○ absent",
                "Public pricing as of August 2026 · ● included · ○ absent"
              )}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("Plateforme", "Platform")}</th>
                <th scope="col" className="c">{t("Coût du scénario", "Scenario cost")}</th>
                <th scope="col" className="c">{t("Contenu depuis mots-clés", "Content from keywords")}</th>
                <th scope="col" className="c">{t("Visuels générés", "Generated visuals")}</th>
                <th scope="col" className="c">{t("Création de publicités", "Ad creation")}</th>
                <th scope="col" className="c">{t("Veille + pilotage IA", "Watch + AI piloting")}</th>
                <th scope="col" className="c">{t("Mémoire de marque", "Brand memory")}</th>
              </tr>
            </thead>
            <tbody>
              {BENCH.map((b) => (
                <tr key={b.name} className={b.us ? "tf-us" : undefined}>
                  <td>{b.name}</td>
                  <td className="c"><span className="tf-lim">{tr(b.price)}</span></td>
                  <td className="c">{cell(b.kw)}</td>
                  <td className="c">{cell(b.visual)}</td>
                  <td className="c">{cell(b.ads)}</td>
                  <td className="c">{cell(b.pilot)}</td>
                  <td className="c">{cell(b.memory)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tf-why">
          {WHY.map((w) => (
            <div key={w.t[0]} className="tf-item">
              <h3>{tr(w.t)}</h3>
              <p>{tr(w.d)}</p>
            </div>
          ))}
        </div>

        <p className="tf-bench-note">
          {t(
            "Nous ne sommes pas l'offre la moins chère et nous ne le prétendons pas : Metricool et Buffer coûtent moins, et font nettement moins. Nous sommes moins chers que les suites qui facturent à l'utilisateur — en créant vos publicités, ce qu'aucune d'elles ne fait.",
            "We are not the cheapest and we don't claim to be: Metricool and Buffer cost less, and do markedly less. We cost less than the suites that bill per user — while building your ads, which none of them does."
          )}
        </p>
      </section>

      {/* ── Démarrage ── */}
      <section className="mc-section">
        <header className="mc-sec-head mc-sec-head--left">
          <span className="mc-kicker">{t("Démarrage", "Getting started")}</span>
          <h2 className="mc-h2">{t("Branché en un clic. Autonome en deux heures.", "Connected in one click. Autonomous in two hours.")}</h2>
          <p className="mc-sec-sub">
            {t(
              "Vous autorisez vos comptes depuis l'application, sans manipulation technique. Nous restons à vos côtés le temps du premier calendrier — ensuite, vous pilotez seul.",
              "You authorise your accounts from inside the app, with no technical steps. We stay alongside you for the first calendar — after that, you run it yourself."
            )}
          </p>
        </header>
        <div className="tf-trio">
          {START.map((s) => (
            <div key={s.t[0]} className="tf-step">
              <h3>{tr(s.t)}</h3>
              <p>{tr(s.d)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Agences ── */}
      <section id="agences" className="mc-section mc-section--warm tf-agency">
        <header className="mc-sec-head mc-sec-head--left">
          <span className="mc-kicker">{t("Agences & groupes", "Agencies & groups")}</span>
          <h2 className="mc-h2">{t("Dix marques, une seule console.", "Ten brands, one console.")}</h2>
          <p className="mc-sec-sub">
            {t(
              "Chaque client garde son identité, sa mémoire stratégique et son calendrier. Un seul écran, un seul abonnement, une seule facture.",
              "Every client keeps its own identity, strategic memory and calendar. One screen, one subscription, one invoice."
            )}
          </p>
        </header>
        <div className="tf-trio">
          {AGENCY.map((a) => (
            <div key={a.t[0]} className="tf-step">
              <h3>{tr(a.t)}</h3>
              <p>{tr(a.d)}</p>
            </div>
          ))}
        </div>
        <div className="tf-figures">
          {AGENCY_FIGURES.map((f) => (
            <div key={f.k[0]}>
              <span className="tf-fig-k">{tr(f.k)}</span>
              <span className="tf-fig-v">{f.v}{f.sub && <em>{tr(f.sub)}</em>}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Inventaire des capacités ── */}
      <section id="detail" className="mc-section">
        <header className="mc-sec-head mc-sec-head--left">
          <span className="mc-kicker">{t("Le détail", "Full detail")}</span>
          <h2 className="mc-h2">{t("Tout ce que la plateforme sait faire.", "Everything the platform can do.")}</h2>
          <p className="mc-sec-sub">
            {t(
              "Sept domaines, un seul abonnement. Rien de ce qui suit n'est un module tiers à connecter : tout est natif.",
              "Seven areas, one subscription. Nothing below is a third-party add-on to plug in: it is all native."
            )}
          </p>
        </header>

        <div className="tf-matrix-scroll">
          <table className="tf-matrix">
            <caption>
              {t("Disponibilité par formule · ● inclus · ○ non inclus", "Availability by plan · ● included · ○ not included")}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("Capacité", "Capability")}</th>
                <th scope="col" className="c">Executive</th>
                <th scope="col" className="c">Présence</th>
                <th scope="col" className="c">Studio</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((grp) => (
                <Fragment key={grp.g[0]}>
                  <tr className="tf-grp"><td colSpan={4}>{tr(grp.g)}</td></tr>
                  {grp.rows.map((r) => (
                    <tr key={`${grp.g[0]}-${r.l[0]}`}>
                      <td>
                        {tr(r.l)}
                        {r.s && <small>{tr(r.s)}</small>}
                      </td>
                      <td className="c">{cell(r.v[0])}</td>
                      <td className="c">{cell(r.v[1])}</td>
                      <td className="c">{cell(r.v[2])}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── À la carte ── */}
      <section className="mc-section">
        <header className="mc-sec-head mc-sec-head--left">
          <span className="mc-kicker">{t("À la carte", "Add-ons")}</span>
          <h2 className="mc-h2">{t("Le strict nécessaire, en option.", "Only what's genuinely needed.")}</h2>
          <p className="mc-sec-sub">
            {t(
              "Quatre options, pas une de plus. Tout le reste est déjà dans votre abonnement.",
              "Four add-ons, not one more. Everything else is already in your subscription."
            )}
          </p>
        </header>
        <div className="tf-carte">
          {CARTE.map((c) => (
            <div key={c.t[0]} className="tf-item">
              <h3>{tr(c.t)}</h3>
              <p>{tr(c.d)}</p>
              <p className="tf-tag">{tr(c.price)}{c.note && <em> {tr(c.note)}</em>}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mentions + CTA ── */}
      <section className="mc-section tf-close">
        <div>
          <span className="mc-kicker">{t("Conditions", "Terms")}</span>
          <ul className="tf-notes">
            {NOTES.map((n) => <li key={n[0]}>{tr(n)}</li>)}
          </ul>
        </div>
        <div>
          <span className="mc-kicker">{t("Parler à quelqu'un", "Talk to someone")}</span>
          <h2 className="mc-h2 tf-close-h">
            {t("Trente minutes suffisent pour savoir si c'est pour vous.", "Thirty minutes is enough to know if this is for you.")}
          </h2>
          <p className="mc-sec-sub">
            {t(
              "Nous regardons ensemble vos réseaux actuels et nous vous montrons, en direct, ce que la plateforme produirait pour votre marque.",
              "We look at your current networks together and show you, live, what the platform would produce for your brand."
            )}
          </p>
          <div className="mc-cta-row" style={{ marginTop: "1.4rem" }}>
            <Link href="/demarrage" className="mc-btn mc-btn-glow mc-btn-lg">{t("Essayer gratuitement", "Try it free")}</Link>
            <a href="mailto:contact@axon-ai.social" className="mc-btn mc-btn-outline mc-btn-lg">{t("Réserver un échange", "Book a call")}</a>
          </div>
        </div>
      </section>

      <footer className="mc-foot">
        <span>© {new Date().getFullYear()} AXON·AI · Social Hub — Digital Data Solutions Ltd</span>
        <nav className="mc-foot-links" aria-label={t("Liens légaux", "Legal links")}>
          <Link href="/legal/conditions">{t("Conditions", "Terms")}</Link>
          <Link href="/legal/confidentialite">{t("Confidentialité", "Privacy")}</Link>
          <Link href="/legal/suppression-donnees">{t("Suppression des données", "Data deletion")}</Link>
        </nav>
      </footer>
    </div>
  );
}
