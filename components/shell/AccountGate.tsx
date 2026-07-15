"use client";

// ── Verrou d'auto-inscription (validation admin) ─────────────────────────────
// Une organisation auto-créée démarre en `pending` : l'utilisateur est connecté
// mais son espace n'est PAS accessible tant que l'admin générale ne l'a pas
// validé. Ce garde-fou client bloque l'interface applicative et affiche un écran
// d'attente (ou de suspension), sans jamais gêner les pages publiques (landing,
// auth, console admin, pages légales).
//
// La vérité serveur est assurée en parallèle par les guards d'API
// (requireCompanyAccess / requireAccountAdmin) : ce verrou est une couche UX,
// pas une frontière de sécurité.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/brand/Logo";
import { useT } from "@/lib/i18n";

type GateStatus =
  | "loading"
  | "demo"
  | "unauthenticated"
  | "none"
  | "pending"
  | "approved"
  | "suspended";

// Cache au niveau module : le statut ne change pas au fil de la navigation
// client (AccountGate vit dans le layout racine et ne se démonte pas). Une seule
// requête par session de page ; les rechargements navigateur la relancent.
let cachedStatus: GateStatus | null = null;

/** Pages publiques : jamais soumises au verrou. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/admin")
  );
}

export function AccountGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const gated = isSupabaseConfigured && !isPublicPath(pathname);
  const [status, setStatus] = useState<GateStatus>(
    !gated ? "approved" : cachedStatus ?? "loading"
  );

  useEffect(() => {
    if (!gated) return;
    if (cachedStatus) {
      setStatus(cachedStatus);
      return;
    }
    let alive = true;
    fetch("/api/me/org-status")
      .then((r) => (r.ok ? r.json() : { status: "approved" }))
      .then((d) => {
        const s = (d?.status as GateStatus) ?? "approved";
        cachedStatus = s;
        if (alive) setStatus(s);
      })
      .catch(() => {
        // En cas d'échec réseau, on n'enferme pas l'utilisateur.
        cachedStatus = "approved";
        if (alive) setStatus("approved");
      });
    return () => {
      alive = false;
    };
  }, [gated, pathname]);

  if (!gated) return <>{children}</>;

  if (status === "loading") return <GateSplash />;
  if (status === "pending") return <PendingScreen />;
  if (status === "suspended") return <SuspendedScreen />;

  // demo / unauthenticated / none / approved → accès normal.
  return <>{children}</>;
}

function GateSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-hair border-t-page" aria-label="Chargement" />
    </div>
  );
}

/** Coquille commune des écrans de verrou. */
function GateShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useT();

  async function logout() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    cachedStatus = null;
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 flex justify-center">
          <Logo size={30} />
        </div>
        <div className="card p-8 text-center">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">
          <button onClick={logout} className="hover:text-ink transition-colors">
            {t("Se déconnecter", "Sign out")}
          </button>
        </p>
      </div>
    </div>
  );
}

function PendingScreen() {
  const t = useT();
  return (
    <GateShell>
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
          "Vous recevrez l'accès dès la validation. Rechargez cette page pour vérifier l'état.",
          "You'll get access as soon as it's approved. Reload this page to check the status."
        )}
      </p>
    </GateShell>
  );
}

function SuspendedScreen() {
  const t = useT();
  return (
    <GateShell>
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-ink">
        {t("Compte suspendu", "Account suspended")}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {t(
          "L'accès à votre espace a été suspendu. Contactez l'administrateur de la plateforme pour le réactiver.",
          "Access to your workspace has been suspended. Contact the platform administrator to reactivate it."
        )}
      </p>
    </GateShell>
  );
}
