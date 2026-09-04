"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "axon_pwa_install_dismissed";

/**
 * Bannière discrète "Installer l'application" (PWA) — capte l'événement
 * natif `beforeinstallprompt` (Chrome/Edge/Android) ; sur iOS/Safari, qui
 * n'expose pas cet événement, affiche l'instruction manuelle à la place.
 * Enregistre aussi le service worker (app shell + secours hors-ligne).
 */
export function InstallPrompt() {
  const t = useT();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* pas bloquant : l'app fonctionne sans service worker */
      });
    }

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* stockage indisponible (navigation privée…) : on retente l'affichage */
    }
    if (dismissed) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return; // déjà installée

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (ios) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("Installer l'application", "Install the app")}
      className="fixed inset-x-3 bottom-3 z-[80] flex items-center justify-between gap-3 rounded-xl border border-hair bg-card px-4 py-3 shadow-lg sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{t("Installer AXON-AI", "Install AXON-AI")}</p>
        <p className="mt-0.5 text-2xs text-muted">
          {isIOS
            ? t("Safari → Partager → Sur l'écran d'accueil", "Safari → Share → Add to Home Screen")
            : t("Accès direct depuis votre bureau ou mobile, sans navigateur.", "Direct access from your desktop or phone, no browser needed.")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!isIOS && (
          <button
            type="button"
            onClick={install}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-2xs font-semibold text-white hover:bg-primary-700"
          >
            {t("Installer", "Install")}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("Fermer", "Dismiss")}
          className="rounded-lg px-2 py-1.5 text-2xs text-muted hover:bg-canvas"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
