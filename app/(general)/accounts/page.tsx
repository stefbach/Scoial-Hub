"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { Toast } from "@/components/ui/Toast";
import { disconnectMeta, setMeta, mergeConnectorStatus } from "@/lib/connection-store";
import { TEAM } from "@/lib/mock-data";
import type { MetaConnection } from "@/lib/types";
import type { ConnectorStatus } from "@/lib/connectors/types";
import type { PlatformView } from "@/lib/connection-store";
import { useT } from "@/lib/i18n";

// Anchor "today" to the same point the rest of the app uses for the seed data.
const TODAY = new Date("2026-05-30T00:00:00");
const SAFETY_DAYS = 7;

function readOnlyExpiry(meta?: MetaConnection): Date | null {
  if (!meta?.connectedAt) return null;
  const d = new Date(`${meta.connectedAt}T00:00:00`);
  d.setDate(d.getDate() + SAFETY_DAYS);
  return d;
}

function safetyState(meta?: MetaConnection): "active" | "expired" | "expired-but-kept" | "off" {
  if (!meta || !meta.connected) return "off";
  const exp = readOnlyExpiry(meta);
  if (!exp) return "off";
  const isExpired = TODAY.getTime() >= exp.getTime();
  if (!isExpired && meta.readOnly) return "active";
  if (isExpired && meta.readOnly && meta.keepReadOnlyAfterSafety) return "expired-but-kept";
  if (isExpired && meta.readOnly) return "expired";
  return "off";
}

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  return format(d, "d MMM yyyy");
}

