"use client";

/**
 * Avatar IA conversationnel intégré au Hub.
 *  - cerveau : /api/ai/avatar-chat (Claude + mémoire stratégique de la marque)
 *  - voix    : synthèse vocale du navigateur (TTS) + reconnaissance vocale (STT)
 *  - visuel  : avatar SVG animé (blink + lip-sync) — fiable, sans dépendance.
 *              Option « HD (Live2D) » chargée à la demande depuis le CDN, avec
 *              repli automatique sur le SVG en cas d'échec.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Avatar3D } from "./Avatar3D";
import { RpmCreator } from "./RpmCreator";

interface Msg { role: "user" | "assistant"; content: string }
type Face = "idle" | "thinking" | "speaking";

const VOICE_LANGS = [
  { label: "Français", code: "fr-FR" },
  { label: "English", code: "en-US" },
  { label: "Español", code: "es-ES" },
  { label: "Deutsch", code: "de-DE" },
  { label: "Italiano", code: "it-IT" },
];

// Avatar 3D par défaut (URL publique fiable) — prouve que la 3D fonctionne ;
// remplaçable par votre propre avatar Ready Player Me.
const DEFAULT_MODEL = "https://readyplayerme.github.io/visage/male.glb";

/** Ajoute les morphs ARKit/Visemes (lip-sync + clignement) à une URL RPM .glb. */
function withMorphs(url: string): string {
  if (url.includes("morphTargets")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}morphTargets=ARKit,Oculus%20Visemes`;
}

/** Construit une URL .glb Ready Player Me depuis une URL, un lien de partage ou un ID. */
function toGlbUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (s.includes("models.readyplayer.me") && s.includes(".glb")) return withMorphs(s);
  const id = s.match(/[a-f0-9]{24}/i); // id RPM (24 hex)
  if (id) return withMorphs(`https://models.readyplayer.me/${id[0]}.glb`);
  if (s.endsWith(".glb")) return withMorphs(s);
  return null;
}

/* ── Avatar SVG animé ──────────────────────────────────────────────────────── */
function AvatarFace({ face, mouth, blink }: { face: Face; mouth: number; blink: boolean }) {
  const eyeH = blink ? 0.12 : 1; // clignement
  const m = Math.max(0, Math.min(1, mouth));
  const mouthRy = face === "speaking" ? 3 + m * 9 : 3;
  const mouthRx = face === "speaking" ? 9 - m * 2 : 11;
  return (
    <svg viewBox="0 0 220 240" className="h-full w-full">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef2ff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
        <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="220" height="240" rx="18" fill="url(#bg)" />
      {/* épaules */}
      <path d="M40 240 Q40 188 110 188 Q180 188 180 240 Z" fill="#6366f1" />
      <path d="M95 178 h30 v22 h-30 z" fill="#f1c9a5" />
      {/* tête */}
      <g style={{ transformOrigin: "110px 120px", transform: face === "idle" ? "translateY(0)" : "translateY(-1px)" }}>
        <ellipse cx="110" cy="110" rx="62" ry="68" fill="#f6d2b3" />
        {/* cheveux */}
        <path d="M48 104 Q44 40 110 40 Q176 40 172 104 Q150 78 110 78 Q70 78 48 104 Z" fill="url(#hair)" />
        <path d="M48 104 Q60 92 70 104 L70 130 Q56 124 48 104 Z" fill="url(#hair)" />
        <path d="M172 104 Q160 92 150 104 L150 130 Q164 124 172 104 Z" fill="url(#hair)" />
        {/* sourcils */}
        <rect x="74" y="92" width="26" height="4" rx="2" fill="#7c3aed" transform={face === "thinking" ? "rotate(-8 87 94)" : undefined} />
        <rect x="120" y="92" width="26" height="4" rx="2" fill="#7c3aed" transform={face === "thinking" ? "rotate(8 133 94)" : undefined} />
        {/* yeux */}
        <g style={{ transform: `scaleY(${eyeH})`, transformOrigin: "110px 112px", transition: "transform 80ms" }}>
          <ellipse cx="87" cy="112" rx="9" ry="12" fill="#fff" />
          <ellipse cx="133" cy="112" rx="9" ry="12" fill="#fff" />
          <circle cx="88" cy="114" r="5" fill="#3b2f2f" />
          <circle cx="134" cy="114" r="5" fill="#3b2f2f" />
          <circle cx="90" cy="112" r="1.6" fill="#fff" />
          <circle cx="136" cy="112" r="1.6" fill="#fff" />
        </g>
        {/* joues */}
        <circle cx="74" cy="135" r="7" fill="#f7a9a0" opacity="0.5" />
        <circle cx="146" cy="135" r="7" fill="#f7a9a0" opacity="0.5" />
        {/* bouche */}
        <ellipse cx="110" cy="150" rx={mouthRx} ry={mouthRy} fill="#9b3b3b" />
        {face === "speaking" && m > 0.4 && <ellipse cx="110" cy={150 + mouthRy * 0.3} rx={mouthRx * 0.5} ry={mouthRy * 0.4} fill="#e98b8b" />}
      </g>
    </svg>
  );
}

