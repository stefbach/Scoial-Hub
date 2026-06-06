"use client";

/**
 * Créateur d'avatar Ready Player Me embarqué (iframe + frame API officielle).
 * L'utilisateur crée/personnalise son avatar ; à l'export, on récupère l'URL
 * du modèle .glb via le message `v1.avatar.exported`.
 * Docs : https://docs.readyplayer.me/ready-player-me/integration-guides/web-and-native-integration/avatar-creator-integration
 */

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";

export function RpmCreator({
  onExported,
  onClose,
  subdomain = "demo",
}: {
  onExported: (glbUrl: string) => void;
  onClose: () => void;
  subdomain?: string;
}) {
  const t = useT();
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      let json: { source?: string; eventName?: string; data?: { url?: string } } | null = null;
      try {
        json = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!json || json.source !== "readyplayerme") return;

      // À la disponibilité du frame, on s'abonne à tous les événements v1.
      if (json.eventName === "v1.frame.ready") {
        frameRef.current?.contentWindow?.postMessage(
          JSON.stringify({ target: "readyplayerme", type: "subscribe", eventName: "v1.**" }),
          "*"
        );
      }
      // Avatar exporté → URL du .glb.
      if (json.eventName === "v1.avatar.exported" && json.data?.url) {
        onExported(json.data.url);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onExported]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-hair px-4 py-2">
          <span className="text-sm font-semibold text-ink">🧑‍🎨 {t("Créer votre avatar 3D", "Create your 3D avatar")}</span>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>
        <iframe
          ref={frameRef}
          title="Ready Player Me"
          allow="camera *; microphone *; clipboard-write"
          className="h-full w-full border-0"
          src={`https://${subdomain}.readyplayer.me/avatar?frameApi`}
        />
      </div>
    </div>
  );
}
