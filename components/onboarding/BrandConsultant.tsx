"use client";

// ── Consultant IA — découverte & verrouillage de l'ADN de marque ─────────────
// Un vrai entretien de marque : on DISCUTE (comme avec Claude) pour construire la
// philosophie — mission, cible, positionnement, message clé, valeurs, ton,
// direction artistique — puis on TESTE l'identité en visuels (images, vidéo en
// option) et on la VERROUILLE. Cet ADN devient le socle de toute la suite.
//
// Réutilisable : page dédiée /identite ET étape 0 du démarrage guidé.

import { useCallback, useEffect, useRef, useState } from "react";
import { useT, useLang } from "@/lib/i18n";
import { generateVideoPolling } from "@/lib/ai/generate-video-client";
import type { BrandProfile } from "@/lib/onboarding/types";

interface ChatMsg { role: "user" | "assistant"; content: string }

interface NetStrategy {
  network: "instagram" | "facebook" | "tiktok" | "linkedin";
  angle?: string;
  formats?: string[];
  tone?: string;
  contentPillars?: string[];
  cadence?: string;
  cta?: string;
}

interface BrandDna {
  summary?: string;
  positioning?: string;
  mission?: string;
  values?: string[];
  keyMessage?: string;
  personality?: string[];
  tone?: string;
  audience?: string;
  themes?: string[];
  visualDirection?: string;
  keywords?: string[];
  networkStrategies?: NetStrategy[];
}

const NET_META: Record<NetStrategy["network"], { label: string; icon: string; color: string }> = {
  instagram: { label: "Instagram", icon: "📸", color: "#e1306c" },
  facebook: { label: "Facebook", icon: "👍", color: "#1877f2" },
  tiktok: { label: "TikTok", icon: "🎵", color: "#ec4899" },
  linkedin: { label: "LinkedIn", icon: "💼", color: "#0a66c2" },
};

interface VisualTest {
  prompt: string;
  url: string;
  fav: boolean;
  videoUrl?: string;
  videoLoading?: boolean;
}

/** Extrait les URLs d'images d'une réponse generate-image (string[] ou {url}[]). */
function extractImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((it) => {
      if (typeof it === "string") return it;
      if (it && typeof it === "object" && typeof (it as { url?: unknown }).url === "string") {
        return (it as { url: string }).url;
      }
      return "";
    })
    .filter(Boolean);
}

