"use client";

// ── ComposeAgent — l'agent IA au cœur de Compose ─────────────────────────────
// On lui dit ce qu'on veut publier ; il écrit le texte ADAPTÉ à chaque réseau
// (Facebook / Instagram / TikTok), propose et GÉNÈRE le visuel idéal (photo ou
// vidéo), conseille — et s'appuie sur la mémoire de marque (RAG) si activée.
// Conversationnel : « plus court », « plus fun », « change le visuel »…

import { useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { PublishLanguageSelect } from "@/components/ui/PublishLanguageSelect";
import { generateVideoPolling } from "@/lib/ai/generate-video-client";

export type ComposeNet = "facebook" | "instagram" | "tiktok";

export interface AgentOutput {
  reply?: string;
  texts?: Partial<Record<ComposeNet, string>>;
  visualPrompt?: string;
  visualKind?: "image" | "video";
  visualAdvice?: string;
  tips?: string[];
}

type Msg = { role: "user" | "assistant"; content: string; out?: AgentOutput };

export function ComposeAgent({
  networks,
  useMemory,
  hasMedia,
  currentTexts,
  onTexts,
  onMedia,
}: {
  networks: ComposeNet[];
  useMemory: boolean;
  hasMedia: boolean;
  currentTexts: Partial<Record<ComposeNet, string>>;
  /** Textes par réseau produits par l'agent → appliqués au post. */
  onTexts: (texts: Partial<Record<ComposeNet, string>>) => void;
  /** Visuel généré par l'agent → attaché au post. */
  onMedia: (m: { url: string; kind: "image" | "video" }) => void;
}) {
  const { company } = useCompany();
  const t = useT();
  const { lang } = useLang();
  // Langue de PUBLICATION (≠ langue de l'interface) ; défaut = langue de l'app.
  const [pubLang, setPubLang] = useState<string>(lang);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    const history = msgs.map((x) => ({ role: x.role, content: x.content }));
    setMsgs((p) => [...p, { role: "user", content: m }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/ai/compose-agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, message: m, networks, useMemory, language: pubLang, history, currentTexts, hasMedia }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || t("L'agent a échoué.", "The agent failed."));
      const out = d as AgentOutput;
      if (out.texts && Object.keys(out.texts).length) onTexts(out.texts);
      setMsgs((p) => [...p, { role: "assistant", content: out.reply || t("C'est prêt — textes appliqués.", "Done — texts applied."), out }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
    } catch (e) {
      setMsgs((p) => [...p, { role: "assistant", content: e instanceof Error ? e.message : "Erreur." }]);
    } finally { setBusy(false); }
  }

  /** Génère le visuel proposé par l'agent (image ou vidéo) et l'attache au post. */
  async function generateVisual(out: AgentOutput) {
    if (!out.visualPrompt || genBusy) return;
    setGenBusy(out.visualPrompt);
    try {
      if (out.visualKind === "video") {
        const r = await generateVideoPolling({ prompt: out.visualPrompt, aspect: "9:16", companyId: company.id });
        if (r.url) { onMedia({ url: r.url, kind: "video" }); return; }
        setMsgs((p) => [...p, { role: "assistant", content: t("La vidéo n'a pas pu être générée — réessayez ou passez en image.", "Video couldn't be generated — retry or switch to image.") }]);
        return;
      }
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, prompt: out.visualPrompt, format: networks.includes("tiktok") ? "9:16" : "1:1", n: 1 }),
      });
      const d = await r.json();
      const url = Array.isArray(d.images) ? (typeof d.images[0] === "string" ? d.images[0] : d.images[0]?.url) : null;
      if (url) onMedia({ url, kind: "image" });
      else setMsgs((p) => [...p, { role: "assistant", content: (d.error as string) || t("Visuel indisponible (IA images non configurée ?).", "Visual unavailable (image AI not configured?).") }]);
    } finally { setGenBusy(null); }
  }

  const quick = [
    t("Annonce d'une nouveauté", "Announce something new"),
    t("Post inspirant sur notre mission", "Inspiring post about our mission"),
    t("Promo du week-end", "Weekend promo"),
  ];

  return (
    <div className="studio-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-hair px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-base text-white shadow">✦</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t("Votre agent de publication", "Your publishing agent")}</p>
          <p className="text-2xs text-muted">{t("Dites-lui quoi publier — il écrit pour chaque réseau et prépare le visuel.", "Tell it what to post — it writes per network and prepares the visual.")}</p>
        </div>
      </div>

      <div className="p-3">
        {msgs.length > 0 && (
          <div ref={scrollRef} className="mb-2 max-h-64 space-y-2 overflow-y-auto">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-page text-white" : "bg-white/[0.05] text-ink ring-1 ring-hair"}`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {m.out?.visualPrompt && (
                    <div className="mt-2 space-y-1.5 border-t border-hair/60 pt-2 text-2xs">
                      {m.out.visualAdvice && <p className="text-muted">🖼 {m.out.visualAdvice}</p>}
                      <button type="button" disabled={genBusy !== null}
                        onClick={() => generateVisual(m.out!)}
                        className="btn-primary text-2xs disabled:opacity-50">
                        {genBusy === m.out.visualPrompt
                          ? (m.out.visualKind === "video" ? t("Vidéo en cours… (1-3 min)", "Video in progress… (1-3 min)") : t("Génération…", "Generating…"))
                          : (m.out.visualKind === "video" ? t("🎬 Générer la vidéo proposée", "🎬 Generate suggested video") : t("✨ Générer le visuel proposé", "✨ Generate suggested visual"))}
                      </button>
                      {(m.out.tips ?? []).length > 0 && <ul className="list-disc pl-4 text-muted">{m.out.tips!.slice(0, 2).map((tp, k) => <li key={k}>{tp}</li>)}</ul>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><span className="inline-flex items-center gap-1.5 rounded-2xl bg-white/[0.05] px-3 py-2 text-2xs text-muted ring-1 ring-hair">✦ {t("L'agent rédige vos publications…", "The agent is writing your posts…")}</span></div>}
          </div>
        )}

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

        <div className="mb-2 flex items-center justify-end">
          <PublishLanguageSelect value={pubLang} onChange={setPubLang} />
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={2}
            placeholder={t("Ex : « annonce notre nouvelle offre détox, ton premium, avec un visuel lumineux »", "E.g. “announce our new detox offer, premium tone, with a bright visual”")}
            className="max-h-32 min-h-[3.2rem] flex-1 resize-none rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
          />
          <button type="button" onClick={() => send(input)} disabled={busy || !input.trim()} className="btn-primary h-[3.2rem] shrink-0 px-4 text-sm disabled:opacity-50">
            {t("Créer", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}
