"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CHANNELS } from "@/lib/channels";
import { ChannelConnectionCard, type ConnectionRow } from "@/components/admin/ChannelConnectionCard";
import { Toast } from "@/components/ui/Toast";
import type { ConnectionStatus } from "@/lib/repositories/channel-connections";
import { useT } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiRow {
  channel: string;
  status: ConnectionStatus;
  config: Record<string, string>;
}

interface ToastState {
  message: string;
  key: number;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConnexionsPage() {
  const params = useParams();
  const t = useT();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  const [connections, setConnections] = useState<ApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  // ── Chargement initial ───────────────────────────────────────────────────────

  const loadConnections = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/channel-connections?companyId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`${t("Erreur", "Error")} ${res.status}`);
      const data: ApiRow[] = await res.json();
      setConnections(data);
    } catch (err) {
      console.error("[connexions] chargement:", err);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // ── Sauvegarde d'un canal ────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (
      channel: string,
      config: Record<string, string>,
      status: ConnectionStatus
    ) => {
      try {
        const res = await fetch("/api/channel-connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: id, channel, config, status }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `${t("Erreur", "Error")} ${res.status}`);
        }

        const updated: ApiRow = await res.json();

        // Met à jour localement
        setConnections((prev) =>
          prev.map((c) => (c.channel === channel ? { ...c, ...updated } : c))
        );

        setToast({
          message:
            status === "connected"
              ? t(`Canal ${channel} connecté avec succès.`, `Channel ${channel} connected successfully.`)
              : t(`Connexion ${channel} enregistrée (en attente).`, `${channel} connection saved (pending).`),
          key: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("Erreur inconnue", "Unknown error");
        setToast({ message: `${t("Erreur :", "Error:")} ${msg}`, key: Date.now() });
      }
    },
    [id]
  );

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function connectionFor(channelId: string): ConnectionRow | null {
    const row = connections.find((c) => c.channel === channelId);
    if (!row) return null;
    return {
      channel: row.channel,
      status: row.status,
      config: row.config,
    };
  }

  const groups: Array<{ key: "social" | "measure"; label: string }> = [
    { key: "social", label: t("Réseaux sociaux", "Social networks") },
    { key: "measure", label: t("Mesure & tracking", "Measurement & tracking") },
  ];

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg
          className="h-5 w-5 animate-spin text-muted"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span className="ml-3 text-sm text-muted">{t("Chargement des connexions…", "Loading connections…")}</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link
          href="/admin/comptes"
          className="hover:text-ink hover:underline underline-offset-2"
        >
          {t("Comptes & entités", "Accounts & entities")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/admin/comptes/${id}`}
          className="hover:text-ink hover:underline underline-offset-2"
        >
          {t("Fiche entité", "Entity details")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink font-medium">{t("Connexions canaux", "Channel connections")}</span>
      </div>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">{t("Réceptacles de connexion", "Connection receptacles")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Renseignez les tokens et identifiants de chaque canal pour cet espace de travail.",
              "Enter the tokens and identifiers for each channel in this workspace."
            )}{" "}
            {t("Les champs marqués", "Fields marked")}{" "}
            <span className="rounded bg-warning-50 px-1 py-0.5 text-2xs font-semibold text-warning-700">{t("secret", "secret")}</span>{" "}
            {t("ne sont jamais affichés en clair après enregistrement.", "are never displayed in plain text after saving.")}
          </p>
        </div>
        <Link
          href={`/admin/comptes/${id}`}
          className="btn-secondary shrink-0 text-xs"
        >
          ← {t("Fiche entité", "Entity details")}
        </Link>
      </div>

      {/* Résumé connexions */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((ch) => {
            const conn = connectionFor(ch.id);
            const status = conn?.status ?? "disconnected";
            return (
              <span
                key={ch.id}
                className={`chip flex items-center gap-1.5 ${
                  status === "connected"
                    ? "bg-success-50 text-success-700"
                    : status === "pending"
                    ? "bg-warning-50 text-warning-700"
                    : "text-muted"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ch.color }}
                  aria-hidden="true"
                />
                {ch.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Groupes */}
      {groups.map((group) => {
        const channels = CHANNELS.filter((ch) => ch.group === group.key);
        return (
          <section key={group.key} className="space-y-4">
            <div className="section-label">{group.label}</div>
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {channels.map((ch) => (
                <ChannelConnectionCard
                  key={ch.id}
                  channelDef={ch}
                  connection={connectionFor(ch.id)}
                  onSave={handleSave}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