export function BrandConsultant({
  companyId,
  companyName,
  onLocked,
  onContinue,
  continueLabel,
}: {
  companyId: string;
  companyName: string;
  /** Appelé après verrouillage réussi avec le profil persisté. */
  onLocked?: (profile: BrandProfile) => void;
  /** CTA secondaire après verrouillage (ex. « Continuer vers le démarrage »). */
  onContinue?: () => void;
  continueLabel?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const storageKey = `axon_brand_chat_${companyId}`;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dna, setDna] = useState<BrandDna>({});
  const [readyToLock, setReadyToLock] = useState(false);
  const [visualPrompts, setVisualPrompts] = useState<string[]>([]);

  const [visuals, setVisuals] = useState<VisualTest[]>([]);
  const [genVisuals, setGenVisuals] = useState(false);

  const [locking, setLocking] = useState(false);
  const [locked, setLocked] = useState(false);
  const [resetting, setResetting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const kicked = useRef(false);
  const restored = useRef(false);

  // Accueil instantané (statique) : aucune attente IA à l'ouverture de la page.
  const greeting = useCallback(
    (): string =>
      lang === "en"
        ? `Hi 👋 I'm your brand consultant. To build the DNA of ${companyName}, let's start with the essentials: what made you want to create this brand, and what makes it unique?`
        : `Bonjour 👋 je suis votre consultant de marque. Pour bâtir l'ADN de ${companyName}, commençons par l'essentiel : qu'est-ce qui vous a donné envie de créer cette marque, et qu'est-ce qui la rend unique ?`,
    [lang, companyName]
  );

  // Auto-scroll du fil de conversation.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // ── Restauration de la conversation (persistée localement) ─────────────────
  // Persistée par companyId : un rechargement restaure le bon fil (#12/#17), et
  // changer d'entreprise réinitialise puis recharge le fil de l'entreprise
  // ACTUELLEMENT sélectionnée (évite d'afficher un thread périmé).
  useEffect(() => {
    // À chaque changement de companyId (storageKey), on repart d'un état propre
    // puis on restaure le fil propre à cette entreprise.
    restored.current = true;
    kicked.current = false;
    setMessages([]);
    setDna({});
    setReadyToLock(false);
    setVisualPrompts([]);
    setVisuals([]);
    setLocked(false);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          messages?: ChatMsg[];
          dna?: BrandDna;
          visualPrompts?: string[];
          readyToLock?: boolean;
        };
        if (Array.isArray(saved.messages) && saved.messages.length) {
          setMessages(saved.messages);
          if (saved.dna) setDna(saved.dna);
          if (Array.isArray(saved.visualPrompts)) setVisualPrompts(saved.visualPrompts);
          if (typeof saved.readyToLock === "boolean") setReadyToLock(saved.readyToLock);
          kicked.current = true; // historique présent : pas de message d'accueil
        }
      }
    } catch { /* stockage indisponible : on repart à vide */ }
  }, [storageKey]);

  // #5 — Hydratation depuis le serveur : si aucun fil local n'existe (cache vidé
  // ou autre appareil), on recharge l'ADN enregistré/verrouillé pour qu'il ne
  // disparaisse pas au rechargement. Le fil local, s'il existe, reste prioritaire.
  useEffect(() => {
    let alive = true;
    try { if (localStorage.getItem(storageKey)) return; } catch { /* continue */ }
    fetch(`/api/onboarding/state?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.profile) return;
        const p = d.profile as BrandProfile;
        const hasDna = Boolean(p.summary || p.positioning || p.mission || (p.values?.length));
        if (!hasDna) return;
        setDna({
          summary: p.summary || undefined,
          positioning: p.positioning || undefined,
          mission: p.mission || undefined,
          values: p.values?.length ? p.values : undefined,
          keyMessage: p.keyMessage || undefined,
          personality: p.personality?.length ? p.personality : undefined,
          tone: p.tone || undefined,
          audience: p.audience || undefined,
          themes: p.themes?.length ? p.themes : undefined,
          visualDirection: p.visualDirection || undefined,
          keywords: p.keywords?.length ? p.keywords : undefined,
          networkStrategies: (p.networkStrategies as unknown as NetStrategy[]) ?? undefined,
        });
        setReadyToLock(true);
        if (p.philosophyLocked) setLocked(true);
        kicked.current = true; // pas de message d'accueil : on a déjà un ADN
        setMessages([{ role: "assistant", content: p.philosophyLocked
          ? t("Votre identité de marque verrouillée est chargée ci-dessous. Vous pouvez l'affiner ou la reverrouiller.", "Your locked brand identity is loaded below. You can refine or re-lock it.")
          : t("Votre identité de marque enregistrée est chargée ci-dessous. Reprenez l'entretien pour la compléter.", "Your saved brand identity is loaded below. Resume the interview to complete it.") }]);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [companyId, storageKey, t]);

  // Persistance locale de la conversation (ne jamais écraser avec du vide).
  useEffect(() => {
    if (!restored.current || messages.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ messages, dna, visualPrompts, readyToLock }));
    } catch { /* ignore */ }
  }, [messages, dna, visualPrompts, readyToLock, storageKey]);

  // ── Appel d'un tour de conversation ────────────────────────────────────────
  const turn = useCallback(
    async (history: ChatMsg[]) => {
      setSending(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/consultant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, messages: history, language: lang }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
        const reply: string = data.reply || "…";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        if (data.dna) {
          // Fusion non destructive : une valeur vide ne doit pas écraser un acquis.
          setDna((prev) => {
            const next: BrandDna = { ...prev };
            const d = data.dna as Record<string, unknown>;
            for (const [k, v] of Object.entries(d)) {
              const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
              if (!empty) (next as Record<string, unknown>)[k] = v;
            }
            return next;
          });
        }
        setReadyToLock(Boolean(data.readyToLock));
        if (Array.isArray(data.visualPrompts) && data.visualPrompts.length) {
          setVisualPrompts(data.visualPrompts);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Le consultant n'a pas répondu.");
      } finally {
        setSending(false);
      }
    },
    [companyId, lang]
  );

  const send = useCallback(() => {
    const content = input.trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    turn(next);
  }, [input, sending, messages, turn]);

  // ── Génération des tests visuels (moodboard) ───────────────────────────────
  const generateVisuals = useCallback(async () => {
    if (!visualPrompts.length || genVisuals) return;
    setGenVisuals(true);
    setError(null);
    try {
      const results = await Promise.all(
        visualPrompts.slice(0, 3).map(async (prompt) => {
          try {
            const res = await fetch("/api/ai/generate-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ companyId, prompt, format: "1:1" }),
            });
            const data = await res.json();
            const url = extractImageUrls(data.images)[0];
            return url ? { prompt, url, fav: false } : null;
          } catch {
            return null;
          }
        })
      );
      const ok = results.filter((r): r is VisualTest => Boolean(r));
      if (ok.length === 0) {
        setError(t("Génération visuelle indisponible (crédits/IA).", "Visual generation unavailable (credits/AI)."));
      }
      setVisuals((prev) => [...ok, ...prev]);
    } finally {
      setGenVisuals(false);
    }
  }, [visualPrompts, genVisuals, companyId, t]);

  const toggleFav = (url: string) =>
    setVisuals((prev) => prev.map((v) => (v.url === url ? { ...v, fav: !v.fav } : v)));

  // Test vidéo à la demande (sur une direction visuelle donnée).
  const testVideo = useCallback(async (target: VisualTest) => {
    setVisuals((prev) => prev.map((v) => (v.url === target.url ? { ...v, videoLoading: true } : v)));
    const r = await generateVideoPolling({ prompt: target.prompt, aspect: "9:16" });
    setVisuals((prev) =>
      prev.map((v) =>
        v.url === target.url ? { ...v, videoLoading: false, videoUrl: r.url } : v
      )
    );
    if (!r.url && !r.simulated) {
      setError(t("Test vidéo indisponible pour le moment.", "Video test unavailable right now."));
    }
  }, [t]);

  // ── Verrouillage de l'identité ─────────────────────────────────────────────
  const lock = useCallback(async () => {
    if (locking) return;
    setLocking(true);
    setError(null);
    try {
      const favPrompts = visuals.filter((v) => v.fav).map((v) => v.prompt);
      const dnaToLock: BrandDna = {
        ...dna,
        visualDirection: [dna.visualDirection, ...favPrompts].filter(Boolean).join(" · "),
      };
      const res = await fetch("/api/ai/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, lock: true, dna: dnaToLock }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
      setLocked(true);
      if (data.profile) onLocked?.(data.profile as BrandProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verrouillage impossible.");
    } finally {
      setLocking(false);
    }
  }, [locking, visuals, dna, companyId, onLocked]);

  // ── Remise à zéro : on repart d'une page blanche (rien n'est figé) ─────────
  const reset = useCallback(async () => {
    if (resetting) return;
    if (typeof window !== "undefined" && !window.confirm(
      t("Recommencer l'identité de marque à zéro ? L'ADN actuel sera effacé.",
        "Restart the brand identity from scratch? The current DNA will be erased.")
    )) return;
    setResetting(true);
    setError(null);
    try {
      await fetch("/api/ai/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, reset: true }),
      });
    } catch { /* non bloquant */ }
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setMessages([]);
    setDna({});
    setReadyToLock(false);
    setVisualPrompts([]);
    setVisuals([]);
    setLocked(false);
    setResetting(false);
    kicked.current = false; // relance l'accueil
  }, [resetting, companyId, t, storageKey]);

  // Message d'accueil instantané (au 1er rendu et après remise à zéro).
  // On n'appelle plus l'IA à l'ouverture : la page ne « charge » plus 90 s (#20).
  useEffect(() => {
    if (!restored.current) return;
    if (!kicked.current && messages.length === 0 && !locked) {
      kicked.current = true;
      setMessages([{ role: "assistant", content: greeting() }]);
    }
  }, [messages.length, locked, greeting]);

  const hasDna =
    Boolean(dna.positioning || dna.mission || dna.keyMessage || dna.audience || dna.tone);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      {/* ── Colonne conversation ─────────────────────────────────────────── */}
      <div className="card flex h-[80vh] min-h-[560px] flex-col overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-hair px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-page/20 text-sm">🧠</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {t("Consultant de marque IA", "AI Brand Consultant")}
            </p>
            <p className="truncate text-2xs text-muted">
              {t("Construisons l'ADN de", "Let's build the DNA of")} {companyName}
            </p>
          </div>
          {(messages.length > 0 || hasDna) && (
            <button
              onClick={reset}
              disabled={resetting}
              className="btn-ghost shrink-0 text-2xs text-muted"
              title={t("Tout recommencer", "Start over")}
            >
              {resetting ? t("…", "…") : t("↺ Recommencer", "↺ Restart")}
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={[
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-page text-white rounded-br-md selection:bg-white selection:text-page"
                    : "bg-white/[0.05] text-ink rounded-bl-md ring-1 ring-hair",
                ].join(" ")}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-white/[0.05] px-3.5 py-2.5 text-sm text-muted ring-1 ring-hair">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-page [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-page [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-page" />
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-hair p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={4}
              placeholder={t("Répondez au consultant…", "Reply to the consultant…")}
              className="input max-h-48 min-h-[6rem] flex-1 resize-none"
            />
            <button onClick={send} disabled={sending || !input.trim()} className="btn-primary h-[2.5rem]">
              {t("Envoyer", "Send")}
            </button>
          </div>
          {error && <p className="mt-2 text-2xs text-danger-600">{error}</p>}
        </div>
      </div>

      {/* ── Colonne ADN + tests visuels ──────────────────────────────────── */}
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <p className="section-label">{t("ADN de marque", "Brand DNA")}</p>
            {readyToLock && !locked && (
              <span className="chip text-success-600">{t("Prêt à verrouiller", "Ready to lock")}</span>
            )}
            {locked && <span className="chip text-success-600">✓ {t("Verrouillé", "Locked")}</span>}
          </div>

          {!hasDna ? (
            <p className="mt-3 text-sm text-muted">
              {t(
                "L'ADN se construit au fil de la conversation : mission, cible, message clé, ton, univers visuel…",
                "The DNA builds up through the conversation: mission, audience, key message, tone, visual world…"
              )}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <DnaField label={t("Positionnement", "Positioning")} value={dna.positioning} />
              <DnaField label={t("Mission", "Mission")} value={dna.mission} />
              <DnaField label={t("Message clé", "Key message")} value={dna.keyMessage} highlight />
              <DnaField label={t("Cible", "Audience")} value={dna.audience} />
              <DnaField label={t("Ton de voix", "Tone of voice")} value={dna.tone} />
              <DnaChips label={t("Valeurs", "Values")} values={dna.values} />
              <DnaChips label={t("Personnalité", "Personality")} values={dna.personality} />
              <DnaField label={t("Direction artistique", "Art direction")} value={dna.visualDirection} />
            </div>
          )}
        </div>

        {/* Stratégie par réseau — chaque plateforme a ses codes */}
        {dna.networkStrategies && dna.networkStrategies.length > 0 && (
          <div className="card p-4">
            <p className="section-label">{t("Stratégie par réseau", "Per-network strategy")}</p>
            <div className="mt-3 space-y-2.5">
              {dna.networkStrategies.map((s) => {
                const meta = NET_META[s.network];
                if (!meta) return null;
                return (
                  <div key={s.network} className="rounded-lg border border-hair bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2">
                      <span>{meta.icon}</span>
                      <span className="text-sm font-semibold text-ink" style={{ color: meta.color }}>{meta.label}</span>
                      {s.cadence && <span className="ml-auto text-2xs text-muted">{s.cadence}</span>}
                    </div>
                    {s.angle && <p className="mt-1 text-2xs leading-snug text-ink">{s.angle}</p>}
                    {(s.formats?.length || s.contentPillars?.length) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(s.formats ?? []).map((f, i) => (
                          <span key={`f${i}`} className="chip text-[10px]">{f}</span>
                        ))}
                        {(s.contentPillars ?? []).map((p, i) => (
                          <span key={`p${i}`} className="chip text-[10px] text-ai-text">{p}</span>
                        ))}
                      </div>
                    )}
                    {(s.tone || s.cta) && (
                      <p className="mt-1.5 text-[10px] text-muted">
                        {s.tone && <>{t("Ton", "Tone")} : {s.tone}</>}
                        {s.tone && s.cta && " · "}
                        {s.cta && <>CTA : {s.cta}</>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tests visuels */}
        {(visualPrompts.length > 0 || visuals.length > 0) && (
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <p className="section-label">{t("Tests visuels", "Visual tests")}</p>
              {visualPrompts.length > 0 && (
                <button onClick={generateVisuals} disabled={genVisuals} className="btn-secondary text-2xs">
                  {genVisuals
                    ? t("Génération…", "Generating…")
                    : visuals.length
                    ? t("Régénérer", "Regenerate")
                    : t("Générer le moodboard", "Generate moodboard")}
                </button>
              )}
            </div>

            {visuals.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                {t(
                  "Testez la direction artistique en images — gardez vos préférées pour affiner l'identité.",
                  "Test the art direction in images — keep your favorites to refine the identity."
                )}
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {visuals.map((v) => (
                  <div key={v.url} className="group relative overflow-hidden rounded-lg ring-1 ring-hair">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.url} alt="" className="aspect-square w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                      <button
                        onClick={() => toggleFav(v.url)}
                        className={`text-sm ${v.fav ? "text-warning-500" : "text-white/70 hover:text-white"}`}
                        aria-label={t("Favori", "Favorite")}
                      >
                        {v.fav ? "★" : "☆"}
                      </button>
                      <button
                        onClick={() => testVideo(v)}
                        disabled={v.videoLoading}
                        className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur hover:bg-white/25"
                      >
                        {v.videoLoading ? t("Vidéo…", "Video…") : v.videoUrl ? "✓ vidéo" : t("Tester vidéo", "Test video")}
                      </button>
                    </div>
                    {v.videoUrl && (
                      <video
                        src={v.videoUrl}
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity group-hover:opacity-100"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Verrouillage */}
        <div className="card p-4">
          {!locked ? (
            <>
              <button onClick={lock} disabled={locking || !hasDna} className="btn-primary w-full">
                {locking ? t("Verrouillage…", "Locking…") : t("Verrouiller l'identité de marque", "Lock the brand identity")}
              </button>
              <p className="mt-2 text-center text-2xs text-muted">
                {readyToLock
                  ? t("Le consultant pense que l'ADN est prêt.", "The consultant thinks the DNA is ready.")
                  : t("Continuez la discussion pour enrichir l'ADN.", "Keep chatting to enrich the DNA.")}
              </p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm font-semibold text-ink">
                ✓ {t("Identité de marque verrouillée", "Brand identity locked")}
              </p>
              <p className="mt-1 text-2xs text-muted">
                {t("Elle servira de socle à tous vos contenus et campagnes.", "It will anchor all your content and campaigns.")}
              </p>
              {onContinue && (
                <button onClick={onContinue} className="btn-primary mt-3 w-full">
                  {continueLabel || t("Continuer", "Continue")}
                </button>
              )}
              <button onClick={reset} disabled={resetting} className="btn-ghost mt-2 w-full text-2xs text-muted">
                {t("↺ Refaire l'identité à zéro", "↺ Redo the identity from scratch")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DnaField({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="section-label mb-0.5">{label}</p>
      <p className={`text-sm leading-snug ${highlight ? "font-semibold text-ai-text" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function DnaChips({ label, values }: { label: string; values?: string[] }) {
  if (!values || values.length === 0) return null;
  return (
    <div>
      <p className="section-label mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={i} className="chip">{v}</span>
        ))}
      </div>
    </div>
  );
}
