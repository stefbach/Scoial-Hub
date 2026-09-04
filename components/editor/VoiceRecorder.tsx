"use client";

// Voix off — enregistrement au micro.
//
// Le module « Voix off » n'était qu'un import de fichier, strictement
// identique à « Musique » au rôle près : pour poser un commentaire sur un
// montage, il fallait sortir de la plateforme, enregistrer ailleurs, exporter,
// revenir, importer — et découvrir seulement à ce moment-là si le texte tombe
// juste. Ce composant ferme la boucle sans quitter le banc.
//
// CE QUI REND UNE PRISE UTILISABLE
// Trois choses, dans cet ordre :
//   1. un DÉCOMPTE — sans lui, la première syllabe est toujours coupée ;
//   2. le montage qui JOUE pendant la prise — commenter une image qu'on ne
//      voit pas revient à enregistrer à l'aveugle, et c'est ce qui fait qu'une
//      voix off tombe à côté ;
//   3. une PRÉ-ÉCOUTE avant insertion — une prise ratée ne doit pas polluer la
//      timeline puis l'historique pour être défaite ensuite.

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";

/** Décompte avant le début réel de la prise, en secondes. */
const COUNT_IN = 3;

type Phase = "idle" | "asking" | "counting" | "recording" | "review";

/** Le format que le navigateur sait produire, le meilleur en premier. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export function VoiceRecorder({
  playhead,
  busy,
  onPlay,
  onPause,
  onInsert,
  onImportFile,
}: {
  /** Instant du montage où la prise commencera — figé au lancement. */
  playhead: number;
  /** Un envoi est en cours ailleurs : on n'en lance pas un second. */
  busy: boolean;
  /** Lance la lecture du montage depuis `playhead` — pour parler EN VOYANT. */
  onPlay: () => void;
  onPause: () => void;
  /** Hébergement puis pose sur la piste voix, à `at`. Rend vrai si c'est fait. */
  onInsert: (blob: Blob, fileName: string, at: number, duration: number) => Promise<boolean>;
  /** Import d'un fichier son EXISTANT comme voix off — l'autre façon d'obtenir
      la même chose, qui n'a aucune raison de vivre ailleurs dans le panneau. */
  onImportFile: (file: File) => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(COUNT_IN);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<{ url: string; blob: Blob; duration: number; at: number } | null>(null);
  const [inserting, setInserting] = useState(false);

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  /** Instant du montage où la prise a réellement démarré. */
  const startedAt = useRef(0);
  const startedWall = useRef(0);

  /** Coupe tout : micro, analyse, minuteries. Idempotent. */
  const teardown = useCallback(() => {
    if (raf.current !== null) { cancelAnimationFrame(raf.current); raf.current = null; }
    if (timer.current !== null) { window.clearInterval(timer.current); timer.current = null; }
    recorder.current = null;
    // Le voyant du micro reste allumé dans l'onglet tant que les pistes ne
    // sont pas arrêtées — même une fois l'enregistrement terminé.
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    void audioCtx.current?.close();
    audioCtx.current = null;
    setLevel(0);
  }, []);

  // Quitter l'éditeur, ou fermer le panneau, ne doit jamais laisser le micro
  // ouvert : la libération est portée par le démontage, pas par un bouton.
  useEffect(() => teardown, [teardown]);

  /** Niveau d'entrée — la seule preuve visible que le micro capte vraiment. */
  function watchLevel(src: MediaStream) {
    try {
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(src).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevel(peak);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Analyse indisponible (contexte audio refusé) : l'enregistrement lui-même
      // n'en dépend pas, on se passe du voyant plutôt que d'échouer.
    }
  }

  async function start() {
    setError(null);

    // Un contexte non sécurisé ne DEMANDE même pas l'autorisation : le
    // navigateur retire `mediaDevices` sans le moindre message, et le bouton
    // paraît alors simplement mort. C'est le premier cas à nommer.
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setError(t(
        "Le micro n'est accessible qu'en HTTPS. Cette page est servie en HTTP, le navigateur bloque l'accès sans même le demander.",
        "The microphone is only available over HTTPS. This page is served over HTTP, so the browser blocks access without even asking."
      ));
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t(
        "Ce navigateur ne donne pas accès au micro (mediaDevices absent).",
        "This browser gives no microphone access (mediaDevices missing)."
      ));
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError(t("Ce navigateur ne sait pas enregistrer de son.", "This browser cannot record audio."));
      return;
    }

    // L'autorisation peut prendre plusieurs secondes — le temps que
    // l'utilisateur voie la demande et y réponde. Sans cet état, le bouton
    // reste inerte et donne l'impression de n'avoir rien déclenché.
    setPhase("asking");

    let src: MediaStream;
    try {
      src = await navigator.mediaDevices.getUserMedia({
        // Réglages d'une VOIX, pas d'une captation musicale : la suppression
        // d'écho évite que le montage joué dans les haut-parleurs revienne
        // dans la prise.
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      setPhase("idle");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(t(
          "Accès au micro refusé. Autorisez-le dans la barre d'adresse (icône de cadenas), puis réessayez.",
          "Microphone access denied. Allow it from the address bar (padlock icon), then try again."
        ));
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError(t("Aucun micro détecté sur cet appareil.", "No microphone detected on this device."));
      } else if (name === "NotReadableError") {
        setError(t(
          "Le micro est déjà utilisé par une autre application.",
          "The microphone is already in use by another application."
        ));
      } else {
        // Le nom de l'erreur est affiché : sans lui, un cas non prévu se
        // résume à « ça ne marche pas », ce qui n'aide personne à le corriger.
        setError(t(
          `Micro indisponible${name ? ` (${name})` : ""}.`,
          `Microphone unavailable${name ? ` (${name})` : ""}.`
        ));
      }
      return;
    }

    stream.current = src;
    watchLevel(src);

    // Décompte : la première syllabe d'une prise lancée sans préavis est
    // perdue à tous les coups.
    setPhase("counting");
    setCount(COUNT_IN);
    let left = COUNT_IN;
    timer.current = window.setInterval(() => {
      left -= 1;
      setCount(left);
      if (left > 0) return;
      window.clearInterval(timer.current!);
      timer.current = null;
      beginTake(src, mimeType);
    }, 1000);
  }

  function beginTake(src: MediaStream, mimeType: string) {
    chunks.current = [];
    const rec = new MediaRecorder(src, { mimeType });
    recorder.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: mimeType });
      const duration = (Date.now() - startedWall.current) / 1000;
      teardown();
      onPause();
      if (blob.size === 0) {
        setPhase("idle");
        setError(t("Prise vide — rien n'a été capté.", "Empty take — nothing was captured."));
        return;
      }
      setTake({ url: URL.createObjectURL(blob), blob, duration, at: startedAt.current });
      setPhase("review");
    };

    startedAt.current = playhead;
    startedWall.current = Date.now();
    setElapsed(0);
    rec.start();
    setPhase("recording");
    // Le montage joue PENDANT la prise : commenter une image qu'on ne voit pas
    // est la première cause d'une voix off qui tombe à côté.
    onPlay();
    timer.current = window.setInterval(() => setElapsed((Date.now() - startedWall.current) / 1000), 100);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  /** Abandonne la prise en cours sans rien poser sur la timeline. */
  function cancel() {
    if (recorder.current?.state === "recording") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    teardown();
    onPause();
    setPhase("idle");
  }

  function discardTake() {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setPhase("idle");
  }

  async function insert() {
    if (!take) return;
    setInserting(true);
    const ext = take.blob.type.includes("ogg") ? "ogg" : take.blob.type.includes("mp4") ? "m4a" : "webm";
    const ok = await onInsert(take.blob, `voix-off-${Date.now()}.${ext}`, take.at, take.duration);
    setInserting(false);
    if (ok) discardTake();
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-hair p-2">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
        {t("Voix off", "Voiceover")}
      </p>

      {error && <p className="text-2xs text-danger">{error}</p>}

      {phase === "idle" && (
        <>
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="btn-secondary w-full text-xs disabled:opacity-50"
            title={t("Enregistre au micro, en regardant le montage jouer", "Records from the microphone while the edit plays")}
          >
            🎙 {t("Enregistrer au micro", "Record from microphone")}
          </button>
          <p className="text-[9px] text-muted">
            {t(
              `Décompte de ${COUNT_IN} s, puis le montage joue depuis la tête de lecture (${playhead.toFixed(1)} s).`,
              `${COUNT_IN}s count-in, then the edit plays from the playhead (${playhead.toFixed(1)}s).`
            )}
          </p>
          <FileButton
            label={t("Ou importer un fichier son", "Or import a sound file")}
            accept="audio/*"
            onFile={onImportFile}
          />
        </>
      )}

      {phase === "asking" && (
        <div className="space-y-1.5 text-center">
          <p className="text-2xs text-muted">
            {t("Autorisez l'accès au micro dans le navigateur…", "Allow microphone access in the browser…")}
          </p>
          <Spinner size={14} className="mx-auto text-page" />
        </div>
      )}

      {phase === "counting" && (
        <div className="space-y-1.5 text-center">
          <p className="text-2xl font-bold tabular-nums text-ink">{count}</p>
          <p className="text-2xs text-muted">{t("Préparez-vous…", "Get ready…")}</p>
          <button type="button" onClick={cancel} className="btn-secondary w-full text-xs">
            {t("Annuler", "Cancel")}
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-2xs">
            <span className="flex items-center gap-1.5 font-medium text-danger">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-danger-500" />
              {t("Enregistrement", "Recording")}
            </span>
            <span className="tabular-nums text-ink">{elapsed.toFixed(1)}s</span>
          </div>
          {/* Voyant de niveau : sans lui, un micro muet ne se découvre qu'à la
              pré-écoute, une prise trop tard. */}
          <div className="h-1.5 overflow-hidden rounded-full bg-canvas" role="presentation">
            <div
              className="h-full rounded-full bg-page transition-[width] duration-75"
              style={{ width: `${Math.min(100, Math.round(level * 140))}%` }}
            />
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={stop} className="btn-primary flex-1 text-xs">
              ⏹ {t("Arrêter", "Stop")}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary text-xs">
              {t("Annuler", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {phase === "review" && take && (
        <div className="space-y-1.5">
          <p className="text-2xs text-muted">
            {t(
              `Prise de ${take.duration.toFixed(1)} s, à poser à ${take.at.toFixed(1)} s.`,
              `${take.duration.toFixed(1)}s take, to be placed at ${take.at.toFixed(1)}s.`
            )}
          </p>
          {/* Pré-écoute AVANT insertion : une prise ratée ne doit pas polluer la
              timeline puis l'historique pour être défaite ensuite. */}
          <audio src={take.url} controls className="w-full" />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={insert}
              disabled={inserting || busy}
              className="btn-primary flex-1 text-xs disabled:opacity-50"
            >
              {inserting ? <Spinner size={12} /> : "✓"} {t("Insérer", "Insert")}
            </button>
            <button
              type="button"
              onClick={() => { discardTake(); void start(); }}
              disabled={inserting}
              className="btn-secondary text-xs disabled:opacity-50"
              title={t("Jette cette prise et en relance une", "Discards this take and starts another")}
            >
              ↻ {t("Refaire", "Retake")}
            </button>
            <button type="button" onClick={discardTake} disabled={inserting} className="btn-secondary text-xs disabled:opacity-50">
              {t("Jeter", "Discard")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Import d'un fichier — le pendant de l'enregistrement, au même endroit. */
function FileButton({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full rounded px-1.5 py-1 text-[10px] text-muted ring-1 ring-hair hover:text-ink"
      >
        📁 {label}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </>
  );
}
