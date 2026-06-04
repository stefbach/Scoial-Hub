"use client";

// ── Connecteurs du démarrage ─────────────────────────────────────────────────
// Permet de connecter tous les réseaux sociaux DÈS l'étape 1 du parcours.
// Réutilise le mécanisme existant : /api/channel-connections (lecture/écriture)
// + OAuth 1-clic pour Facebook/Instagram/LinkedIn. Renvoie vers /demarrage.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { CHANNELS } from "@/lib/channels";
import { ConnectorAccessCard } from "@/components/settings/ConnectorAccessCard";
import type { AccessCapability, ConnectorStatus } from "@/components/settings/ConnectorAccessCard";

interface RawConnection {
  channel: string;
  status: "connected" | "pending" | "disconnected";
  config: Record<string, string>;
}

// Réseaux sociaux uniquement (les connecteurs avancés restent dans /parametres-connecteurs)
const SOCIAL = CHANNELS.filter((c) => c.group === "social");

// Capacités lecture/écriture par réseau (affichage)
const CAPS: Record<string, AccessCapability[]> = {
  facebook: [
    { type: "read", label: "Insights" },
    { type: "write", label: "Publication" },
    { type: "write", label: "Ads" },
  ],
  instagram: [
    { type: "read", label: "Insights" },
    { type: "write", label: "Publication" },
    { type: "write", label: "Commentaires" },
  ],
  linkedin: [
    { type: "read", label: "Statistiques" },
    { type: "write", label: "Publication" },
  ],
  tiktok: [
    { type: "read", label: "Analytics" },
    { type: "write", label: "Publication" },
  ],
};

const ICONS: Record<string, string> = { facebook: "f", instagram: "◎", linkedin: "in", tiktok: "tt" };

export function OnboardingConnectors() {
  const t = useT();
  const { company } = useCompany();
  const companyId = company.id;

  const [connections, setConnections] = useState<Record<string, RawConnection>>({});
  const [loading, setLoading] = useState(true);

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
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [companyId]);

  const handleSave = useCallback(
    async (id: string, values: Record<string, string>): Promise<{ ok: boolean; error?: string }> => {
      const def = SOCIAL.find((c) => c.id === id);
      const conn = connections[id];
      let status: "connected" | "pending" = "pending";
      if (def) {
        const allFilled = def.fields.every((f) =>
          f.secret
            ? values[f.key]?.trim() !== "" || conn?.config[f.key] === "__secret__"
            : values[f.key]?.trim() !== ""
        );
        if (allFilled) status = "connected";
      }
      try {
        const res = await fetch("/api/channel-connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, channel: id, config: values, status }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          return { ok: false, error: body.error ?? t("Erreur lors de l'enregistrement.", "Error while saving.") };
        }
        const updated = (await res.json()) as RawConnection;
        setConnections((prev) => ({ ...prev, [id]: updated }));
        return { ok: true };
      } catch {
        return { ok: false, error: t("Erreur réseau.", "Network error.") };
      }
    },
    [companyId, connections, t]
  );

  const connectedCount = SOCIAL.filter((c) => connections[c.id]?.status === "connected").length;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="section-label">{t("Connectez vos comptes", "Connect your accounts")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {t(
              "Reliez vos réseaux dès maintenant : les agents pourront lire vos statistiques et publier en votre nom. Connexion en 1 clic (Facebook / Instagram / LinkedIn) ou via vos identifiants.",
              "Link your networks now: agents will read your stats and publish on your behalf. 1-click connect (Facebook / Instagram / LinkedIn) or via your credentials."
            )}
          </p>
        </div>
        <span className="section-label shrink-0">
          {connectedCount}/{SOCIAL.length} {t("connectés", "connected")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {SOCIAL.map((def) => {
          const conn = connections[def.id];
          const status: ConnectorStatus = loading
            ? "disconnected"
            : ((conn?.status as ConnectorStatus) ?? "disconnected");
          return (
            <ConnectorAccessCard
              key={def.id}
              id={def.id}
              label={def.label}
              color={def.color}
              icon={ICONS[def.id]}
              description={def.description}
              where={def.where}
              capabilities={CAPS[def.id] ?? []}
              fields={def.fields}
              status={status}
              config={conn?.config ?? {}}
              onSave={handleSave}
              oauthUrl={
                ["facebook", "instagram", "linkedin"].includes(def.id)
                  ? `/api/connectors/${def.id}/auth?companyId=${encodeURIComponent(companyId)}&return=${encodeURIComponent("/demarrage")}`
                  : undefined
              }
            />
          );
        })}
      </div>

      <Link
        href="/parametres-connecteurs"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
      >
        {t("Connecteurs avancés (Ads, mesure, IA)", "Advanced connectors (Ads, measurement, AI)")}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}
