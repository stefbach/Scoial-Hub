"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Toast } from "@/components/ui/Toast";

// ── Telegram — connexion par code (quasi automatique) + guidage ─────────────────

interface Pairing {
  botUsername: string;
  code: string;
  deepLink: string;
  linked: boolean;
  status: "connected" | "pending";
  isBotConfigured: boolean;
}

export default function ClientTelegramPage() {
  const { company } = useCompany();
  const t = useT();
  const companyId = company.id;

  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/telegram/pairing?companyId=${encodeURIComponent(companyId)}`);
      if (res.ok) setPairing(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Sondage tant que non relié : détecte le moment où le client clique Start.
  // Backoff progressif (4→30 s) + plafond ~5 min pour ne pas marteler le serveur.
  useEffect(() => {
    if (!pairing || pairing.linked) {
      if (pollRef.current) clearTimeout(pollRef.current);
      return;
    }
    const delays = [4000, 6000, 10000, 15000, 30000];
    let i = 0;
    let elapsed = 0;
    let cancelled = false;
    const tick = async () => {
      await load();
      if (cancelled) return;
      const d = delays[Math.min(i, delays.length - 1)];
      i += 1;
      elapsed += d;
      if (elapsed > 5 * 60_000) return; // plafond : on cesse le sondage automatique
      pollRef.current = setTimeout(tick, d);
    };
    pollRef.current = setTimeout(tick, delays[0]);
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [pairing, load]);

  function notify(msg: string) {
    setToast({ message: msg, key: Date.now() });
  }

  const linked = pairing?.linked ?? false;

  // Nom du bot nettoyé (sans « @ ») et lien réel vers la conversation du bot.
  // On ne fabrique JAMAIS un lien si le bot est inconnu (pas de telegram.org bidon).
  const botUsername = (pairing?.botUsername ?? "").replace(/^@+/, "").trim();
  const botUrl = botUsername
    ? pairing?.code
      ? `https://t.me/${botUsername}?start=${pairing.code}`
      : `https://t.me/${botUsername}`
    : null;

  return (
    <div className="animate-fade-in space-y-5">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#229ED9" }} aria-hidden>
          <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{t("Piloter par Telegram", "Pilot via Telegram")}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              `Reliez « ${company.name} » à Telegram en un clic, puis pilotez vos agents et campagnes par message — jour et nuit.`,
              `Link “${company.name}” to Telegram in one click, then pilot your agents and campaigns by message — day and night.`
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center p-10">
          <span className="text-sm text-muted">{t("Chargement…", "Loading…")}</span>
        </div>
      ) : linked ? (
        /* ── Connecté ─────────────────────────────────────────────── */
        <div className="card flex items-center gap-3 border-success-200 bg-success-50 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9.5l3 3 7-7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <div className="font-semibold text-success-700">{t("Telegram connecté !", "Telegram connected!")}</div>
            <div className="text-sm text-success-600">{t("Votre copilote AXON-AI répond dans Telegram. Essayez « /aide ».", "Your AXON-AI copilot is live in Telegram. Try “/aide”.")}</div>
          </div>
        </div>
      ) : (
        /* ── Connexion par code ───────────────────────────────────── */
        <div className="card p-5">
          <div className="section-label mb-3">{t("Connexion en 1 clic", "1-click connection")}</div>

          {pairing?.isBotConfigured && botUrl ? (
            <>
              <p className="mb-3 text-sm leading-relaxed text-muted">
                {t(
                  "Cliquez sur le bouton ci-dessous : Telegram s'ouvre sur le bot AXON-AI. Pressez « Démarrer / Start » et ce compte est relié automatiquement. Aucune installation, aucun bot à créer.",
                  "Click the button below: Telegram opens on the AXON-AI bot. Press “Start” and this account is linked automatically. No install, no bot to create."
                )}
              </p>
              <a href={botUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48z" /></svg>
                {t("Ouvrir le bot & connecter", "Open the bot & connect")}
              </a>
              <p className="mt-3 text-xs text-muted">
                {t("Ou, dans Telegram, cherchez ", "Or, in Telegram, search for ")}
                <code className="rounded bg-canvas px-1 py-0.5 font-mono">@{botUsername}</code>
                {t(" et envoyez ", " and send ")}
                <code className="rounded bg-canvas px-1 py-0.5 font-mono">/start {pairing.code}</code>.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                {t("En attente de votre connexion… cette page se met à jour automatiquement.", "Waiting for your connection… this page updates automatically.")}
              </div>
            </>
          ) : (
            /* Bot central non configuré → message d'accompagnement (admin) */
            <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
              <p className="text-sm font-semibold text-warning-700">{t("Le bot AXON-AI doit d'abord être activé", "The AXON-AI bot must be activated first")}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-warning-700">
                {t(
                  "La connexion par code utilise un bot Telegram central, partagé par tous les comptes. L'administrateur doit le configurer une seule fois dans Vercel :",
                  "Code pairing uses a central Telegram bot, shared by all accounts. The administrator must configure it once in Vercel:"
                )}
              </p>
              <ol className="mt-2 space-y-1 text-xs text-warning-700">
                <li>1. {t("Créer un bot via ", "Create a bot via ")}<a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a> ({t("commande ", "command ")}<code className="font-mono">/newbot</code>).</li>
                <li>2. {t("Dans Vercel → Settings → Environment Variables, ajouter ", "In Vercel → Settings → Environment Variables, add ")}<code className="font-mono">TELEGRAM_BOT_TOKEN</code> {t("et ", "and ")}<code className="font-mono">TELEGRAM_BOT_USERNAME</code>.</li>
                <li>3. {t("Redéployer, puis appeler une fois ", "Redeploy, then call once ")}<code className="font-mono">/api/telegram/bot/setup</code> {t("pour enregistrer le webhook.", "to register the webhook.")}</li>
              </ol>
              <p className="mt-2 text-xs text-warning-700">
                {t("Votre code de connexion est déjà prêt : ", "Your pairing code is already ready: ")}
                <code className="rounded bg-card px-1.5 py-0.5 font-mono font-semibold">{pairing?.code}</code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Que pouvez-vous piloter ? ──────────────────────────────── */}
      <div className="card p-5">
        <div className="section-label mb-1">{t("Que pilotez-vous depuis Telegram ?", "What do you pilot from Telegram?")}</div>
        <p className="mb-4 text-sm text-muted">
          {t(
            "Le bot est un agent à part entière qui dialogue avec toute votre équipe d'agents IA. Écrivez en langage naturel ou utilisez une commande :",
            "The bot is a full agent that talks to your whole AI agent team. Write in natural language or use a command:"
          )}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {USE_CASES.map((u) => (
            <div key={u.cmd} className="rounded-lg border border-hair bg-canvas p-3">
              <div className="mb-1 flex items-center gap-2">
                <span aria-hidden className="text-base">{u.icon}</span>
                <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-2xs font-semibold text-primary">{u.cmd}</code>
              </div>
              <p className="text-sm font-medium text-ink">{t(u.titleFr, u.titleEn)}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{t(u.descFr, u.descEn)}</p>
              <p className="mt-1.5 text-2xs italic text-muted/80">{t(u.exFr, u.exEn)}</p>
            </div>
          ))}
        </div>

        {/* Exemples concrets à envoyer au bot — en langage naturel, par thème */}
        <div className="mt-5 border-t border-hair pt-4">
          <div className="section-label mb-1">{t("Exemples de messages à envoyer", "Examples of messages to send")}</div>
          <p className="mb-3 text-xs text-muted">
            {t(
              "Copiez l'un de ces messages dans Telegram (ou inspirez-vous-en) — le bot s'occupe du reste.",
              "Copy one of these messages into Telegram (or take inspiration) — the bot handles the rest."
            )}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EXAMPLE_GROUPS.map((g) => (
              <div key={g.titleEn}>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <span aria-hidden>{g.icon}</span>
                  {t(g.titleFr, g.titleEn)}
                </div>
                <ul className="space-y-1.5">
                  {g.items.map((it) => (
                    <li key={it.en} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                      <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                      <span>“{t(it.fr, it.en)}”</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ── Cas d'usage Telegram ────────────────────────────────────────────────────────

const USE_CASES: {
  cmd: string; icon: string;
  titleFr: string; titleEn: string;
  descFr: string; descEn: string;
  exFr: string; exEn: string;
}[] = [
  {
    cmd: "/lancer", icon: "🚀",
    titleFr: "Lancer une campagne", titleEn: "Launch a campaign",
    descFr: "Déclenche toute l'équipe d'agents (stratégie, contenus, plan média) sur l'objectif que vous donnez.",
    descEn: "Triggers the whole agent team (strategy, content, media plan) on the objective you give.",
    exFr: "Ex : /lancer Promo de rentrée sur Instagram et LinkedIn", exEn: "E.g. /lancer Back-to-school promo on Instagram and LinkedIn",
  },
  {
    cmd: "/veille", icon: "📡",
    titleFr: "Analyser les concurrents", titleEn: "Analyse competitors",
    descFr: "Lance une veille concurrentielle et vous renvoie les formats et angles gagnants du marché.",
    descEn: "Runs a competitive watch and returns the winning formats and angles in your market.",
    exFr: "Ex : /veille", exEn: "E.g. /veille",
  },
  {
    cmd: "/objectif", icon: "🎯",
    titleFr: "Fixer un objectif", titleEn: "Set an objective",
    descFr: "Enregistre l'objectif par défaut du compte, réutilisé par les prochains lancements.",
    descEn: "Saves the account's default objective, reused by upcoming launches.",
    exFr: "Ex : /objectif +20% d'abonnés ce trimestre", exEn: "E.g. /objectif +20% followers this quarter",
  },
  {
    cmd: "/status", icon: "📊",
    titleFr: "Voir l'état du compte", titleEn: "Check account status",
    descFr: "Affiche un résumé : connexion, objectif en cours et dernières actions des agents.",
    descEn: "Shows a summary: connection, current objective and the agents' latest actions.",
    exFr: "Ex : /status", exEn: "E.g. /status",
  },
  {
    cmd: "texte libre", icon: "💬",
    titleFr: "Écrire naturellement", titleEn: "Write naturally",
    descFr: "Pas besoin de commande : décrivez ce que vous voulez, c'est traité comme un lancement.",
    descEn: "No command needed: describe what you want, it's handled as a launch.",
    exFr: "Ex : Prépare 3 posts sur notre nouveau service", exEn: "E.g. Prepare 3 posts about our new service",
  },
  {
    cmd: "/aide", icon: "❓",
    titleFr: "Obtenir de l'aide", titleEn: "Get help",
    descFr: "Affiche toutes les commandes disponibles et des exemples concrets.",
    descEn: "Shows all available commands and concrete examples.",
    exFr: "Ex : /aide", exEn: "E.g. /aide",
  },
];

// ── Exemples concrets de messages, groupés par thème ────────────────────────────
// Tournés vers ce que le produit sait réellement faire (publier, programmer,
// analyser, piloter les pubs). Rédigés en langage naturel, bilingues.

const EXAMPLE_GROUPS: {
  icon: string; titleFr: string; titleEn: string;
  items: { fr: string; en: string }[];
}[] = [
  {
    icon: "✍️", titleFr: "Publier", titleEn: "Publish",
    items: [
      { fr: "Publie sur Instagram : « Nouvelle collection disponible en boutique 🎉 »", en: "Post on Instagram: “New collection now available in store 🎉”" },
      { fr: "Crée un post LinkedIn pour annoncer notre levée de fonds", en: "Create a LinkedIn post to announce our funding round" },
      { fr: "Génère 3 idées de posts pour cette semaine", en: "Generate 3 post ideas for this week" },
      { fr: "Rédige une légende avec des hashtags pour cette photo produit", en: "Write a caption with hashtags for this product photo" },
      { fr: "Décline ce post en version Facebook, Instagram et LinkedIn", en: "Adapt this post into Facebook, Instagram and LinkedIn versions" },
    ],
  },
  {
    icon: "🗓️", titleFr: "Programmer", titleEn: "Schedule",
    items: [
      { fr: "Programme un post demain à 9h sur Facebook", en: "Schedule a post tomorrow at 9am on Facebook" },
      { fr: "Planifie 3 publications cette semaine aux meilleures heures", en: "Plan 3 posts this week at the best times" },
      { fr: "Liste mes posts programmés", en: "List my scheduled posts" },
      { fr: "Décale le post de vendredi à lundi 8h", en: "Move Friday's post to Monday 8am" },
      { fr: "Annule la publication prévue ce soir", en: "Cancel the post scheduled for tonight" },
    ],
  },
  {
    icon: "📈", titleFr: "Analyser", titleEn: "Analyse",
    items: [
      { fr: "Quelles sont mes stats de la semaine ?", en: "What are my stats for this week?" },
      { fr: "Analyse la performance de mes pubs", en: "Analyse the performance of my ads" },
      { fr: "Quel post a le mieux marché ce mois-ci ?", en: "Which post performed best this month?" },
      { fr: "Résume mes messages et commentaires non lus", en: "Summarise my unread messages and comments" },
      { fr: "Compare mon engagement à celui du mois dernier", en: "Compare my engagement to last month" },
    ],
  },
  {
    icon: "🎯", titleFr: "Piloter les pubs", titleEn: "Manage ads",
    items: [
      { fr: "Crée une publicité Meta à 20 €/jour pour promouvoir la boutique", en: "Create a Meta ad at €20/day to promote the store" },
      { fr: "Mets en pause la campagne « Soldes d'été »", en: "Pause the “Summer Sale” campaign" },
      { fr: "Augmente le budget de ma meilleure campagne de 10 €/jour", en: "Increase my best campaign's budget by €10/day" },
      { fr: "Rédige une réponse au dernier commentaire reçu", en: "Draft a reply to the latest comment" },
      { fr: "Quel est mon coût par conversion en ce moment ?", en: "What is my cost per conversion right now?" },
    ],
  },
];
