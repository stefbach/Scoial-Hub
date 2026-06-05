"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/lib/i18n";
import { CHANNEL_LABELS, type InboxAgent, type InboxChannel } from "@/lib/inbox/types";

const CHANNELS: InboxChannel[] = ["facebook", "instagram", "linkedin", "telegram", "twitter"];

/** Création / édition d'un agent de réponse. */
export function AgentModal({
  open,
  onClose,
  companyId,
  agent,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  agent?: InboxAgent | null;
  onSaved: (a: InboxAgent) => void;
}) {
  const t = useT();
  const editing = Boolean(agent);

  const [name, setName] = useState(agent?.name ?? "");
  const [scope, setScope] = useState<InboxAgent["scope"]>(agent?.scope ?? "all");
  const [channels, setChannels] = useState<InboxChannel[]>(agent?.channels ?? []);
  const [autonomy, setAutonomy] = useState<InboxAgent["autonomy"]>(agent?.autonomy ?? "suggest");
  const [language, setLanguage] = useState<InboxAgent["language"]>(agent?.language ?? "auto");
  const [persona, setPersona] = useState(agent?.persona ?? "");
  const [signature, setSignature] = useState(agent?.signature ?? "");
  const [threshold, setThreshold] = useState(agent?.confidenceThreshold ?? 0.7);
  const [keywords, setKeywords] = useState((agent?.escalationKeywords ?? []).join(", "));
  const [enabled, setEnabled] = useState(agent?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(c: InboxChannel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError(t("Donnez un nom à l'agent.", "Give the agent a name."));
      return;
    }
    if (scope === "channel" && channels.length === 0) {
      setError(t("Choisissez au moins un canal.", "Pick at least one channel."));
      return;
    }
    setSaving(true);
    const payload = {
      companyId,
      name: name.trim(),
      scope,
      channels: scope === "channel" ? channels : [],
      autonomy,
      language,
      persona: persona.trim(),
      signature: signature.trim(),
      confidenceThreshold: threshold,
      escalationKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      enabled,
    };
    try {
      const url = editing ? `/api/inbox/agents/${agent!.id}` : "/api/inbox/agents";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      onSaved(data as InboxAgent);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de l'enregistrement.", "Save failed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl">
      <div className="border-b border-hair px-5 py-3.5">
        <h2 className="text-base font-semibold text-ink">
          {editing ? t("Modifier l'agent", "Edit agent") : t("Nouvel agent de réponse", "New reply agent")}
        </h2>
        <p className="mt-0.5 text-2xs text-muted">
          {t(
            "Il répond aux messages dans la voix de la marque et escalade aux humains si besoin.",
            "It replies to messages in the brand voice and escalates to humans when needed."
          )}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <label className="section-label">{t("Nom", "Name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("ex. Community Manager", "e.g. Community Manager")}
            className="mt-1 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
          />
        </div>

        <div>
          <label className="section-label">{t("Périmètre", "Scope")}</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${scope === "all" ? "border-primary-400 bg-primary-50 text-primary-700" : "border-hair text-muted hover:bg-canvas"}`}
            >
              <span className="block font-semibold">{t("Un agent pour tout", "One agent for everything")}</span>
              {t("Tous les canaux", "All channels")}
            </button>
            <button
              type="button"
              onClick={() => setScope("channel")}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${scope === "channel" ? "border-primary-400 bg-primary-50 text-primary-700" : "border-hair text-muted hover:bg-canvas"}`}
            >
              <span className="block font-semibold">{t("Un agent par canal", "One agent per channel")}</span>
              {t("Canaux choisis", "Selected channels")}
            </button>
          </div>
        </div>

        {scope === "channel" && (
          <div>
            <label className="section-label">{t("Canaux gérés", "Channels handled")}</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={`rounded-full border px-3 py-1 text-2xs font-medium ${channels.includes(c) ? "border-primary-400 bg-primary-50 text-primary-700" : "border-hair text-muted hover:bg-canvas"}`}
                >
                  {CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="section-label">{t("Autonomie", "Autonomy")}</label>
            <select
              value={autonomy}
              onChange={(e) => setAutonomy(e.target.value as InboxAgent["autonomy"])}
              className="mt-1 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
            >
              <option value="suggest">{t("Suggérer (valider à la main)", "Suggest (human approves)")}</option>
              <option value="auto">{t("Répondre seul si confiant", "Auto-reply when confident")}</option>
            </select>
          </div>
          <div>
            <label className="section-label">{t("Langue", "Language")}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as InboxAgent["language"])}
              className="mt-1 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
            >
              <option value="auto">{t("Auto (langue du message)", "Auto (message language)")}</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div>
          <label className="section-label">
            {t("Consignes du « maître »", "“Master” instructions")}
          </label>
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={3}
            placeholder={t(
              "Ton, ce qu'il peut dire, ce qu'il ne doit jamais promettre, infos clés (horaires, livraison…)…",
              "Tone, what it may say, what it must never promise, key facts (hours, delivery…)…"
            )}
            className="mt-1 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="section-label">
              {t("Seuil de confiance", "Confidence threshold")} · {Math.round(threshold * 100)}%
            </label>
            <input
              type="range"
              min={0.3}
              max={0.95}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-2 w-full accent-primary-600"
            />
            <p className="text-2xs text-muted">
              {t("En dessous → passe à un humain.", "Below this → hand off to a human.")}
            </p>
          </div>
          <div>
            <label className="section-label">{t("Signature", "Signature")}</label>
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={t("— L'équipe", "— The team")}
              className="mt-1 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
            />
          </div>
        </div>

        <div>
          <label className="section-label">
            {t("Mots qui forcent un humain", "Keywords forcing a human")}
          </label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={t("remboursement, avocat, plainte…", "refund, lawyer, complaint…")}
            className="mt-1 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
          />
          <p className="mt-1 text-2xs text-muted">
            {t(
              "Séparés par des virgules. Des sujets sensibles sont déjà escaladés d'office.",
              "Comma-separated. Sensitive topics are already escalated by default."
            )}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-primary-600" />
          {t("Agent actif", "Agent enabled")}
        </label>

        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-hair px-5 py-3">
        <button onClick={onClose} className="btn-secondary text-sm">{t("Annuler", "Cancel")}</button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
          {saving ? t("Enregistrement…", "Saving…") : editing ? t("Enregistrer", "Save") : t("Créer l'agent", "Create agent")}
        </button>
      </div>
    </Modal>
  );
}
