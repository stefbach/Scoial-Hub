"use client";

// Panneau « Assistant IA » de la création de pub Meta — conversation qui construit
// la campagne. Extrait de app/(paid)/campaigns/new pour alléger la page (audit).

import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

export interface AdChatMsg { role: "user" | "assistant"; content: string }

export function AdAssistantPanel({
  active,
  messages,
  assisting,
  planReady,
  publishing,
  genImg,
  canEdit,
  connected,
  input,
  onInputChange,
  onSend,
  onPublish,
  onSwitchToManual,
}: {
  active: boolean;
  messages: AdChatMsg[];
  assisting: boolean;
  planReady: boolean;
  publishing: boolean;
  genImg: boolean;
  canEdit: boolean;
  connected: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onPublish: () => void;
  onSwitchToManual: () => void;
}) {
  const t = useT();
  return (
    <section className={`card border-l-4 border-ai-text p-5 ${active ? "" : "hidden"}`}>
      <span className="section-label text-ai-text">{t("Assistant IA — discutez, l'IA construit la campagne", "AI assistant — chat, AI builds the campaign")}</span>
      <p className="mt-0.5 text-2xs text-muted">
        {t(
          "Dites ce que vous voulez ; l'IA pose une question si besoin, puis remplit tout (objectif, budget, ciblage, texte, visuel, formulaire) selon les règles Meta.",
          "Tell it what you want; the AI asks a question if needed, then fills everything (objective, budget, targeting, copy, visual, form) per Meta rules."
        )}
      </p>

      {/* Fil de conversation */}
      {messages.length > 0 && (
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-hair bg-canvas p-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <span className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-page text-white" : "bg-card text-ink ring-1 ring-hair"}`}>
                {m.content}
              </span>
            </div>
          ))}
          {assisting && (
            <div className="flex justify-start"><span className="inline-flex items-center gap-1.5 rounded-2xl bg-card px-3 py-2 text-sm text-muted ring-1 ring-hair"><Spinner size={12} className="text-ai-text" /> {t("L'IA réfléchit…", "AI is thinking…")}</span></div>
          )}
        </div>
      )}

      {planReady && (
        <div className="mt-2 rounded-lg bg-success-50 px-3 py-2.5 text-xs text-success-700">
          {t("✓ Campagne pré-remplie ci-dessous. Vérifiez, ou créez-la directement (en PAUSE).", "✓ Campaign pre-filled below. Review, or create it directly (PAUSED).")}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPublish}
              disabled={publishing || genImg || !canEdit}
              title={!canEdit ? t("Lecture seule", "View only") : undefined}
              className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {publishing && <Spinner size={14} className="text-white" />}
              {publishing ? t("Création sur Meta…", "Creating on Meta…") : t("Créer directement (EN PAUSE)", "Create directly (PAUSED)")}
            </button>
            <button type="button" onClick={onSwitchToManual} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              {t("Ajuster les réglages →", "Adjust settings →")}
            </button>
            {genImg && <span className="inline-flex items-center gap-1.5 text-2xs text-muted"><Spinner size={12} className="text-ai-text" /> {t("Visuel en cours de génération…", "Visual being generated…")}</span>}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          rows={2}
          placeholder={messages.length === 0
            ? t("Ex : « Des prospects pour la chirurgie de l'obésité, cible UK, 25 €/jour »", "E.g. \"Leads for obesity surgery, UK audience, €25/day\"")
            : t("Votre réponse…", "Your reply…")}
          className="flex-1 rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
        />
        <button type="button" onClick={onSend} disabled={assisting || !connected || !input.trim() || !canEdit} className="btn-primary inline-flex shrink-0 items-center gap-1.5 text-sm disabled:opacity-50">
          {assisting && <Spinner size={14} className="text-white" />}
          {t("Envoyer", "Send")}
        </button>
      </div>
      {!connected && <p className="mt-1 text-2xs text-muted">{t("Connectez Meta pour activer l'assistant.", "Connect Meta to enable the assistant.")}</p>}
    </section>
  );
}
