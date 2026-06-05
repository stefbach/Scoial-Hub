"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { CHANNEL_LABELS, type InboxAgent, type InboxChannel } from "@/lib/inbox/types";

interface TestResult {
  body: string;
  confidence: number;
  needsHuman: boolean;
  reason: string;
  sentiment: string;
}

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

  // Zone « Tester l'agent » : message d'exemple + résultat de l'aperçu.
  const [testOpen, setTestOpen] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function toggleChannel(c: InboxChannel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  /** Config courante du formulaire (non persistée) — partagée par save & test. */
  function currentAgentPayload() {
    return {
      name: name.trim(),
      scope,
      channels: scope === "channel" ? channels : [],
      autonomy,
      language,
      persona: persona.trim(),
      signature: signature.trim(),
      confidenceThreshold: threshold,
      escalationKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
    };
  }

  async function runTest() {
    setTestError(null);
    setTestResult(null);
    if (!testMessage.trim()) {
      setTestError(t("Tapez un message d'exemple.", "Type an example message."));
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/inbox/test-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          message: testMessage.trim(),
          agent: currentAgentPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "test failed");
      setTestResult(data as TestResult);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : t("Échec du test.", "Test failed."));
    } finally {
      setTesting(false);
    }
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
    const payload = { companyId, ...currentAgentPayload(), enabled };
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

        <div>
          <label className="section-label">{t("Comment l'agent agit", "How the agent acts")}</label>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setAutonomy("suggest")}
              aria-pressed={autonomy === "suggest"}
              className={`rounded-lg border px-3 py-2.5 text-left text-xs ${autonomy === "suggest" ? "border-primary-400 bg-primary-50 text-primary-700" : "border-hair text-muted hover:bg-canvas"}`}
            >
              <span className="block text-sm font-semibold text-ink">{t("Suggérer", "Suggest")}</span>
              <span className="mt-0.5 block">
                {t(
                  "Je relis et je valide chaque réponse.",
                  "I review and approve every reply."
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAutonomy("auto")}
              aria-pressed={autonomy === "auto"}
              className={`rounded-lg border px-3 py-2.5 text-left text-xs ${autonomy === "auto" ? "border-primary-400 bg-primary-50 text-primary-700" : "border-hair text-muted hover:bg-canvas"}`}
            >
              <span className="block text-sm font-semibold text-ink">{t("Répondre seul si confiant", "Reply on its own when confident")}</span>
              <span className="mt-0.5 block">
                {t(
                  "L'agent envoie, sauf sujets sensibles.",
                  "The agent sends, except on sensitive topics."
                )}
              </span>
            </button>
          </div>
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

        <div>
          <label className="section-label">{t("Niveau de prudence", "Caution level")}</label>
          <input
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label={t("Niveau de prudence", "Caution level")}
            className="mt-2 w-full accent-primary-600"
          />
          <div className="mt-1 flex items-center justify-between text-2xs font-medium text-muted">
            <span>{t("Prudent", "Cautious")}</span>
            <span>{t("Réactif", "Responsive")}</span>
          </div>
          <p className="mt-1 text-2xs text-muted">
            {t(
              "En dessous de ce seuil, l'agent passe la main à un humain.",
              "Below this threshold, the agent hands off to a human."
            )}
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

        {/* Tester l'agent : aperçu sur un message d'exemple, rien n'est enregistré. */}
        <div className="rounded-lg border border-hair bg-canvas p-3">
          <button
            type="button"
            onClick={() => setTestOpen((v) => !v)}
            aria-expanded={testOpen}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-ink"
          >
            <span>🧪 {t("Tester l'agent", "Test the agent")}</span>
            <span className="text-2xs font-medium text-muted">{testOpen ? "▲" : "▼"}</span>
          </button>

          {testOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-2xs text-muted">
                {t(
                  "Essayez un message client : vous verrez la réponse, la confiance, et si un humain doit reprendre. Rien n'est enregistré.",
                  "Try a customer message: you'll see the reply, the confidence, and whether a human is needed. Nothing is saved."
                )}
              </p>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={2}
                placeholder={t(
                  "ex. Bonjour, vous livrez en combien de temps ?",
                  "e.g. Hi, how long does delivery take?"
                )}
                className="w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
              />
              <button
                type="button"
                onClick={runTest}
                disabled={testing}
                className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {testing && <Spinner size={14} className="text-primary-600" />}
                {testing ? t("Test en cours…", "Testing…") : t("Lancer le test", "Run the test")}
              </button>

              {testError && (
                <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{testError}</p>
              )}

              {testResult && (
                <div className="space-y-2 rounded-lg border border-hair bg-card p-3">
                  <p className="whitespace-pre-wrap text-sm text-ink">{testResult.body}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs font-medium">
                    <span className="rounded-full border border-hair px-2 py-0.5 text-muted">
                      {t("Confiance", "Confidence")} {Math.round(testResult.confidence * 100)}%
                    </span>
                    {testResult.needsHuman ? (
                      <span className="rounded-full bg-warning-50 px-2 py-0.5 text-warning-700">
                        {t("Humain requis", "Human needed")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-success-50 px-2 py-0.5 text-success-700">
                        {t("Peut répondre seul", "Can reply on its own")}
                      </span>
                    )}
                    <span className="rounded-full border border-hair px-2 py-0.5 text-muted">
                      {testResult.sentiment}
                    </span>
                  </div>
                  {testResult.reason && (
                    <p className="text-2xs text-muted">{testResult.reason}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
