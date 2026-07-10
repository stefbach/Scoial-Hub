"use client";

// ── VisualPromptCoach — assistant conversationnel de prompt visuel ───────────
// Mini-chat de l'Article Studio LinkedIn : l'utilisateur décrit le visuel voulu
// en langage naturel (« une photo lumineuse d'une équipe médicale, style
// éditorial, sans texte ») ; l'assistant renvoie un PROMPT de génération
// d'image optimisé (anglais, photographique, précis) + 1-2 suggestions.
// « Utiliser ce prompt » remplit le prompt visuel actif de l'Article Studio.

import { useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";

type Msg = { role: "user" | "assistant"; content: string; prompt?: string };

export function VisualPromptCoach({
  articleContext,
  targetLabel,
  onUsePrompt,
}: {
  /** Contexte de l'article (titre, accroche…) pour la cohérence de marque. */
  articleContext?: string;
  /** Libellé du prompt visuel ciblé (ex. « Visuel 2 », « Nouveau visuel »). */
  targetLabel: string;
  /** Applique le prompt proposé au prompt visuel actif de l'Article Studio. */
  onUsePrompt: (prompt: string) => void;
}) {
  const { company } = useCompany();
  const t = useT();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [usedPrompt, setUsedPrompt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    // Historique pour le LLM : le prompt proposé fait partie du contexte, pour
    // que « plus lumineux » raffine bien la DERNIÈRE proposition.
    const history = msgs.map((x) => ({
      role: x.role,
      content: x.prompt ? `${x.content}\n\nPROMPT: ${x.prompt}` : x.content,
    }));
    setMsgs((p) => [...p, { role: "user", content: m }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/ai/visual-prompt-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, messages: [...history, { role: "user", content: m }], articleContext }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error((d?.error as string) || t("L'assistant a échoué.", "The assistant failed."));
      setMsgs((p) => [
        ...p,
        {
          role: "assistant",
          content: (d.reply as string) || t("Voici un prompt proposé.", "Here is a suggested prompt."),
          prompt: (d.prompt as string) || undefined,
        },
      ]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
    } catch (e) {
      setMsgs((p) => [...p, { role: "assistant", content: e instanceof Error ? e.message : t("Erreur.", "Error.") }]);
    } finally {
      setBusy(false);
    }
  }

  const quick = [
    t("Photo lumineuse d'une équipe au travail, style éditorial", "Bright photo of a team at work, editorial style"),
    t("Illustration épurée et moderne du sujet de l'article", "Clean, modern illustration of the article topic"),
    t("Portrait professionnel en situation, lumière naturelle", "Professional candid portrait, natural light"),
  ];

  return (
    <div className="rounded-xl border border-hair bg-canvas/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="section-label flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-2xs text-white">✦</span>
          {t("Assistant visuel", "Visual assistant")}
        </p>
        <span className="rounded-full bg-card px-2 py-0.5 text-2xs text-muted ring-1 ring-hair">
          → {targetLabel}
        </span>
      </div>
      <p className="mb-2 text-2xs text-muted">
        {t(
          "Décrivez le visuel voulu en langage naturel ; l'assistant construit un prompt d'image optimisé (en anglais).",
          "Describe the visual you want in plain language; the assistant crafts an optimized image prompt (in English)."
        )}
      </p>

      {msgs.length === 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} type="button" disabled={busy} onClick={() => send(q)}
              className="rounded-full border border-hair bg-card px-2.5 py-1 text-2xs text-ink transition-colors hover:border-page hover:text-page disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
      )}

      {msgs.length > 0 && (
        <div ref={scrollRef} className="mb-2 max-h-56 space-y-1.5 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-3 py-1.5 text-2xs ${m.role === "user" ? "bg-page text-white" : "bg-card text-ink ring-1 ring-hair"}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.prompt && (
                  <div className="mt-1.5 space-y-1.5 border-t border-hair/60 pt-1.5">
                    <p className="whitespace-pre-wrap rounded-lg bg-canvas px-2 py-1.5 font-mono text-[10px] leading-relaxed text-muted">{m.prompt}</p>
                    <button type="button" onClick={() => { onUsePrompt(m.prompt!); setUsedPrompt(m.prompt!); }}
                      className="btn-primary text-2xs">
                      {t("Utiliser ce prompt", "Use this prompt")}
                    </button>
                    {usedPrompt === m.prompt && (
                      <p className="font-medium text-success-600">
                        ✓ {t("Prompt appliqué au visuel ciblé.", "Prompt applied to the targeted visual.")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-2xl bg-card px-3 py-1.5 text-2xs text-muted ring-1 ring-hair">
                <Spinner size={11} className="text-page" /> {t("L'assistant compose le prompt…", "The assistant is crafting the prompt…")}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={2}
          disabled={busy}
          placeholder={t(
            "Ex : « une photo lumineuse d'une équipe médicale, style éditorial, sans texte »",
            "E.g. “a bright photo of a medical team, editorial style, no text”"
          )}
          className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
        />
        <button type="button" onClick={() => send(input)} disabled={busy || !input.trim()} className="btn-primary h-[2.75rem] shrink-0 text-xs disabled:opacity-50">
          {t("Envoyer", "Send")}
        </button>
      </div>
    </div>
  );
}
