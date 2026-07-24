"use client";

// ── StudioCopilot — copilote créatif LLM des studios ─────────────────────────
// Un assistant qui comprend ce que vous voulez créer, rédige le prompt optimal,
// recommande le meilleur modèle, le format et la durée, et applique tout au
// studio en un clic. Conversationnel : on itère sans repartir de zéro.

import { useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";

export interface CopilotSuggestion {
  reply?: string;
  prompt?: string;
  modelId?: string;
  category?: "image" | "edit" | "upscale" | "video" | "music" | "voice";
  aspect?: string;
  seconds?: number;
  script?: string;
  tips?: string[];
}

type Msg = { role: "user" | "assistant"; content: string; sug?: CopilotSuggestion };

export function StudioCopilot({
  studio,
  currentPrompt,
  onApply,
  placeholder,
}: {
  studio: "affiche" | "avatar" | "video";
  currentPrompt?: string;
  /** Applique la suggestion au studio (prompt, modèle, format, durée, script). */
  onApply: (s: CopilotSuggestion) => void;
  placeholder?: string;
}) {
  const { company } = useCompany();
  const t = useT();
  const { lang } = useLang();
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(goal: string) {
    const g = goal.trim();
    if (!g || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: g }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/ai/studio-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, studio, goal: g, currentPrompt, history, language: lang }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || t("Le copilote a échoué.", "Copilot failed."));
      const sug = d as CopilotSuggestion;
      setMsgs((m) => [...m, { role: "assistant", content: sug.reply || t("Voici ma proposition.", "Here's my suggestion."), sug }]);
      // Auto-applique la 1re proposition pour aller vite (l'utilisateur peut réajuster).
      onApply(sug);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Erreur." }]);
    } finally {
      setBusy(false);
    }
  }

  const quick = studio === "video"
    ? [t("Une pub produit dynamique 9:16", "A dynamic product ad 9:16"), t("Une musique entraînante 20s", "An upbeat 20s music")]
    : studio === "avatar"
    ? [t("Porte-parole pro qui présente l'offre", "A pro spokesperson presenting the offer"), t("Écris-moi un script de 20s", "Write me a 20s script")]
    : [t("Une affiche promo élégante A4", "An elegant A4 promo poster"), t("Un visuel Instagram lumineux", "A bright Instagram visual")];

  return (
    <div className="studio-card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm text-white shadow">✦</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t("Copilote créatif IA", "AI creative copilot")}</p>
          <p className="text-2xs text-muted">{t("Décrivez votre idée — je prépare tout (prompt, modèle, format).", "Describe your idea — I set up everything (prompt, model, format).")}</p>
        </div>
        <span className="text-muted">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="border-t border-hair p-3">
          {msgs.length > 0 && (
            <div ref={scrollRef} className="mb-2 max-h-56 space-y-2 overflow-y-auto">
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-page text-white" : "bg-white/[0.05] text-ink ring-1 ring-hair"}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.sug && (m.sug.prompt || m.sug.script) && (
                      <div className="mt-2 space-y-1.5 border-t border-hair/60 pt-2 text-2xs">
                        {m.sug.modelId && <p className="text-muted">{t("Modèle", "Model")} : <span className="text-ink">{m.sug.modelId}</span>{m.sug.aspect ? ` · ${m.sug.aspect}` : ""}{m.sug.seconds ? ` · ${m.sug.seconds}s` : ""}</p>}
                        {m.sug.prompt && <p className="text-muted line-clamp-3">{m.sug.prompt}</p>}
                        {(m.sug.tips ?? []).length > 0 && <ul className="list-disc pl-4 text-muted">{m.sug.tips!.slice(0, 3).map((tp, k) => <li key={k}>{tp}</li>)}</ul>}
                        <button type="button" onClick={() => onApply(m.sug!)} className="btn-secondary mt-1 text-2xs">{t("↻ Réappliquer au studio", "↻ Re-apply to studio")}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* Attente avec animation (bug 4 lot 17) : spinner visible, pas un simple texte */}
              {busy && <div className="flex justify-start"><span className="inline-flex items-center gap-1.5 rounded-2xl bg-white/[0.05] px-3 py-2 text-2xs text-muted ring-1 ring-hair"><Spinner size={12} className="text-primary-600" /> {t("Le copilote prépare votre création…", "The copilot is setting up your creation…")}</span></div>}
            </div>
          )}

          {msgs.length === 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <button key={q} type="button" disabled={busy} onClick={() => send(q)} className="rounded-full border border-hair bg-card px-2.5 py-1 text-2xs text-ink transition-colors hover:border-page hover:text-page disabled:opacity-50">{q}</button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder={placeholder ?? t("Ex : « une affiche promo Black Friday, ton premium, fond sombre »", "E.g. “a Black Friday promo poster, premium tone, dark background”")}
              className="max-h-28 min-h-[2.4rem] flex-1 resize-none rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
            />
            <button type="button" onClick={() => send(input)} disabled={busy || !input.trim()} className="btn-primary h-[2.4rem] shrink-0 text-xs disabled:opacity-50">{t("Proposer", "Suggest")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
