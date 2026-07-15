"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { useT } from "@/lib/i18n";

export default function SignupPage() {
  const router = useRouter();
  const t = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Affiché quand le compte est créé mais nécessite une confirmation e-mail
  // (signUp renvoie un user SANS session) — on ne redirige PAS dans ce cas.
  const [emailConfirm, setEmailConfirm] = useState(false);
  // Affiché après création + bootstrap : l'org est en attente de validation par
  // l'admin générale. On NE redirige PAS vers /dashboard (verrouillé) — on
  // explique que l'accès est ouvert dès validation.
  const [pendingApproval, setPendingApproval] = useState(false);

  const isDemo = !isSupabaseConfigured;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        setError(t("Supabase n'est pas configuré.", "Supabase is not configured."));
        return;
      }

      // 1. Crée le compte utilisateur
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(
          signUpError.message.includes("already registered")
            ? t("Un compte existe déjà avec cet e-mail. Connectez-vous.", "An account already exists with this email. Please sign in.")
            : signUpError.message
        );
        return;
      }

      if (!data.user) {
        setError(t("La création du compte a échoué. Réessayez.", "Account creation failed. Please try again."));
        return;
      }

      // Confirmation e-mail requise : user présent mais PAS de session.
      // On NE redirige PAS vers /dashboard (il serait inaccessible) — on invite
      // l'utilisateur à confirmer son adresse. Le bootstrap se fera après login.
      if (!data.session) {
        setEmailConfirm(true);
        return;
      }

      // 2. Session active → bootstrap : crée org + membership + companies démo
      const bootstrapRes = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgName.trim() || undefined }),
      });

      if (!bootstrapRes.ok) {
        // Non bloquant : on affiche quand même l'écran d'attente de validation.
        console.warn("[signup] bootstrap failed:", await bootstrapRes.text());
      }

      // L'org est créée en `pending` : accès ouvert seulement après validation
      // par l'admin générale. On affiche l'écran d'attente plutôt que de rediriger.
      setPendingApproval(true);
    } catch {
      setError(t("Une erreur inattendue s'est produite.", "An unexpected error occurred."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-page text-white shadow-md mb-4">
            <svg width="22" height="22" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="3.8" r="2" fill="currentColor" opacity="0.95" />
              <circle cx="2.8" cy="10.2" r="1.65" fill="currentColor" opacity="0.75" />
              <circle cx="11.2" cy="10.2" r="1.65" fill="currentColor" opacity="0.75" />
              <line x1="7" y1="5.7" x2="3.3" y2="8.7" stroke="currentColor" strokeWidth="0.85" opacity="0.45" />
              <line x1="7" y1="5.7" x2="10.7" y2="8.7" stroke="currentColor" strokeWidth="0.85" opacity="0.45" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">AXON-AI</h1>
          <p className="text-sm text-muted mt-1">{t("Créez votre espace de travail", "Create your workspace")}</p>
        </div>

        {/* Bandeau mode démo */}
        {isDemo && (
          <div className="mb-6 rounded-xl border border-hair bg-card p-4 text-sm text-muted">
            <p className="font-semibold text-ink mb-1">{t("Mode démo — authentification désactivée", "Demo mode — authentication disabled")}</p>
            <p className="mb-3">{t("Supabase n'est pas configuré. L'application fonctionne avec des données de démonstration.", "Supabase is not configured. The application runs with demo data.")}</p>
            <Link
              href="/dashboard"
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
            >
              {t("Entrer dans la démo", "Enter demo")}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        )}

        {/* Compte créé + bootstrap : en attente de validation par l'admin */}
        {pendingApproval ? (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-50 text-warning-700">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-ink">
              {t("Compte en attente de validation", "Account awaiting approval")}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {t(
                "Votre compte a bien été créé. Un administrateur doit le valider avant que vous puissiez accéder à votre espace.",
                "Your account has been created. An administrator must approve it before you can access your workspace."
              )}
            </p>
            <p className="mt-2 text-2xs text-muted">
              {t(
                "Vous pourrez vous connecter dès la validation de votre compte.",
                "You'll be able to sign in as soon as your account is approved."
              )}
            </p>
            <Link
              href="/login"
              className="btn-primary mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg"
            >
              {t("Aller à la connexion", "Go to sign in")}
            </Link>
          </div>
        ) : emailConfirm ? (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-50 text-success-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-ink">
              {t("Vérifiez votre e-mail", "Check your email")}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {t(
                "Vérifiez votre e-mail pour confirmer votre compte. Un lien a été envoyé à",
                "Check your email to confirm your account. A link was sent to"
              )}{" "}
              <span className="font-medium text-ink">{email}</span>.
            </p>
            <p className="mt-2 text-2xs text-muted">
              {t(
                "Une fois confirmé, connectez-vous pour finaliser la configuration de votre espace.",
                "Once confirmed, sign in to finish setting up your workspace."
              )}
            </p>
            <Link
              href="/login"
              className="btn-primary mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg"
            >
              {t("Aller à la connexion", "Go to sign in")}
            </Link>
          </div>
        ) : (
        /* Formulaire d'inscription */
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-ink mb-6">{t("Créer un compte", "Create an account")}</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          {!isDemo && (
            <div className="mb-5">
              <SocialAuthButtons next="/demarrage" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-ink mb-1.5">
                {t("Nom de l'organisation", "Organisation name")}
              </label>
              <input
                id="orgName"
                type="text"
                autoComplete="organization"
                disabled={isDemo || loading}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={t("Mon Agence", "My Agency")}
                className="input disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-muted">{t("Optionnel — vous pourrez le modifier plus tard.", "Optional — you can change it later.")}</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                {t("Adresse e-mail", "Email address")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={isDemo || loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("vous@exemple.com", "you@example.com")}
                className="input disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                {t("Mot de passe", "Password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={isDemo || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("8 caractères minimum", "8 characters minimum")}
                className="input disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isDemo || loading}
              className="btn-primary w-full py-2.5 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("Création en cours…", "Creating account…") : t("Créer mon compte", "Create my account")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {t("Déjà inscrit ?", "Already have an account?")}{" "}
            <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
              {t("Se connecter", "Sign in")}
            </Link>
          </p>
        </div>
        )}

        <p className="text-center text-xs text-muted mt-6">
          <Link href="/" className="hover:text-ink transition-colors">
            {t("Retour à l'accueil", "Back to home")}
          </Link>
        </p>
      </div>
    </div>
  );
}
