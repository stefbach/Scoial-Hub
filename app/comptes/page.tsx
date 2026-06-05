"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/brand/Logo";
import { useT } from "@/lib/i18n";

// Hub de comptes : le client choisit l'entité à piloter → interface client dédiée.
export default function ComptesHubPage() {
  const router = useRouter();
  const t = useT();
  const { companies, setCompanyId } = useCompany();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  function open(id: string) {
    setCompanyId(id);
    router.push("/dashboard");
  }

  async function logout() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-hair bg-card/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <Logo size={28} />
        <div className="flex min-w-0 items-center gap-3">
          {email && <span className="hidden min-w-0 truncate text-sm text-muted sm:block">{email}</span>}
          <button onClick={logout} className="btn-ghost shrink-0 text-sm">{t("Se déconnecter", "Sign out")}</button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t("Vos comptes", "Your accounts")}</h1>
          <p className="mt-1 text-sm text-muted">{t("Sélectionnez un compte pour accéder à son espace de pilotage.", "Select an account to access its management space.")}</p>
        </div>

        {companies.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-muted">{t("Aucun compte ne vous est rattaché pour l'instant.", "No account is linked to your profile yet.")}</p>
            <p className="mt-1 text-2xs text-muted">{t("Contactez votre administrateur pour qu'il vous donne accès à un compte.", "Contact your administrator to get access to an account.")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => open(c.id)}
                className="card group p-5 text-left transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm" style={{ background: c.accent ?? "#5b2d8e" }}>
                    {c.code}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{c.name}</div>
                    <div className="truncate text-2xs text-muted">{c.brandVoice}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-hair pt-3 text-2xs text-muted">
                  <span>{t("Pilotage social media", "Social media management")}</span>
                  <span className="font-semibold text-page transition-transform group-hover:translate-x-0.5">{t("Ouvrir →", "Open →")}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