const USER_EMAIL = TEAM[0]?.email ?? "you@example.com";

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
  const { company, data } = useCompany();
  const searchParams = useSearchParams();

  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Native connector status (from GET /api/connectors)
  const [connectorStatuses, setConnectorStatuses] = useState<ConnectorStatus[] | null>(null);
  const [connectorLoading, setConnectorLoading] = useState(true);
  const [connectorError, setConnectorError] = useState(false);

  // Fetch connector status on mount
  useEffect(() => {
    let cancelled = false;
    setConnectorLoading(true);
    setConnectorError(false);
    fetch("/api/connectors")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ConnectorStatus[]>;
      })
      .then((statuses) => {
        if (!cancelled) {
          setConnectorStatuses(statuses);
          setConnectorLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnectorError(true);
          setConnectorLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle return from OAuth callback (query params)
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
    } else if (connected === "true" && platform) {
      const label = PLATFORM_META[platform as keyof typeof PLATFORM_META]?.label ?? platform;
      const name = account ? ` : ${account}` : "";
      setToast(`${label} ${t("connecté", "connected")}${name}.`);
      // Refresh connector status after successful connection
      fetch("/api/connectors")
        .then((r) => r.json() as Promise<ConnectorStatus[]>)
        .then(setConnectorStatuses)
        .catch(() => undefined);
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

  const platformViews = useMemo(() => mergeConnectorStatus(connectorStatuses), [connectorStatuses]);

  const meta = data.meta;
  const state = safetyState(meta);
  const expiry = readOnlyExpiry(meta);

  const noticeText = useMemo(() => {
    if (state === "active") {
      return `${t("Accès pub : lecture seule jusqu'au", "Ads access: read-only until")} ${fmtDate(expiry)}. ${t("Passez en contrôle total après la période de sécurité.", "Switch to full control after the safety period.")}`;
    }
    if (state === "expired-but-kept") {
      return t(
        "Accès pub : lecture seule (maintenu après la période de sécurité). Désactivez dans les paramètres pour autoriser le contrôle total des publicités.",
        "Ads access: read-only (kept active after safety period). Disable in Manage settings to allow full ad control."
      );
    }
    return null;
  }, [state, expiry, t]);

  // Helper: find PlatformView for a given platform
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

      {/* Meta section (legacy mock-based) */}
      <div className="mb-2 flex items-center gap-2">
        <div className="section-label">Meta (Facebook + Instagram)</div>
      </div>
      {meta?.connected ? (
        <ConnectedMetaCard
          companyCode={company.code}
          meta={meta}
          notice={noticeText}
          onReconnectDisabledTooltip={t(
            "La gestion de connexion sera disponible quand l'intégration Meta sera connectée.",
            "Connection management will be enabled when Meta integration is wired."
          )}
          onDisconnect={() => setConfirmDisconnect(true)}
          onManage={() => setManageOpen(true)}
        />
      ) : (
        <DisconnectedMetaCard companyCode={company.code} companyName={company.name} />
      )}

      {/* LinkedIn section (legacy) */}
      <div className="mb-2 mt-6 flex items-center gap-2">
        <div className="section-label">LinkedIn</div>
      </div>
      <div className="card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{t("Page Entreprise LinkedIn", "LinkedIn Company Page")}</span>
              <StatusBadge tone="gray">{t("Non connecté", "Not connected")}</StatusBadge>
            </div>
            <p className="mt-1 text-2xs text-muted">
              {t(
                `Connectez la Page Entreprise LinkedIn de ${company.code} pour publier des posts organiques. Nécessite l'accès à la LinkedIn Marketing Developer Platform (approbation sous 5 à 10 jours ouvrés).`,
                `Connect ${company.code}'s LinkedIn Company Page to publish organic posts. Requires LinkedIn Marketing Developer Platform access (approval takes 5–10 business days).`
              )}
            </p>
          </div>
          <Button variant="primary" onClick={() => setLinkedinOpen(true)}>{t("Connecter", "Connect")}</Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Native connectors section                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-2 mt-8 flex items-center gap-2">
        <div className="section-label">{t("Connecteurs natifs", "Native connectors")}</div>
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
          {(["facebook", "instagram", "linkedin"] as const).map((platform) => {
            const view = viewFor(platform);
            return (
              <NativeConnectorCard
                key={platform}
                platform={platform}
                view={view}
                companyId={company.id}
                onConnected={() => {
                  fetch("/api/connectors")
                    .then((r) => r.json() as Promise<ConnectorStatus[]>)
                    .then(setConnectorStatuses)
                    .catch(() => undefined);
                  refresh();
                }}
              />
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modals                                                               */}
      {/* ------------------------------------------------------------------ */}

      {confirmDisconnect && (
        <DisconnectModal
          companyName={company.name}
          onCancel={() => setConfirmDisconnect(false)}
          onConfirm={() => {
            disconnectMeta(company.id);
            setConfirmDisconnect(false);
            refresh();
          }}
        />
      )}

      {manageOpen && meta && (
        <ManageAdsAccessModal
          companyName={company.name}
          meta={meta}
          expiry={expiry}
          state={state}
          onClose={() => setManageOpen(false)}
          onSave={(keep) => {
            setMeta(company.id, { keepReadOnlyAfterSafety: keep });
            setManageOpen(false);
            refresh();
          }}
        />
      )}

      {linkedinOpen && (
        <LinkedInModal
          companyName={company.name}
          email={USER_EMAIL}
          onClose={() => setLinkedinOpen(false)}
          onNotify={() => {
            setLinkedinOpen(false);
            setToast(t(
              `Nous vous enverrons un email à ${USER_EMAIL} dès que l'intégration LinkedIn sera disponible.`,
              `We'll email you at ${USER_EMAIL} when LinkedIn integration is available.`
            ));
          }}
        />
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
  onConnected,
}: {
  platform: "facebook" | "instagram" | "linkedin";
  view: PlatformView | undefined;
  companyId: string;
  onConnected: () => void;
}) {
  const t = useT();
  const meta = PLATFORM_META[platform];
  const configured = view?.configured ?? false;
  const hasActive = view?.hasActiveAccount ?? false;
  const accounts = view?.accounts ?? [];

  // Build the auth URL with companyId and return path so the OAuth callback
  // redirects back to this page and registers the connection correctly.
  const authUrl = `/api/connectors/${platform}/auth?companyId=${encodeURIComponent(companyId)}&return=/accounts`;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left: logo + info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
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
                href="/docs/CONNECTORS-NATIVE.md"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-ink"
              >
                {t("Voir la documentation", "View documentation")}
              </a>
              .
            </p>
          )}

          {/* Connected accounts list */}
          {configured && accounts.length > 0 && (
            <ul className="mt-2 space-y-1">
              {accounts.map((acc) => (
                <li key={acc.id} className="flex items-center gap-2 text-2xs text-muted">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      acc.status === "active"
                        ? meta.dot
                        : "bg-warning-400"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-ink">{acc.accountName}</span>
                  {acc.externalId && <span className="opacity-60">· {acc.externalId}</span>}
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

// ---------------------------------------------------------------------------
// Existing sub-components (unchanged)
// ---------------------------------------------------------------------------

function ConnectedMetaCard({
  companyCode,
  meta,
  notice,
  onReconnectDisabledTooltip,
  onDisconnect,
  onManage,
}: {
  companyCode: string;
  meta: MetaConnection;
  notice: string | null;
  onReconnectDisabledTooltip: string;
  onDisconnect: () => void;
  onManage: () => void;
}) {
  const t = useT();
  return (
    <div className="card mb-5 overflow-hidden p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">Meta Business Manager</span>
            <StatusBadge tone="green">{t("Connecté", "Connected")}</StatusBadge>
          </div>
          <div className="mt-1 space-y-0.5 text-2xs text-muted">
            <div>{t("Connecté via Meta Official MCP ·", "Connected via Meta Official MCP ·")} {meta.connectedAt ? fmtDate(new Date(`${meta.connectedAt}T00:00:00`)) : "—"}</div>
            <div>Business Manager: {meta.businessManagerName ?? `${companyCode} Holdings`}</div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" disabled title={onReconnectDisabledTooltip}>{t("Reconnecter", "Reconnect")}</Button>
          <Button variant="danger" onClick={onDisconnect}>{t("Déconnecter", "Disconnect")}</Button>
        </div>
      </div>

      <div className="mt-4 border-t border-hair pt-4">
        <div className="section-label mb-2.5">{t("Pages & comptes disponibles", "Pages & accounts available")}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-hair bg-canvas px-3 py-2.5">
            <div className="text-xs font-semibold text-ink">
              {meta.facebookPageName ?? `${companyCode} Facebook Page`}
            </div>
            <div className="mt-0.5 text-2xs text-muted">{t("Organique + Publicités", "Organic + Ads")}</div>
          </div>
          <div className="rounded-lg border border-hair bg-canvas px-3 py-2.5">
            <div className="text-xs font-semibold text-ink">
              {meta.instagramHandle ?? `@${companyCode.toLowerCase()}_mauritius`}
            </div>
            <div className="mt-0.5 text-2xs text-muted">{t("Business · Organique + Publicités", "Business · Organic + Ads")}</div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5">
          <span className="text-2xs text-warning-700">{notice}</span>
          <Button variant="secondary" className="py-1 text-2xs" onClick={onManage}>{t("Gérer", "Manage")}</Button>
        </div>
      )}
    </div>
  );
}

function DisconnectedMetaCard({ companyCode, companyName }: { companyCode: string; companyName: string }) {
  const t = useT();
  return (
    <div className="mb-5 rounded-xl border border-dashed border-hair bg-canvas/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">Meta Business Manager</span>
            <StatusBadge tone="gray">{t("Non connecté", "Not connected")}</StatusBadge>
          </div>
          <p className="mt-1 text-2xs text-muted">
            {t(
              `Connectez la Page Facebook et le compte Instagram de ${companyName} pour publier des posts organiques et diffuser des publicités.`,
              `Connect ${companyName}'s Facebook Page and Instagram account to publish organic posts and run ads.`
            )}
          </p>
          <p className="mt-1 text-2xs text-muted">
            {companyCode} {t("n'a pas encore de connexion Meta.", "has no Meta connection yet.")}
          </p>
        </div>
        <a
          href="/parametres-connecteurs"
          className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
        >
          {t("Connecter", "Connect")}
        </a>
      </div>
    </div>
  );
}

function DisconnectModal({
  companyName,
  onCancel,
  onConfirm,
}: {
  companyName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <Modal open onClose={onCancel} width="max-w-md">
      <div className="border-b border-hair px-4 py-3 text-sm font-semibold text-ink">
        {t(`Déconnecter Meta de ${companyName} ?`, `Disconnect Meta from ${companyName}?`)}
      </div>
      <div className="p-4 text-sm leading-relaxed text-ink">
        {t(
          `Tous les posts planifiés et campagnes actives de ${companyName} seront arrêtés. Vous pourrez vous reconnecter plus tard, mais les données que Meta aurait supprimées entre-temps ne seront pas récupérables.`,
          `All scheduled posts and active campaigns for ${companyName} will stop. You can reconnect later but data Meta may have deleted in the meantime won't be recoverable.`
        )}
      </div>
      <div className="flex items-center justify-between border-t border-hair px-4 py-3">
        <Button variant="danger" onClick={onConfirm}>{t("Déconnecter quand même", "Disconnect anyway")}</Button>
        <Button variant="primary" onClick={onCancel}>{t("Annuler", "Cancel")}</Button>
      </div>
    </Modal>
  );
}

function ManageAdsAccessModal({
  companyName,
  meta,
  expiry,
  state,
  onClose,
  onSave,
}: {
  companyName: string;
  meta: MetaConnection;
  expiry: Date | null;
  state: "active" | "expired" | "expired-but-kept" | "off";
  onClose: () => void;
  onSave: (keep: boolean) => void;
}) {
  const t = useT();
  const [keep, setKeep] = useState<boolean>(meta.keepReadOnlyAfterSafety);

  const expiryLine =
    state === "active"
      ? `${t("Lecture seule expire le :", "Read-only expires:")} ${fmtDate(expiry)}`
      : state === "expired-but-kept"
      ? `${t("Période de sécurité terminée le", "Safety period ended")} ${fmtDate(expiry)} — ${t("lecture seule maintenue par préférence.", "read-only kept on by preference.")}`
      : state === "expired"
      ? `${t("Période de sécurité terminée le", "Safety period ended")} ${fmtDate(expiry)}.`
      : t("La lecture seule est actuellement désactivée.", "Read-only is currently off.");

  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b border-hair px-4 py-3 text-sm font-semibold text-ink">
        {t(`Gérer l'accès publicitaire pour ${companyName}`, `Manage ads access for ${companyName}`)}
      </div>

      <div className="space-y-5 p-4">
        <div>
          <div className="section-label mb-2">{t("État actuel", "Current state")}</div>
          <div className="text-sm font-medium text-ink">{t("Actuellement : Mode lecture seule", "Currently: Read-only mode")}</div>
          <div className="mt-0.5 text-2xs text-muted">
            {t(
              "AXON-AI peut consulter les données publicitaires mais ne peut pas créer, modifier ni mettre en pause les publicités.",
              "AXON-AI can view ad data but cannot create, edit, or pause ads."
            )}
          </div>
          <div className="mt-1 text-2xs text-muted">{expiryLine}</div>
        </div>

        <div>
          <div className="section-label mb-2">{t("Paramètres", "Settings")}</div>
          <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-hair bg-canvas/50 p-3 transition-colors hover:bg-canvas">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">
                {t(
                  "Maintenir le mode lecture seule après la fin de la période de sécurité",
                  "Keep read-only mode after the safety period ends"
                )}
              </div>
              <div className="mt-0.5 text-2xs text-muted">
                {t(
                  "Recommandé si vous souhaitez utiliser AXON-AI uniquement pour la publication organique et les analytiques, sans lui accorder la permission de dépenser en publicités.",
                  "Recommended if you want to use AXON-AI for organic posting and analytics only, without giving it permission to spend on ads."
                )}
              </div>
            </div>
            <Toggle defaultOn={keep} onChange={setKeep} />
          </label>
        </div>

        <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-2xs text-warning-700">
          <div className="flex items-start gap-2">
            <InfoIcon className="mt-0.5 shrink-0 text-warning-700" />
            <span>
              {t(
                "Une fois la période de sécurité terminée et le mode lecture seule désactivé, AXON-AI peut créer des campagnes, modifier des budgets et mettre en pause des publicités en votre nom. Toutes les actions restent soumises aux garde-fous de dépenses configurés dans Paramètres → Sécurité publicitaire.",
                "Once the safety period ends and read-only mode is off, AXON-AI can create campaigns, modify budgets, and pause ads on your behalf. All actions remain subject to the spend safeguards configured in Settings → Ad Safety."
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button variant="primary" onClick={() => onSave(keep)}>{t("Enregistrer", "Save")}</Button>
      </div>
    </Modal>
  );
}

function LinkedInModal({
  companyName,
  email,
  onClose,
  onNotify,
}: {
  companyName: string;
  email: string;
  onClose: () => void;
  onNotify: () => void;
}) {
  const t = useT();
  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b border-hair px-4 py-3 text-sm font-semibold text-ink">
        {t("Connecter LinkedIn — bientôt disponible", "Connect LinkedIn — coming soon")}
      </div>
      <div className="space-y-3 p-4 text-sm leading-relaxed text-ink">
        <p>
          {t(
            "L'intégration LinkedIn nécessite l'approbation de la LinkedIn Marketing Developer Platform. Nous avons fait une demande d'accès — l'approbation prend généralement 5 à 10 jours ouvrés après la soumission.",
            "LinkedIn integration requires approval from LinkedIn's Marketing Developer Platform. We've applied for access — approval typically takes 5–10 business days after the request is submitted."
          )}
        </p>
        <p>
          {t(
            `Une fois approuvé, vous pourrez publier des posts organiques sur la Page Entreprise LinkedIn de ${companyName}. Les publicités LinkedIn sont une fonctionnalité future distincte.`,
            `Once approved, you'll be able to publish organic posts to ${companyName}'s LinkedIn Company Page. LinkedIn ads are a separate future capability.`
          )}
        </p>
        <p className="text-2xs text-muted">
          {t(`Nous notifierons ${email} quand l'intégration sera disponible.`, `We'll notify ${email} when integration is ready.`)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-hair px-4 py-3">
        <a
          href="https://developer.linkedin.com/product-catalog/marketing"
          target="_blank"
          rel="noreferrer"
          className="text-2xs text-ai-text underline hover:text-ai-text/80"
        >
          {t("En savoir plus sur l'approbation de l'API LinkedIn", "Learn more about LinkedIn API approval")}
        </a>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-xs text-muted hover:text-ink">
            {t("Fermer", "Close")}
          </button>
          <Button variant="primary" onClick={onNotify}>{t("Me notifier quand disponible", "Notify me when ready")}</Button>
        </div>
      </div>
    </Modal>
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
