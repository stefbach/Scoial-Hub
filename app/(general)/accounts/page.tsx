"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { ConnectGuide } from "@/components/connect/ConnectGuide";
import type { ConnectorStatus } from "@/lib/connectors/types";
import { useT } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// /accounts — HUB DE CONNEXION SIMPLE ET UNIQUE.
//
// Objectif UX : supprimer la confusion « je connecte où ? ». Cette page est LE
// point d'entrée pour connecter Facebook, Instagram et LinkedIn en UN clic via
// l'assistant guidé `ConnectGuide` (aucun token à coller). La page
// /parametres-connecteurs reste accessible, présentée comme l'option AVANCÉE.
//
// Le statut « Connecté ✓ / Non connecté » a une seule source de vérité :
// GET /api/connectors?companyId=… (branché sur sh_channel_connections).
// ---------------------------------------------------------------------------

type PlatformId = "facebook" | "instagram" | "linkedin";

interface PlatformView {
  platform: PlatformId;
  /** Vrai si au moins un compte actif est présent. */
  connected: boolean;
  /** Détail des comptes enregistrés. */
  accounts: ConnectorStatus["accounts"];
}

function toPlatformViews(statuses: ConnectorStatus[] | null): PlatformView[] | null {
  if (!statuses) return null;
  return statuses.map((s) => ({
    platform: s.platform as PlatformId,
    connected: s.connectedAccounts > 0,
    accounts: s.accounts,
  }));
}

// ---------------------------------------------------------------------------
// Métadonnées plateformes. `connectVia` = plateforme passée à ConnectGuide :
// FB et IG partagent le flux Meta, LinkedIn est séparé.
// ---------------------------------------------------------------------------

const PLATFORM_META: Record<
  PlatformId,
  {
    label: string;
    color: string;
    bg: string;
    ring: string;
    dot: string;
    connectVia: "meta" | "linkedin";
  }
> = {
  facebook: {
    label: "Facebook",
    color: "text-[#1877F2]",
    bg: "bg-[#1877F2]/10",
    ring: "ring-[#1877F2]/20",
    dot: "bg-[#1877F2]",
    connectVia: "meta",
  },
  instagram: {
    label: "Instagram",
    color: "text-[#E1306C]",
    bg: "bg-[#E1306C]/10",
    ring: "ring-[#E1306C]/20",
    dot: "bg-[#E1306C]",
    connectVia: "meta",
  },
  linkedin: {
    label: "LinkedIn",
    color: "text-[#0A66C2]",
    bg: "bg-[#0A66C2]/10",
    ring: "ring-[#0A66C2]/20",
    dot: "bg-[#0A66C2]",
    connectVia: "linkedin",
  },
};

const PLATFORMS: PlatformId[] = ["facebook", "instagram", "linkedin"];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsPageInner />
    </Suspense>
  );
}

