"use client";

import { useState } from "react";
import type { ChannelDef } from "@/lib/channels";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ConnectionStatus } from "@/lib/repositories/channel-connections";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConnectionRow {
  channel: string;
  status: ConnectionStatus;
  /** config sanitisée : les secrets valent "__secret__" si remplis, absents sinon */
  config: Record<string, string>;
}

interface Props {
  channelDef: ChannelDef;
  connection: ConnectionRow | null;
  onSave: (
    channel: string,
    config: Record<string, string>,
    status: ConnectionStatus
  ) => Promise<void>;
}

// ── Helpers badge ─────────────────────────────────────────────────────────────

function statusBadge(status: ConnectionStatus) {
  if (status === "connected")
    return <StatusBadge tone="green" dot>Connecté</StatusBadge>;
  if (status === "pending")
    return <StatusBadge tone="amber" dot>En attente</StatusBadge>;
  return <StatusBadge tone="gray" dot>Déconnecté</StatusBadge>;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function ChannelConnectionCard({ channelDef, connection, onSave }: Props) {
  // Initialise les valeurs des champs :
  // - secret déjà rempli → chaîne vide (l'UI affiche placeholder •••)
  // - non secret → valeur existante ou vide
  const initialValues = () => {
    const vals: Record<string, string> = {};
    for (const field of channelDef.fields) {
      if (field.secret) {
        vals[field.key] = ""; // ne pas pré-remplir les secrets
      } else {
        vals[field.key] = connection?.config[field.key] ?? "";
      }
    }
    return vals;
  };

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [showWhere, setShowWhere] = useState(false);

  const currentStatus: ConnectionStatus = connection?.status ?? "disconnected";

  // Calcule le statut à enregistrer : "connected" si tous les champs non-secret
  // sont remplis ET (tous les champs secrets ont une valeur OU étaient déjà remplis)
  function computeStatus(): ConnectionStatus {
    for (const field of channelDef.fields) {
      if (field.secret) {
        const hasNew = values[field.key].trim() !== "";
        const hadBefore = connection?.config[field.key] === "__secret__";
        if (!hasNew && !hadBefore) return "pending";
      } else {
        if (!values[field.key].trim()) return "pending";
      }
    }
    return "connected";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const newStatus = computeStatus();
      await onSave(channelDef.id, values, newStatus);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: channelDef.color }}
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-bold text-ink">{channelDef.label}</h3>
            <p className="text-xs text-muted mt-0.5">{channelDef.description}</p>
          </div>
        </div>
        <div className="shrink-0">{statusBadge(currentStatus)}</div>
      </div>

      {/* Bandeau « où trouver » */}
      <div>
        <button
          type="button"
          onClick={() => setShowWhere((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
        >
          <svg
            className={`h-3 w-3 transition-transform ${showWhere ? "rotate-90" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {showWhere ? "Masquer" : "Où trouver ces informations ?"}
        </button>
        {showWhere && (
          <p className="mt-2 rounded-lg border border-hair bg-canvas px-3 py-2.5 text-xs text-muted leading-relaxed">
            {channelDef.where}
          </p>
        )}
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {channelDef.fields.map((field) => {
          const isSecret = field.secret ?? false;
          const hadValue = isSecret && connection?.config[field.key] === "__secret__";

          return (
            <div key={field.key} className="space-y-1">
              <label className="block text-xs font-medium text-ink" htmlFor={`${channelDef.id}-${field.key}`}>
                {field.label}
                {isSecret && (
                  <span className="ml-1.5 rounded bg-warning-50 px-1 py-0.5 text-2xs font-semibold text-warning-700">
                    secret
                  </span>
                )}
              </label>
              <input
                id={`${channelDef.id}-${field.key}`}
                type={isSecret ? "password" : "text"}
                className="input w-full"
                value={values[field.key]}
                placeholder={
                  hadValue
                    ? "••••••••  (valeur déjà enregistrée — laisser vide pour conserver)"
                    : (field.placeholder ?? "")
                }
                autoComplete={isSecret ? "new-password" : "off"}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
              {field.help && (
                <p className="text-2xs text-muted">{field.help}</p>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
