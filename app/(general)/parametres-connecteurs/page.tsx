"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { CHANNELS } from "@/lib/channels";
import { ConnectorAccessCard } from "@/components/settings/ConnectorAccessCard";
import type {
  ConnectorStatus,
  ConnectorField,
  AccessCapability,
  ConnectorAccessCardProps,
} from "@/components/settings/ConnectorAccessCard";
import { Toast } from "@/components/ui/Toast";

// ── Types internes ──────────────────────────────────────────────────────────────

interface RawConnection {
  channel: string;
  status: "connected" | "pending" | "disconnected";
  config: Record<string, string>;
}

interface ToastState {
  msg: string;
  ok: boolean;
}

// ── Catalogue étendu : capacités lecture/écriture par connecteur ────────────────

type ConnectorMeta = {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  where?: string;
  capabilities: AccessCapability[];
  fields: ConnectorField[];
  group: "social" | "ads" | "measure" | "ai" | "scraping";
  envHint?: string;
  comingSoon?: boolean;
};

const CONNECTOR_CATALOG: ConnectorMeta[] = [
  // ── Réseaux sociaux ──────────────────────────────────────────────────────────
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    icon: "f",
    description: "Page Facebook : publication organique, insights et Marketing API.",
    where: "developers.facebook.com → ton app → Business Manager → Page",
    group: "social",
    capabilities: [
      { type: "read", label: "Lecture insights" },
      { type: "read", label: "Lecture audience" },
      { type: "write", label: "Publication posts" },
      { type: "write", label: "Gestion Ads" },
    ],
    fields: [
      { key: "page_id", label: "Page ID", placeholder: "1234567890" },
      { key: "business_manager_id", label: "Business Manager ID", placeholder: "BM ID" },
      {
        key: "page_access_token",
        label: "Page Access Token",
        secret: true,
        help: "Token long ou System User",
      },
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    color: "#E1306C",
    icon: "◎",
    description: "Compte Instagram Business lié à la Page FB : feed, stories & reels.",
    where: "Compte IG Business relié à la Page Facebook (Meta)",
    group: "social",
    capabilities: [
      { type: "read", label: "Lecture insights" },
      { type: "read", label: "Commentaires" },
      { type: "write", label: "Publication médias" },
      { type: "write", label: "Réponse DM/commentaires" },
    ],
    fields: [
      {
        key: "ig_business_account_id",
        label: "IG Business Account ID",
        placeholder: "1789...",
      },
    ],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0A66C2",
    icon: "in",
    description: "Page entreprise LinkedIn + Marketing API.",
    where: "linkedin.com/developers → app → Marketing Developer Platform",
    group: "social",
    capabilities: [
      { type: "read", label: "Lecture statistiques" },
      { type: "read", label: "Lecture mentions" },
      { type: "write", label: "Publication posts" },
      { type: "write", label: "Gestion campagnes" },
    ],
    fields: [
      {
        key: "organization_urn",
        label: "Organization URN",
        placeholder: "urn:li:organization:123",
      },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "#010101",
    icon: "tt",
    description: "TikTok for Business / Marketing API — publication et analytics.",
    where: "business-api.tiktok.com → app → advertiser",
    group: "social",
    capabilities: [
      { type: "read", label: "Lecture analytics" },
      { type: "write", label: "Publication vidéos" },
      { type: "write", label: "Gestion Ads" },
    ],
    fields: [
      { key: "advertiser_id", label: "Advertiser ID", placeholder: "70123..." },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },

  // ── Publicité / Ads ──────────────────────────────────────────────────────────
  {
    id: "meta_ads",
    label: "Meta Ads",
    color: "#1877F2",
    icon: "◈",
    description: "Campagnes publicitaires Facebook & Instagram via Marketing API.",
    where: "Meta Business Suite → Compte publicitaire → Marketing API",
    group: "ads",
    capabilities: [
      { type: "read", label: "Lecture campagnes" },
      { type: "read", label: "Lecture performances" },
      { type: "write", label: "Création campagnes" },
      { type: "write", label: "Optimisation budgets" },
    ],
    fields: [
      { key: "ad_account_id", label: "Ad Account ID", placeholder: "act_XXXXXXXXX" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },

  // ── Mesure & conversions ────────────────────────────────────────────────────
  {
    id: "meta_pixel",
    label: "Meta Pixel + CAPI",
    color: "#1877F2",
    icon: "px",
    description: "Suivi des conversions navigateur (Pixel) + serveur (Conversions API).",
    where: "Meta Events Manager → Pixel → Conversions API",
    group: "measure",
    capabilities: [
      { type: "read", label: "Lecture événements" },
      { type: "write", label: "Envoi événements conversion" },
      { type: "write", label: "Match audiences Custom" },
    ],
    fields: [
      { key: "pixel_id", label: "Pixel ID", placeholder: "987654321" },
      { key: "capi_token", label: "CAPI Access Token", secret: true },
    ],
  },
  {
    id: "ga4",
    label: "Google Analytics 4",
    color: "#E8710A",
    icon: "G",
    description: "Mesure web, attribution multi-touch et audiences GA4.",
    where: "analytics.google.com → Admin → Property + Cloud (Data API)",
    group: "measure",
    capabilities: [
      { type: "read", label: "Lecture rapports" },
      { type: "read", label: "Lecture audiences" },
      { type: "write", label: "Envoi Measurement Protocol" },
    ],
    fields: [
      { key: "property_id", label: "Property ID", placeholder: "GA4 property" },
      { key: "measurement_id", label: "Measurement ID", placeholder: "G-XXXXXXX" },
      {
        key: "api_secret",
        label: "API Secret (Measurement Protocol)",
        secret: true,
      },
    ],
  },

  // ── IA & génération ──────────────────────────────────────────────────────────
  {
    id: "anthropic",
    label: "Anthropic Claude",
    color: "#D4763B",
    icon: "Cl",
    description: "Génération de texte (copies, posts, analyses) via Claude Sonnet / Haiku.",
    where: "console.anthropic.com → API Keys",
    group: "ai",
    capabilities: [
      { type: "write", label: "Génération de contenu" },
      { type: "write", label: "Analyse & synthèse" },
      { type: "write", label: "Suggestions stratégiques" },
    ],
    fields: [],
    envHint:
      "Renseignez ANTHROPIC_API_KEY dans vos variables d'environnement (Vercel → Settings → Environment Variables ou fichier .env.local).",
  },
  {
    id: "replicate",
    label: "Replicate",
    color: "#6B00F5",
    icon: "Re",
    description: "Génération d'images, vidéos et audio via les modèles open-source hébergés.",
    where: "replicate.com → Account → API tokens",
    group: "ai",
    capabilities: [
      { type: "write", label: "Génération d'images" },
      { type: "write", label: "Génération vidéo" },
      { type: "write", label: "Synthèse audio" },
    ],
    fields: [],
    envHint:
      "Renseignez REPLICATE_API_TOKEN dans vos variables d'environnement (Vercel → Settings → Environment Variables ou fichier .env.local).",
  },

  // ── Veille / Scraping ────────────────────────────────────────────────────────
  {
    id: "youtube",
    label: "YouTube Data API",
    color: "#FF0000",
    icon: "▶",
    description: "Veille vidéo : recherche, métriques et tendances sur YouTube.",
    where: "console.cloud.google.com → APIs & Services → YouTube Data API v3",
    group: "scraping",
    capabilities: [
      { type: "read", label: "Recherche vidéos" },
      { type: "read", label: "Métriques chaîne" },
      { type: "read", label: "Tendances & mots-clés" },
    ],
    fields: [],
    envHint:
      "Renseignez YOUTUBE_API_KEY dans vos variables d'environnement (Vercel → Settings → Environment Variables ou fichier .env.local).",
  },
];

// ── Groupes d'affichage ──────────────────────────────────────────────────────────

const GROUPS: { id: ConnectorMeta["group"]; label: string; subtitle: string }[] = [
  {
    id: "social",
    label: "Réseaux sociaux",
    subtitle: "Publication organique, insights et gestion de communauté",
  },
  {
    id: "ads",
    label: "Publicité & Ads",
    subtitle: "Création, optimisation et reporting de campagnes payantes",
  },
  {
    id: "measure",
    label: "Mesure & conversions",
    subtitle: "Suivi des événements, attribution et analytics",
  },
  {
    id: "ai",
    label: "IA & génération",
    subtitle: "Modèles de langage et génération de visuels/vidéos",
  },
  {
    id: "scraping",
    label: "Veille & scraping",
    subtitle: "Collecte de données et surveillance des tendances",
  },
];

// Identifiants gérés par /api/channel-connections (ceux de CHANNELS)
const CHANNEL_IDS: Set<string> = new Set(CHANNELS.map((c) => c.id));

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ParametresConnecteursPage() {
  const { company } = useCompany();
  const companyId = company.id;

  // Connexions chargées depuis /api/channel-connections
  const [connections, setConnections] = useState<Record<string, RawConnection>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  // ── Chargement initial des connexions ────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetch(`/api/channel-connections?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows: RawConnection[]) => {
        if (!alive) return;
        const map: Record<string, RawConnection> = {};
        for (const row of rows) map[row.channel] = row;
        setConnections(map);
      })
      .catch(() => {
        // Dégradation gracieuse : on laisse les statuts à "disconnected"
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  // ── Sauvegarde d'un connecteur ───────────────────────────────────────────────
  const handleSave = useCallback(
    async (
      id: string,
      values: Record<string, string>
    ): Promise<{ ok: boolean; error?: string }> => {
      // Connecteurs sans API de sauvegarde (AI, Scraping) → ne rien faire
      if (!CHANNEL_IDS.has(id)) return { ok: true };

      // Calcule le statut : "connected" si tous les champs obligatoires sont remplis
      const meta = CONNECTOR_CATALOG.find((c) => c.id === id);
      const conn = connections[id];
      let status: "connected" | "pending" = "pending";
      if (meta) {
        const allFilled = meta.fields.every((f) => {
          if (f.secret) {
            return values[f.key]?.trim() !== "" || conn?.config[f.key] === "__secret__";
          }
          return values[f.key]?.trim() !== "";
        });
        if (allFilled) status = "connected";
      }

      try {
        const res = await fetch("/api/channel-connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, channel: id, config: values, status }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as { error?: string }).error ?? "Erreur lors de l'enregistrement.";
          setToast({ ok: false, msg });
          return { ok: false, error: msg };
        }

        const updated = (await res.json()) as RawConnection;
        setConnections((prev) => ({ ...prev, [id]: updated }));
        setToast({ ok: true, msg: `${meta?.label ?? id} : configuration enregistrée.` });
        return { ok: true };
      } catch {
        const msg = "Erreur réseau. Vérifiez votre connexion.";
        setToast({ ok: false, msg });
        return { ok: false, error: msg };
      }
    },
    [companyId, connections]
  );

  // ── Résolution statut connecteur ─────────────────────────────────────────────
  function resolveStatus(meta: ConnectorMeta): ConnectorStatus {
    if (!CHANNEL_IDS.has(meta.id)) {
      // Connecteurs AI/Scraping : statut simulé (géré via env)
      return "simulated";
    }
    const conn = connections[meta.id];
    if (!conn) return loading ? "disconnected" : "disconnected";
    return conn.status as ConnectorStatus;
  }

  function resolveConfig(meta: ConnectorMeta): Record<string, string> {
    return connections[meta.id]?.config ?? {};
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-8">
      {/* En-tête de page */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">
          Connecteurs &amp; accès données
        </h1>
        <p className="mt-1 text-sm text-muted">
          Centralisez ici tous vos accès externes. Configurez chaque connecteur
          pour que AXON-AI puisse consulter vos données ou agir en votre nom.
        </p>
      </div>

      {/* Encart explicatif */}
      <div className="rounded-xl border border-primary-200 bg-primary-50/60 px-5 py-4 space-y-3">
        <h2 className="text-sm font-semibold text-ink">
          Comprendre les niveaux d&apos;accès
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-100 ring-1 ring-primary-200">
              <svg className="h-3.5 w-3.5 text-primary-700" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 3a5 5 0 100 10A5 5 0 008 3zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" />
                <path d="M8 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-semibold text-ink">Lecture (consultation)</p>
              <p className="text-xs text-muted leading-relaxed">
                Récupère vos statistiques, insights et données analytiques pour les afficher
                dans les tableaux de bord. Aucune action n&apos;est effectuée sur vos comptes.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success-50 ring-1 ring-success-200">
              <svg className="h-3.5 w-3.5 text-success-700" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M11.986 3H8a4 4 0 100 8h3.986a4 4 0 000-8zM8 5a2 2 0 100 4h3.986a2 2 0 000-4H8z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-semibold text-ink">Écriture (action / publication)</p>
              <p className="text-xs text-muted leading-relaxed">
                Autorise les agents à publier, répondre, créer des campagnes ou envoyer
                des événements. Chaque action reste dans les limites définies par votre équipe.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grille par groupe */}
      {GROUPS.map((group) => {
        const items = CONNECTOR_CATALOG.filter((c) => c.group === group.id);
        if (items.length === 0) return null;

        return (
          <section key={group.id} className="space-y-3">
            {/* Titre de section */}
            <div className="flex items-end justify-between gap-4 border-b border-hair pb-2">
              <div>
                <h2 className="text-sm font-bold text-ink">{group.label}</h2>
                <p className="text-xs text-muted mt-0.5">{group.subtitle}</p>
              </div>
              <span className="section-label shrink-0">
                {items.filter((c) => resolveStatus(c) === "connected").length}/
                {items.length} connectés
              </span>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {items.map((meta) => {
                const status = resolveStatus(meta);
                const config = resolveConfig(meta);

                const cardProps: ConnectorAccessCardProps = {
                  id: meta.id,
                  label: meta.label,
                  color: meta.color,
                  icon: meta.icon,
                  description: meta.description,
                  where: meta.where,
                  capabilities: meta.capabilities,
                  fields: meta.fields,
                  status: loading && CHANNEL_IDS.has(meta.id) ? "disconnected" : status,
                  config,
                  envHint: meta.envHint,
                  comingSoon: meta.comingSoon,
                  onSave: CHANNEL_IDS.has(meta.id) ? handleSave : undefined,
                };

                return (
                  <ConnectorAccessCard key={meta.id} {...cardProps} />
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Toast */}
      {toast && (
        <Toast
          message={
            toast.ok
              ? `✓ ${toast.msg}`
              : `⚠ ${toast.msg}`
          }
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