export function AvatarChat({ companyId }: { companyId: string }) {
  const t = useT();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [face, setFace] = useState<Face>("idle");
  const [mouth, setMouth] = useState(0);
  const [blink, setBlink] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState(VOICE_LANGS[0]);
  const [note, setNote] = useState<string | null>(null);
  const [use3D, setUse3D] = useState(true);
  const [failed3D, setFailed3D] = useState(false);
  const [err3D, setErr3D] = useState<string | null>(null);
  const [loading3D, setLoading3D] = useState(true);
  const [model3DUrl, setModel3DUrl] = useState(DEFAULT_MODEL); // avatar 3D par défaut
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const mouthTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mouthRef = useRef(0); // 0..1 partagé avec l'avatar 3D
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioCtxRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restaure l'URL d'avatar 3D personnalisée.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("avatar3dUrl");
      if (saved && /^https?:\/\/.+\.glb/i.test(saved)) setModel3DUrl(saved);
    } catch { /* noop */ }
  }, []);

  // Applique un avatar Ready Player Me exporté.
  const applyAvatar = useCallback((glbUrl: string) => {
    const url = withMorphs(glbUrl);
    setModel3DUrl(url);
    setFailed3D(false);
    setErr3D(null);
    setLoading3D(true);
    setCreatorOpen(false);
    try { localStorage.setItem("avatar3dUrl", url); } catch { /* noop */ }
  }, []);

  const applyMouth = useCallback((v: number) => {
    mouthRef.current = v;
    setMouth(v);
  }, []);

  // Callbacks STABLES pour Avatar3D (sinon le rendu 3D se relance en boucle).
  const handle3DReady = useCallback(() => setLoading3D(false), []);
  const handle3DError = useCallback((m: string) => { setFailed3D(true); setErr3D(m); setLoading3D(false); }, []);

  // Clignement périodique.
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3500 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const stopMouth = useCallback(() => {
    if (mouthTimer.current) clearInterval(mouthTimer.current);
    mouthTimer.current = null;
    applyMouth(0);
  }, [applyMouth]);

  // Voix navigateur (repli) — bouche animée aléatoirement.
  const speakBrowser = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) { setFace("idle"); return; }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang.code;
        const voices = window.speechSynthesis.getVoices();
        // Préfère une voix féminine de la bonne langue.
        const sameLang = voices.filter((vo) => vo.lang.startsWith(lang.code.slice(0, 2)));
        const female = sameLang.find((vo) => /female|femme|aurelie|amelie|virginie|google/i.test(vo.name));
        u.voice = female || sameLang[0] || voices[0];
        u.onstart = () => {
          setFace("speaking");
          stopMouth();
          mouthTimer.current = setInterval(() => applyMouth(0.2 + Math.random() * 0.8), 110);
        };
        u.onend = () => { stopMouth(); setFace("idle"); };
        u.onerror = () => { stopMouth(); setFace("idle"); };
        window.speechSynthesis.speak(u);
      } catch { setFace("idle"); }
    },
    [lang, stopMouth, applyMouth]
  );

  // Joue un audio (MiniMax) avec lip-sync sur l'amplitude réelle.
  const playWithLipsync = useCallback(
    (src: string) =>
      new Promise<void>((resolve, reject) => {
        try {
          const audio = new Audio(src);
          audio.crossOrigin = "anonymous";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const AC = (window.AudioContext || (window as any).webkitAudioContext);
          const ctx = new AC();
          audioCtxRef.current = ctx;
          const srcNode = ctx.createMediaElementSource(audio);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          srcNode.connect(analyser);
          analyser.connect(ctx.destination);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          let raf = 0;
          const loop = () => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
            const rms = Math.sqrt(sum / buf.length);
            applyMouth(Math.min(1, rms * 3.2));
            raf = requestAnimationFrame(loop);
          };
          audio.onplay = () => { setFace("speaking"); loop(); };
          const finish = () => { cancelAnimationFrame(raf); applyMouth(0); setFace("idle"); try { ctx.close(); } catch { /* noop */ } };
          audio.onended = () => { finish(); resolve(); };
          audio.onerror = () => { finish(); reject(new Error("audio")); };
          void audio.play();
        } catch (e) {
          reject(e instanceof Error ? e : new Error("lipsync"));
        }
      }),
    [applyMouth]
  );

  const speak = useCallback(
    async (text: string) => {
      if (!voiceOn) { setFace("idle"); return; }
      setFace("speaking");
      // 1) Voix premium MiniMax (si configurée côté serveur).
      try {
        const res = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: lang.label }),
        });
        const data = (await res.json()) as { audioBase64?: string; mime?: string; fallback?: boolean };
        if (data.audioBase64) {
          await playWithLipsync(`data:${data.mime ?? "audio/mpeg"};base64,${data.audioBase64}`);
          return;
        }
      } catch { /* → repli navigateur */ }
      // 2) Repli : voix du navigateur.
      speakBrowser(text);
    },
    [voiceOn, lang, playWithLipsync, speakBrowser]
  );

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || loading) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", content: msg }]);
      setLoading(true);
      setFace("thinking");
      setNote(null);
      try {
        const history = messages.slice(-10);
        const res = await fetch("/api/ai/avatar-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, message: msg, history, language: lang.label }),
        });
        const data = (await res.json()) as { reply?: string; mock?: boolean };
        const reply = data.reply ?? t("Désolé, je n'ai pas pu répondre.", "Sorry, I couldn't answer.");
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        if (data.mock) setNote(t("Mode démo (ANTHROPIC_API_KEY non configurée).", "Demo mode (ANTHROPIC_API_KEY not set)."));
        speak(reply);
      } catch {
        setFace("idle");
        setNote(t("Erreur réseau.", "Network error."));
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, companyId, lang, t, speak]
  );

  // Reconnaissance vocale (micro).
  const toggleMic = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setNote(t("La reconnaissance vocale n'est pas supportée par ce navigateur.", "Speech recognition isn't supported by this browser."));
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = lang.code;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      void send(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, lang, send, t]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative aspect-[11/12] w-full max-w-xs overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-50 to-violet-100 shadow-sm ring-1 ring-hair">
          {use3D && model3DUrl && !failed3D ? (
            <Avatar3D modelUrl={model3DUrl} mouthRef={mouthRef} onReady={handle3DReady} onError={handle3DError} />
          ) : (
            <AvatarFace face={face} mouth={mouth} blink={blink} />
          )}
          {use3D && model3DUrl && !failed3D && loading3D && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/10 text-2xs text-ink">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
              {t("Chargement de l'avatar 3D…", "Loading 3D avatar…")}
            </div>
          )}
          {use3D && failed3D && err3D && (
            <div className="absolute inset-x-0 top-0 bg-danger-600/90 px-2 py-1 text-center text-[10px] text-white">
              3D: {err3D}
            </div>
          )}
          {use3D && (!model3DUrl || failed3D) && (
            <button
              type="button"
              onClick={() => setCreatorOpen(true)}
              className="absolute inset-x-3 bottom-3 rounded-lg bg-primary-600 px-3 py-2 text-2xs font-semibold text-white shadow hover:bg-primary-700"
            >
              {failed3D
                ? t("Avatar 3D indisponible — créer le mien", "3D avatar unavailable — create mine")
                : t("🧑‍🎨 Créer mon avatar 3D réaliste", "🧑‍🎨 Create my realistic 3D avatar")}
            </button>
          )}
        </div>

        <div className="flex w-full max-w-xs items-center justify-between gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
            🔊 {t("Voix", "Voice")}
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={use3D} onChange={(e) => { setUse3D(e.target.checked); setFailed3D(false); }} />
            🧑 3D
          </label>
          <select
            value={lang.code}
            onChange={(e) => setLang(VOICE_LANGS.find((l) => l.code === e.target.value) ?? VOICE_LANGS[0])}
            className="input text-2xs"
          >
            {VOICE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <p className="max-w-xs text-center text-2xs text-muted">
          {face === "thinking" ? t("réfléchit…", "thinking…") : face === "speaking" ? t("parle…", "speaking…") : t("prêt", "ready")}
        </p>
        {use3D && failed3D && (
          <p className="max-w-xs break-words text-center text-[10px] text-danger-600">
            {t("3D indisponible → avatar 2D.", "3D unavailable → 2D avatar.")} {err3D ? `(${err3D})` : ""}
          </p>
        )}

        {use3D && model3DUrl && !failed3D && (
          <button type="button" onClick={() => setCreatorOpen(true)} className="btn-secondary text-2xs px-2 py-1">
            {t("🧑‍🎨 Changer d'avatar", "🧑‍🎨 Change avatar")}
          </button>
        )}

        {use3D && (
          <details className="w-full max-w-xs text-2xs text-muted">
            <summary className="cursor-pointer">{t("Le créateur ne s'affiche pas ?", "Creator not showing?")}</summary>
            <div className="mt-2 space-y-1">
              <a href="https://readyplayer.me/avatar" target="_blank" rel="noopener noreferrer" className="block text-primary-600 hover:underline">
                {t("1. Ouvrir le créateur dans un onglet ↗", "1. Open the creator in a tab ↗")}
              </a>
              <p>{t("2. Créez votre avatar (selfie/photo), copiez son URL ou ID, collez-le ci-dessous :", "2. Create your avatar (selfie/photo), copy its URL or ID, paste below:")}</p>
              <input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="…/64xxxx.glb ou ID"
                className="input w-full text-2xs"
              />
              <button
                type="button"
                onClick={() => { const u = toGlbUrl(urlDraft); if (u) applyAvatar(u); else setNote(t("URL/ID d'avatar invalide.", "Invalid avatar URL/ID.")); }}
                className="btn-secondary w-full text-2xs px-2 py-1"
              >
                {t("Appliquer cet avatar", "Apply this avatar")}
              </button>
            </div>
          </details>
        )}
      </div>

      {creatorOpen && <RpmCreator onExported={applyAvatar} onClose={() => setCreatorOpen(false)} />}

      {/* Conversation */}
      <div className="flex h-[60vh] flex-col rounded-2xl border border-hair bg-card">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mt-8 text-center text-sm text-muted">
              {t(
                "Bonjour 👋 Je suis votre assistant de marque. Posez-moi une question (clavier ou micro) — je connais votre stratégie, votre veille et vos pubs.",
                "Hi 👋 I'm your brand assistant. Ask me anything (keyboard or mic) — I know your strategy, watch and ads.",
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary-600 text-white" : "bg-canvas text-ink"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-2xs text-muted">{t("…", "…")}</div>}
        </div>

        {note && <p className="px-4 text-2xs text-muted">{note}</p>}

        <div className="flex items-center gap-2 border-t border-hair p-3">
          <button
            type="button"
            onClick={toggleMic}
            className={`rounded-full p-2 text-lg ${listening ? "bg-danger-100 text-danger-600 animate-pulse" : "bg-canvas text-ink"}`}
            title={t("Parler", "Speak")}
          >
            🎤
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder={t("Écrivez ou parlez à votre avatar…", "Type or talk to your avatar…")}
            className="input flex-1 text-sm"
          />
          <button type="button" onClick={() => send(input)} disabled={loading || !input.trim()} className="btn-primary text-sm">
            {t("Envoyer", "Send")}
          </button>
        </div>
      </div>
    </div>
  );
}
