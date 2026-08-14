"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

type User = { id: string; email: string; createdAt: string; lastSignInAt: string | null; orgName: string | null };

export default function AdminUsersPage() {
  const t = useT();
  const [users, setUsers] = useState<User[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Réinitialisation du mot de passe d'un compte existant.
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/users");
      const d = await res.json();
      setUsers(d.users ?? []);
      setConfigured(d.configured !== false);
    } catch {
      setUsers([]);
    }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, orgName }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: d.error ?? t("Échec de la création.", "Creation failed.") });
      } else {
        setMsg({
          ok: true,
          text: d.emailSent
            ? t(
                `Utilisateur ${email} créé. Le mot de passe saisi ici fonctionne immédiatement ; l'e-mail envoyé lui permet, s'il préfère, d'en choisir un autre.`,
                `User ${email} created. The password you typed works right away; the email lets them pick their own instead if they prefer.`
              )
            : t(
                `Utilisateur ${email} créé, mais l'e-mail d'accès n'a pas pu partir (service e-mail non configuré) : communiquez-lui son mot de passe et l'adresse /login.`,
                `User ${email} created, but the access email could not be sent (email service not configured): share the password and the /login address with them.`
              ),
        });
        setEmail(""); setPassword(""); setOrgName("");
        load();
      }
    } catch {
      setMsg({ ok: false, text: t("Erreur réseau.", "Network error.") });
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    setResetBusy(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resetFor.id, password: newPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        setResetMsg({ ok: false, text: d.error ?? t("Échec.", "Failed.") });
        return;
      }
      setResetMsg({
        ok: true,
        text: t(
          `Mot de passe redéfini pour ${resetFor.email}. Il est actif immédiatement.`,
          `Password reset for ${resetFor.email}. It works immediately.`
        ),
      });
      setNewPassword("");
    } catch {
      setResetMsg({ ok: false, text: t("Erreur réseau.", "Network error.") });
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">{t("Utilisateurs", "Users")}</h1>
        <p className="mt-0.5 text-sm text-muted">{t("Crée les comptes qui pourront se connecter à l'application.", "Create accounts that can sign in to the application.")}</p>
      </div>

      {!configured && (
        <div className="card border-l-[3px] border-l-warning-500 p-4 text-sm text-muted">
          {t(
            "Supabase (service role) non configuré — la création d'utilisateurs nécessite",
            "Supabase (service role) not configured — user creation requires"
          )}{" "}
          <span className="font-medium text-ink">SUPABASE_SERVICE_ROLE_KEY</span>.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Création */}
        <form onSubmit={create} className="card h-fit space-y-3 p-5">
          <div className="section-label">{t("Nouvel utilisateur", "New user")}</div>
          <div>
            <label className="mb-1 block text-2xs font-medium uppercase tracking-wide text-muted">{t("Email", "Email")}</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("utilisateur@entreprise.com", "user@company.com")} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium uppercase tracking-wide text-muted">{t("Mot de passe (8+ car.)", "Password (8+ chars)")}</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium uppercase tracking-wide text-muted">{t("Organisation (optionnel)", "Organisation (optional)")}</label>
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={t("Nom de l'entreprise", "Company name")} className="input" />
          </div>
          {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>{msg.text}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? t("Création…", "Creating…") : t("Créer l'utilisateur", "Create user")}</button>
        </form>

        {/* Liste */}
        <div>
          <div className="section-label mb-2.5">{t("Comptes existants", "Existing accounts")}</div>
          <div className="card divide-y divide-hair">
            {users === null && <div className="px-4 py-6 text-sm text-muted">{t("Chargement…", "Loading…")}</div>}
            {users?.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted">{t("Aucun utilisateur. Créez le premier compte.", "No users yet. Create the first account.")}</div>}
            {users?.map((u) => (
              <div key={u.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-page text-2xs font-bold text-white">
                    {u.email.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{u.email}</div>
                    <div className="text-2xs text-muted">{u.orgName ?? "—"} · {u.lastSignInAt ? t("déjà connecté", "signed in before") : t("jamais connecté", "never signed in")}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResetFor(resetFor?.id === u.id ? null : u);
                      setNewPassword("");
                      setResetMsg(null);
                    }}
                    className="btn-secondary shrink-0 text-2xs"
                  >
                    {t("Mot de passe", "Password")}
                  </button>
                </div>

                {/* Redéfinition directe : le nouveau mot de passe est actif tout
                    de suite, sans e-mail ni action de la part de l'utilisateur. */}
                {resetFor?.id === u.id && (
                  <form onSubmit={resetPassword} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-canvas p-3">
                    <input
                      type="text"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("Nouveau mot de passe (8+ car.)", "New password (8+ chars)")}
                      className="input min-w-[200px] flex-1 text-xs"
                    />
                    <button type="submit" disabled={resetBusy} className="btn-primary shrink-0 text-2xs disabled:opacity-50">
                      {resetBusy ? t("Enregistrement…", "Saving…") : t("Redéfinir", "Reset")}
                    </button>
                    <p className="w-full text-2xs text-muted">
                      {t(
                        "Saisi en clair pour pouvoir être relu et communiqué sans erreur.",
                        "Shown in plain text so it can be read back and shared without error."
                      )}
                    </p>
                    {resetMsg && (
                      <p className={`w-full rounded-md px-2.5 py-1.5 text-2xs ${resetMsg.ok ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>
                        {resetMsg.text}
                      </p>
                    )}
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
