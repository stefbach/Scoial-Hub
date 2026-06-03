"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";

// ── Démarrage guidé ─────────────────────────────────────────────────────────────
// Parcours pas-à-pas pour rendre chaque client 100 % autonome : il suit les étapes
// dans l'ordre, voit en temps réel ce qui est fait, et accède à chaque page d'un clic.

interface RawConnection {
  channel: string;
  status: "connected" | "pending" | "disconnected";
}

type StepStatus = "done" | "todo" | "info";

interface Step {
  n: number;
  href: string;
  cta: { fr: string; en: string };
  title: { fr: string; en: string };
  desc: { fr: string; en: string };
  detail: { fr: string; en: string };
  status: StepStatus;
}

export default function DemarragePage() {
  const { company } = useCompany();
  const t = useT();
  const companyId = company.id;

  const [channelsConnected, setChannelsConnected] = useState<number>(0);
  const [telegramOn, setTelegramOn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    Promise.all([
      fetch(`/api/channel-connections?companyId=${encodeURIComponent(companyId)}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`/api/telegram/config?companyId=${encodeURIComponent(companyId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([rows, tg]) => {
      if (!alive) return;
      const list = (rows as RawConnection[]) || [];
      setChannelsConnected(list.filter((c) => c.status === "connected").length);
      setTelegramOn(tg?.status === "connected");
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [companyId]);

  const steps: Step[] = useMemo(
    () => [
      {
        n: 1,
        href: "/parametres-connecteurs",
        cta: { fr: "Connecter mes réseaux", en: "Connect my networks" },
        title: { fr: "Connecter vos réseaux & accès données", en: "Connect your networks & data access" },
        desc: {
          fr: "C'est le point de départ : reliez Facebook, Instagram, LinkedIn et TikTok, plus vos accès Ads et mesure (Pixel, GA4).",
          en: "This is the starting point: link Facebook, Instagram, LinkedIn and TikTok, plus your Ads and measurement access (Pixel, GA4).",
        },
        detail: {
          fr: "Chaque connecteur dispose d'un « réceptacle » sécurisé pour stocker ses identifiants. Renseignez-les une fois : les agents pourront lire vos statistiques (consultation) et publier en votre nom (écriture).",
          en: "Each connector has a secure “receptacle” to store its credentials. Fill them once: the agents will be able to read your statistics (read) and publish on your behalf (write).",
        },
        status: channelsConnected > 0 ? "done" : "todo",
      },
      {
        n: 2,
        href: "/veille",
        cta: { fr: "Lancer une veille", en: "Run market watch" },
        title: { fr: "Analyser votre marché & vos concurrents", en: "Analyse your market & competitors" },
        desc: {
          fr: "Indiquez votre marché, vos mots-clés et vos concurrents. AXON-AI scrute leurs posts et vidéos pour en extraire des angles gagnants.",
          en: "Enter your market, your keywords and your competitors. AXON-AI scans their posts and videos to extract winning angles.",
        },
        detail: {
          fr: "Le scraping est réalisé par nos outils maison (pas de service tiers). Vous obtenez un benchmark d'engagement, de formats et de thèmes qui nourrit toute la stratégie.",
          en: "Scraping is performed by our in-house tools (no third-party service). You get a benchmark of engagement, formats and themes that feeds the whole strategy.",
        },
        status: "info",
      },
      {
        n: 3,
        href: "/pilotage",
        cta: { fr: "Définir un objectif", en: "Set an objective" },
        title: { fr: "Fixer un objectif & lancer les agents", en: "Set an objective & launch the agents" },
        desc: {
          fr: "Décrivez ce que vous voulez (notoriété, leads, ventes). L'équipe d'agents IA construit la stratégie, les contenus et le plan média.",
          en: "Describe what you want (awareness, leads, sales). The AI agent team builds the strategy, the content and the media plan.",
        },
        detail: {
          fr: "Le Centre de pilotage orchestre 8 agents (stratège, copywriter, créatif, conformité, média, analyste, publisher). Vous gardez la main grâce à l'autonomie graduée L1 / L2 / L3.",
          en: "The Command Center orchestrates 8 agents (strategist, copywriter, creative, compliance, media, analyst, publisher). You stay in control thanks to graduated autonomy L1 / L2 / L3.",
        },
        status: "info",
      },
      {
        n: 4,
        href: "/compose",
        cta: { fr: "Créer un contenu", en: "Create content" },
        title: { fr: "Créer & programmer du contenu", en: "Create & schedule content" },
        desc: {
          fr: "Générez textes, images et vidéos aux bons formats (FB, IG, LinkedIn, TikTok) puis programmez-les dans le calendrier.",
          en: "Generate text, images and videos in the right formats (FB, IG, LinkedIn, TikTok) then schedule them in the calendar.",
        },
        detail: {
          fr: "Chaque visuel est produit au format exact attendu par le réceptacle ciblé. Retrouvez vos publications planifiées dans « Programmés ».",
          en: "Each visual is produced in the exact format expected by the targeted receptacle. Find your planned publications in “Scheduled”.",
        },
        status: "info",
      },
      {
        n: 5,
        href: "/telegram",
        cta: { fr: "Activer Telegram", en: "Activate Telegram" },
        title: { fr: "Piloter depuis Telegram", en: "Pilot from Telegram" },
        desc: {
          fr: "Activez votre bot Telegram dédié pour lancer une campagne, demander une veille ou voir vos KPIs, où que vous soyez.",
          en: "Activate your dedicated Telegram bot to launch a campaign, request a market watch or check your KPIs, wherever you are.",
        },
        detail: {
          fr: "Le bot est un agent à part entière qui dialogue avec les autres. Une seule conversation suffit pour piloter tout votre dispositif.",
          en: "The bot is a full agent that talks to the others. A single chat is enough to pilot your entire setup.",
        },
        status: telegramOn ? "done" : "todo",
      },
      {
        n: 6,
        href: "/mcp",
        cta: { fr: "Brancher Claude", en: "Connect Claude" },
        title: { fr: "Brancher Claude (MCP)", en: "Connect Claude (MCP)" },
        desc: {
          fr: "Pour les utilisateurs avancés : pilotez AXON-AI directement depuis Claude Desktop en langage naturel via le connecteur MCP.",
          en: "For advanced users: pilot AXON-AI directly from Claude Desktop in natural language via the MCP connector.",
        },
        detail: {
          fr: "Optionnel mais puissant : Claude peut lancer vos agents, générer des contenus et déclencher une veille sans quitter votre assistant.",
          en: "Optional but powerful: Claude can launch your agents, generate content and trigger a market watch without leaving your assistant.",
        },
        status: "info",
      },
    ],
    [channelsConnected, telegramOn]
  );

  const doneCount = steps.filter((s) => s.status === "done").length;
  const actionable = steps.filter((s) => s.status !== "info").length;
  const pct = actionable > 0 ? Math.round((doneCount / actionable) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* En-tête */}
      <div>
        <p className="section-label text-primary-500">{t("Démarrage guidé", "Guided onboarding")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          {t("Mettez " + company.name + " en pilotage automatique", "Put " + company.name + " on autopilot")}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "Suivez ces étapes dans l'ordre : en quelques minutes, votre équipe d'agents IA travaillera jour et nuit sur votre présence sociale, en organique comme en publicité.",
            "Follow these steps in order: within minutes, your AI agent team will work day and night on your social presence, both organic and paid."
          )}
        </p>
      </div>

      {/* Progression */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{t("Votre progression", "Your progress")}</span>
          <span className="text-sm font-semibold text-primary-700">
            {loaded ? `${doneCount}/${actionable}` : "…"}
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-canvas">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-page transition-all duration-500"
            style={{ width: `${loaded ? pct : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {doneCount === 0
            ? t("Commencez par l'étape 1 ci-dessous.", "Start with step 1 below.")
            : doneCount >= actionable
            ? t("Bravo, l'essentiel est en place — affinez à votre rythme.", "Well done, the essentials are in place — refine at your own pace.")
            : t("Continuez, vous y êtes presque.", "Keep going, you're almost there.")}
        </p>
      </div>

      {/* Étapes */}
      <ol className="space-y-3">
        {steps.map((step) => {
          const done = step.status === "done";
          const todo = step.status === "todo";
          return (
            <li
              key={step.n}
              className={`card p-5 transition-all ${done ? "border-success-200 bg-success-50/40" : ""}`}
            >
              <div className="flex items-start gap-4">
                {/* Pastille numéro / check */}
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    done
                      ? "bg-success-500 text-white"
                      : todo
                      ? "bg-primary text-white"
                      : "bg-canvas text-muted ring-1 ring-hair"
                  }`}
                  aria-hidden
                >
                  {done ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    step.n
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">{t(step.title.fr, step.title.en)}</h3>
                    {done && (
                      <span className="rounded-full bg-success-100 px-2 py-0.5 text-2xs font-semibold text-success-700">
                        {t("Fait", "Done")}
                      </span>
                    )}
                    {step.status === "info" && (
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-600">
                        {t("À explorer", "To explore")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t(step.desc.fr, step.desc.en)}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted/80">{t(step.detail.fr, step.detail.en)}</p>

                  <Link
                    href={step.href}
                    className={`mt-3 inline-flex items-center gap-1.5 ${done ? "btn-secondary" : "btn-primary"} text-xs`}
                  >
                    {done ? t("Revoir", "Review") : t(step.cta.fr, step.cta.en)}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Aide */}
      <div className="rounded-xl border border-hair bg-canvas px-5 py-4 text-sm text-muted">
        {t(
          "Besoin d'aide à n'importe quelle étape ? Cliquez sur le bouton « Aide » en haut à droite : chaque page dispose d'un guide détaillé.",
          "Need help at any step? Click the “Help” button at the top right: every page has a detailed guide."
        )}
      </div>
    </div>
  );
}