function AccountsPageInner() {
  const t = useT();
  const { company } = useCompany();
  const searchParams = useSearchParams();

  const [toast, setToast] = useState<string | null>(null);

  // Assistant guidé : on mémorise quelle plateforme (meta | linkedin) ouvrir.
  const [guidePlatform, setGuidePlatform] = useState<"meta" | "linkedin" | null>(null);

  // Statut connecteurs — SEULE source de vérité (GET /api/connectors).
  const [connectorStatuses, setConnectorStatuses] = useState<ConnectorStatus[] | null>(null);
  const [connectorLoading, setConnectorLoading] = useState(true);
  const [connectorError, setConnectorError] = useState(false);

  const fetchStatuses = (signal?: { cancelled: boolean }) => {
    setConnectorLoading(true);
    setConnectorError(false);
    return fetch(`/api/connectors?companyId=${encodeURIComponent(company.id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ConnectorStatus[]>;
      })
      .then((statuses) => {
        if (!signal?.cancelled) {
          setConnectorStatuses(statuses);
          setConnectorLoading(false);
        }
      })
      .catch(() => {
        if (!signal?.cancelled) {
          setConnectorError(true);
          setConnectorLoading(false);
        }
      });
  };

  // Fetch connector status on mount (statut RÉEL par société).
  useEffect(() => {
    const signal = { cancelled: false };
    fetchStatuses(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  // Handle return from OAuth callback (query params).
  useEffect(() => {
    const simulated = searchParams.get("simulated");
    const connected = searchParams.get("connected");
    const platform = searchParams.get("platform");
    const account = searchParams.get("account");
    const error = searchParams.get("error");

    if (simulated === "true" && connected === "true") {
      const label = platform ? PLATFORM_META[platform as PlatformId]?.label ?? platform : "plateforme";
      const name = account ? ` (${account})` : "";
      setToast(
        `${t("Connexion simulée —", "Simulated connection —")} ${label}${name} — ${t(
          "clés API requises pour une vraie connexion.",
          "API keys required for a real connection."
        )}`
      );
    } else if (connected && platform) {
      const label = PLATFORM_META[platform as PlatformId]?.label ?? platform;
      const name = account ? ` : ${account}` : "";
      setToast(`${label} ${t("connecté", "connected")}${name}.`);
      // Refresh connector status after a successful connection.
      fetchStatuses();
    } else if (error) {
      const desc =
        error === "oauth_denied"
          ? t("Autorisation refusée par la plateforme.", "Authorization denied by the platform.")
          : error === "missing_code"
          ? t("Code d'autorisation manquant dans le callback.", "Authorization code missing from callback.")
          : error === "exchange_failed"
          ? t("Échec de l'échange du code OAuth. Réessayez.", "OAuth code exchange failed. Please try again.")
          : `${t("Erreur OAuth :", "OAuth error:")} ${error}`;
      setToast(desc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const platformViews = useMemo(() => toPlatformViews(connectorStatuses), [connectorStatuses]);

  const viewFor = (platform: PlatformId): PlatformView | undefined =>
    platformViews?.find((v) => v.platform === platform);

  // État vide : aucune plateforme connectée (et chargement terminé sans erreur).
  const noneConnected =
    !!platformViews && platformViews.every((v) => !v.connected);

  return (
    <div className="animate-fade-in">
      <PageHeader title={t("Comptes & connexions", "Accounts & connections")} />

      {/* Bandeau d'intro — explique le « quoi » en une phrase simple */}
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-ai-text/20 bg-ai-textbg px-4 py-3 text-xs text-ai-text shadow-xs">
        <InfoIcon className="mt-0.5 shrink-0" />
        <span>
          {t(
            "Connectez vos réseaux en un clic. La connexion Meta couvre Facebook et Instagram ensemble ; LinkedIn est séparé. Aucun token à copier.",
            "Connect your networks in one click. The Meta connection covers Facebook and Instagram together; LinkedIn is separate. No token to copy."
          )}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Plateformes — statut réel (GET /api/connectors)                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-2 flex items-center gap-2">
        <div className="section-label">{t("Vos réseaux", "Your networks")}</div>
      </div>

      {/* Chargement — Spinner */}
      {connectorLoading && (
        <div className="card flex items-center gap-2.5 p-4 text-2xs text-muted">
          <Spinner size={16} className="text-primary-600" />
          <span>{t("Chargement du statut des connexions…", "Loading connection status…")}</span>
        </div>
      )}

      {/* Erreur de chargement */}
      {connectorError && !connectorLoading && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-2xs text-warning-700">
          <span>
            {t(
              "Impossible de récupérer le statut des connexions.",
              "Unable to fetch connection status."
            )}
          </span>
          <button
            onClick={() => fetchStatuses()}
            className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            {t("Réessayer", "Retry")}
          </button>
        </div>
      )}

      {!connectorLoading && !connectorError && platformViews && (
        <>
          {/* État vide encourageant */}
          {noneConnected && (
            <div className="card mb-3 flex flex-col items-center gap-2 p-6 text-center">
              <span className="text-sm font-semibold text-ink">
                {t("Aucun réseau connecté", "No network connected")}
              </span>
              <p className="max-w-md text-xs text-muted">
                {t(
                  "Connectez votre premier réseau pour démarrer : publication, planification et statistiques.",
                  "Connect your first network to get started: publishing, scheduling and analytics."
                )}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {PLATFORMS.map((platform) => (
              <ConnectorCard
                key={platform}
                platform={platform}
                view={viewFor(platform)}
                onConnect={(via) => setGuidePlatform(via)}
              />
            ))}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Configuration avancée → /parametres-connecteurs                     */}
      {/* ------------------------------------------------------------------ */}
      <a
        href="/parametres-connecteurs"
        className="card mt-5 flex items-center gap-3 p-4 transition-colors hover:border-primary-300 hover:bg-canvas"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas ring-1 ring-hair">
          <SlidersIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">
            {t("Configuration avancée", "Advanced configuration")}
          </div>
          <p className="mt-0.5 text-2xs text-muted">
            {t(
              "Tokens manuels, autres connecteurs et réglages techniques.",
              "Manual tokens, other connectors and technical settings."
            )}
          </p>
        </div>
        <span aria-hidden="true" className="shrink-0 text-muted">
          →
        </span>
      </a>

      {/* Assistant guidé (Meta ou LinkedIn) — un clic, returnTo=/accounts */}
      <ConnectGuide
        open={guidePlatform !== null}
        onClose={() => setGuidePlatform(null)}
        platform={guidePlatform ?? "meta"}
        companyId={company.id}
        returnTo="/accounts"
      />

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConnectorCard — statut + bouton « Connecter » (ouvre l'assistant guidé)
// ---------------------------------------------------------------------------

function ConnectorCard({
  platform,
  view,
  onConnect,
}: {
  platform: PlatformId;
  view: PlatformView | undefined;
  onConnect: (via: "meta" | "linkedin") => void;
}) {
  const t = useT();
  const meta = PLATFORM_META[platform];
  const connected = view?.connected ?? false;
  const accounts = view?.accounts ?? [];

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: logo + info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Platform colour dot */}
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ${meta.bg} ${meta.ring}`}
              aria-hidden="true"
            >
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            </span>
            <span className="text-sm font-semibold text-ink">{meta.label}</span>

            {/* Statut visuel : Connecté ✓ / Non connecté */}
            {connected ? (
              <StatusBadge tone="green" dot>
                {t("Connecté", "Connected")} ✓
              </StatusBadge>
            ) : (
              <StatusBadge tone="gray">{t("Non connecté", "Not connected")}</StatusBadge>
            )}
          </div>

          {/* Comptes connectés */}
          {connected && accounts.length > 0 && (
            <ul className="mt-2 space-y-1">
              {accounts.map((acc) => (
                <li
                  key={acc.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      acc.status === "active" ? meta.dot : "bg-warning-400"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words font-medium text-ink">{acc.accountName}</span>
                  {acc.externalId && (
                    <span className="min-w-0 break-all opacity-60">· {acc.externalId}</span>
                  )}
                  {acc.status !== "active" && <StatusBadge tone="amber">{acc.status}</StatusBadge>}
                </li>
              ))}
            </ul>
          )}

          {/* Non connecté — invitation */}
          {!connected && (
            <p className="mt-1 text-2xs text-muted">
              {platform === "instagram" || platform === "facebook"
                ? t(
                    "Connexion Meta : Facebook et Instagram d'un seul clic.",
                    "Meta connection: Facebook and Instagram in one click."
                  )
                : t(
                    "Connectez LinkedIn pour publier sur votre profil ou Page.",
                    "Connect LinkedIn to publish on your profile or Page."
                  )}
            </p>
          )}
        </div>

        {/* Right: bouton « Connecter » — ouvre l'assistant guidé en UN clic */}
        <div className="shrink-0">
          <button
            onClick={() => onConnect(meta.connectVia)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              connected ? "btn-secondary" : "btn-primary"
            }`}
          >
            {connected ? t("Reconnecter", "Reconnect") : t("Connecter", "Connect")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icônes
// ---------------------------------------------------------------------------

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted">
      <path
        d="M4 8h10M18 8h2M4 16h2M10 16h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="16" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
