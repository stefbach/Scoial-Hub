"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

export default function AdminLoginPage() {
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(t("Identifiants invalides.", "Invalid credentials."));
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError(t("Erreur réseau, réessayez.", "Network error, please try again."));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-page text-white shadow-md">
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1.5l5 2.5v3c0 3-2.2 4.8-5 5.5C4.2 11.8 2 10 2 7V4L7 1.5Z" stroke="currentColor" strokeWidth="1.1" fill="none" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">AXON-AI — Admin</span>
        </div>
        <div className="card p-6">
          <h1 className="text-base font-semibold text-ink">{t("Console d'administration", "Administration console")}</h1>
          <p className="mt-1 text-sm text-muted">{t("Connectez-vous pour gérer les comptes et le paramétrage.", "Sign in to manage accounts and settings.")}</p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="section-label mb-1 block text-muted">{t("Email", "Email")}</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@socialhub.com" className="input" />
            </div>
            <div>
              <label className="section-label mb-1 block text-muted">{t("Mot de passe", "Password")}</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" />
            </div>
            {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t("Connexion…", "Signing in…") : t("Se connecter", "Sign in")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
