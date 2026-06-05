"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/brand/Logo";
import { NewCompanyModal } from "@/components/company/NewCompanyModal";
import { useT } from "@/lib/i18n";

// Hub de comptes : le client choisit l'entité à piloter → interface client dédiée.
export default function ComptesHubPage() {
  const router = useRouter();
  const t = useT();
  const { companies, setCompanyId } = useCompany();
  const [email, setEmail] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

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
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{t("Vos comptes", "Your accounts")}</h1>
            <p className="mt-1 text-sm text-muted">{t("Sélectionnez un compte, ou créez-en un nouveau.", "Select an account, or create a new one.")}</p>
          </div>
          <button onClick={() => setNewOpen(true)} className="btn-primary text-sm">
            {t("+ Nouvelle société", "+ New company")}
          </button>
        </div>

        {companies.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm font-medium text-ink">{t("Aucune société pour l'instant", "No company yet")}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{t("Créez votre première société : l'IA construira son profil à partir de votre site et de vos réseaux.", "Create your first company: the AI will build its profile from your website and social accounts.")}</p>
            <button onClick={() => setNewOpen(true)} className="btn-primary mt-4 text-sm">
              {t("+ Créer une société", "+ Create a company")}
            </button>
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

      <NewCompanyModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
