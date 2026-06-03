"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/brand/Logo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/comptes";
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError === "auth_callback_failed" ? "Échec de la connexion. Veuillez réessayer." : null
  );

  // Mode démo : si non configuré, affiche le bandeau
  const isDemo = !isSupabaseConfigured;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase n'est pas configuré.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Email ou mot de passe incorrect."
            : signInError.message
        );
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError("Une erreur inattendue s'est produite.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size={44} />
          <p className="text-sm text-muted">Connectez-vous à votre espace</p>
        </div>

        {/* Bandeau mode démo */}
        {isDemo && (
          <div className="mb-6 rounded-xl border border-hair bg-card p-4 text-sm text-muted">
            <p className="font-semibold text-ink mb-1">Mode démo — authentification désactivée</p>
            <p className="mb-3">Supabase n&apos;est pas configuré. L&apos;application fonctionne avec des données de démonstration.</p>
            <Link
              href="/dashboard"
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
            >
              Entrer dans la démo
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        )}

        {/* Formulaire de connexion */}
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-ink mb-6">Connexion</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={isDemo || loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="input disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isDemo || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isDemo || loading}
              className="btn-primary w-full py-2.5 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Connexion en cours…" : "Se connecter"}
            </button>
          </form>

          <p className="mt-6 text-center text-2xs text-muted">
            Accès réservé. Les comptes sont créés par votre administrateur.
          </p>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          <Link href="/" className="hover:text-ink transition-colors">
            Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  );
}
