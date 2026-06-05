"use client";

// Boutons d'inscription / connexion via Google et Facebook (Supabase OAuth).
// Fonctionnent dès que le provider est activé dans Supabase (Authentication →
// Providers). Sinon, message d'erreur clair (pas de plantage).

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" fill="#FBBC05" />
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M18 9a9 9 0 1 0-10.4 8.9v-6.3H5.3V9h2.3V7c0-2.3 1.36-3.56 3.45-3.56.99 0 2.03.18 2.03.18v2.24h-1.14c-1.13 0-1.48.7-1.48 1.42V9h2.52l-.4 2.6h-2.12v6.3A9 9 0 0 0 18 9z" fill="#1877F2" />
    </svg>
  );
}

export function SocialAuthButtons({ next = "/demarrage" }: { next?: string }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(provider: "google" | "facebook") {
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError(t("Authentification non configurée.", "Authentication not configured."));
      return;
    }
    setBusy(provider);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (err) {
      setBusy(null);
      setError(
        t(
          `Connexion ${provider} indisponible (à activer dans Supabase).`,
          `${provider} sign-in unavailable (enable it in Supabase).`
        )
      );
    }
    // Sinon : redirection automatique vers le provider.
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-2xs text-danger-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => go("google")}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-hair bg-card px-4 py-2.5 text-sm font-medium text-ink shadow-xs transition-colors hover:bg-canvas disabled:opacity-50"
        >
          <GoogleIcon /> {busy === "google" ? "…" : t("Google", "Google")}
        </button>
        <button
          type="button"
          onClick={() => go("facebook")}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-hair bg-card px-4 py-2.5 text-sm font-medium text-ink shadow-xs transition-colors hover:bg-canvas disabled:opacity-50"
        >
          <FacebookIcon /> {busy === "facebook" ? "…" : t("Facebook", "Facebook")}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hair" />
        <span className="text-2xs uppercase tracking-wide text-muted">{t("ou", "or")}</span>
        <span className="h-px flex-1 bg-hair" />
      </div>
    </div>
  );
}
