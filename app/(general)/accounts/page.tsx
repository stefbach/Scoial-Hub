"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toast } from "@/components/ui/Toast";
import type { ConnectorStatus } from "@/lib/connectors/types";
import { useT } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Vue fusionnée par plateforme — dérivée UNIQUEMENT du statut réel renvoyé par
// GET /api/connectors (branché sur sh_channel_connections). Plus aucune source
// mock locale : le statut « connecté » a désormais une seule source de vérité.
// ---------------------------------------------------------------------------

interface PlatformView {
  platform: "facebook" | "instagram" | "linkedin";
  /** Clés d'env présentes côté serveur. */
  configured: boolean;
  /** Nombre de comptes actifs en base. */
  connectedAccounts: number;
  /** Détail des comptes enregistrés. */
  accounts: ConnectorStatus["accounts"];
  /** Vrai si au moins un compte actif est présent. */
  hasActiveAccount: boolean;
}

function toPlatformViews(statuses: ConnectorStatus[] | null): PlatformView[] | null {
  if (!statuses) return null;
  return statuses.map((s) => ({
    platform: s.platform,
    configured: s.configured,
    connectedAccounts: s.connectedAccounts,
    accounts: s.accounts,
    hasActiveAccount: s.connectedAccounts > 0,
  }));
}

// ---------------------------------------------------------------------------
// Platform colours / labels
// ---------------------------------------------------------------------------

const PLATFORM_META = {
  facebook: {
    label: "Facebook",
    color: "text-[#1877F2]",
    bg: "bg-[#1877F2]/10",
    ring: "ring-[#1877F2]/20",
    dot: "bg-[#1877F2]",
  },
  instagram: {
    label: "Instagram",
    color: "text-[#E1306C]",
    bg: "bg-[#E1306C]/10",
    ring: "ring-[#E1306C]/20",
    dot: "bg-[#E1306C]",
  },
  linkedin: {
    label: "LinkedIn",
    color: "text-[#0A66C2]",
    bg: "bg-[#0A66C2]/10",
    ring: "ring-[#0A66C2]/20",
    dot: "bg-[#0A66C2]",
  },
} as const;

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
      const label = platform ? PLATFORM_META[platform as keyof typeof PLATFORM_META]?.label ?? platform : "plateforme";
      const name = account ? ` (${account})` : "";
      setToast(`${t("Connexion simulée —", "Simulated connection —")} ${label}${name} — ${t("clés API requises pour une vraie connexion.", "API keys required for a real connection.")}`);
    } else if (connected && platform) {
      const label = PLATFORM_META[platform as keyof typeof PLATFORM_META]?.label ?? platform;
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

  // Helper: find PlatformView for a given platform.
  const viewFor = (platform: "facebook" | "instagram" | "linkedin"): PlatformView | undefined =>
    platformViews?.find((v) => v.platform === platform);

  return (
    <div className="animate-fade-in">
      <PageHeader title={t("Comptes connectés", "Connected accounts")} />

      {/* Info banner */}
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-ai-text/20 bg-ai-textbg px-4 py-3 text-xs text-ai-text shadow-xs">
        <InfoIcon className="mt-0.5 shrink-0" />
        <span>
          {t(
            "Connectez chaque plateforme une fois par entreprise. La connexion Meta couvre Facebook et Instagram (organique + publicités) ensemble. LinkedIn est séparé.",
            "Connect each platform once per company. Meta's connection covers Facebook and Instagram (organic + ads) together. LinkedIn is separate."
          )}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Connecteurs — statut réel (GET /api/connectors)                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-2 flex items-center gap-2">
        <div className="section-label">{t("Plateformes", "Platforms")}</div>
      </div>

      {connectorLoading && (
        <div className="card p-4 text-2xs text-muted">{t("Chargement du statut des connecteurs…", "Loading connector status…")}</div>
      )}

      {connectorError && !connectorLoading && (
        <div className="card p-4 text-2xs text-warning-700">
          {t(
            "Impossible de récupérer le statut des connecteurs. Vérifiez votre connexion et rechargez la page.",
            "Unable to fetch connector status. Check your connection and reload the page."
          )}
        </div>
      )}

      {!connectorLoading && !connectorError && platformViews && (
        <div className="space-y-3">
          {(["facebook", "instagram", "linkedin"] as const).map((platform) => (
            <NativeConnectorCard
              key={platform}
              platform={platform}
              view={viewFor(platform)}
              companyId={company.id}
            />
          ))}
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NativeConnectorCard
// ---------------------------------------------------------------------------

function NativeConnectorCard({
  platform,
  view,
  companyId,
}: {
  platform: "facebook" | "instagram" | "linkedin";
  view: PlatformView | undefined;
  companyId: string;
}) {
  const t = useT();
  const meta = PLATFORM_META[platform];
  const configured = view?.configured ?? false;
  const hasActive = view?.hasActiveAccount ?? false;
  const accounts = view?.accounts ?? [];

  // CTA unique « Connecter Meta » : on démarre toujours le flux OAuth interne et
  // on revient sur cette page une fois connecté. (En mode simulé, le callback
  // renvoie un statut `simulated` géré par le toast.)
  const authUrl = `/api/connectors/${platform}/auth?companyId=${encodeURIComponent(companyId)}&return=/accounts`;

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

            {/* Status badge */}
            {!configured ? (
              <StatusBadge tone="gray">{t("Mode simulé", "Simulated mode")}</StatusBadge>
            ) : hasActive ? (
              <StatusBadge tone="green" dot>{t("Connecté", "Connected")}</StatusBadge>
            ) : (
              <StatusBadge tone="gray">{t("Non connecté", "Not connected")}</StatusBadge>
            )}
          </div>

          {/* Simulated mode notice */}
          {!configured && (
            <p className="mt-1 text-2xs text-muted">
              {t("Mode simulé — clés API requises pour une connexion réelle.", "Simulated mode — API keys required for a real connection.")}{" "}
              <a
                href="/parametres-connecteurs"
                className="underline hover:text-ink"
              >
                {t("Configurer les connecteurs", "Configure connectors")}
              </a>
              .
            </p>
          )}

          {/* Connected accounts list */}
          {configured && accounts.length > 0 && (
            <ul className="mt-2 space-y-1">
              {accounts.map((acc) => (
                <li key={acc.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      acc.status === "active"
                        ? meta.dot
                        : "bg-warning-400"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words font-medium text-ink">{acc.accountName}</span>
                  {acc.externalId && <span className="min-w-0 break-all opacity-60">· {acc.externalId}</span>}
                  {acc.status !== "active" && (
                    <StatusBadge tone="amber">{acc.status}</StatusBadge>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* No accounts but configured */}
          {configured && accounts.length === 0 && (
            <p className="mt-1 text-2xs text-muted">
              {t(
                "Aucun compte connecté. Cliquez sur « Connecter » pour démarrer le flux OAuth.",
                "No accounts connected. Click \"Connect\" to start the OAuth flow."
              )}
            </p>
          )}
        </div>

        {/* Right: connect button */}
        <div className="shrink-0">
          {configured ? (
            <a
              href={authUrl}
              className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              {hasActive ? t("Reconnecter", "Reconnect") : t("Connecter", "Connect")}
            </a>
          ) : (
            <a
              href={authUrl}
              className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              title={t("En mode simulé — aucune vraie connexion ne sera effectuée", "Simulated mode — no real connection will be made")}
            >
              {t("Simuler", "Simulate")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
