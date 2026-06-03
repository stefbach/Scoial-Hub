"use client";

import { useEffect, useState } from "react";

type User = { id: string; email: string; createdAt: string; lastSignInAt: string | null; orgName: string | null };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
        setMsg({ ok: false, text: d.error ?? "Échec de la création." });
      } else {
        setMsg({ ok: true, text: `Utilisateur ${email} créé. Il peut se connecter sur /login.` });
        setEmail(""); setPassword(""); setOrgName("");
        load();
      }
    } catch {
      setMsg({ ok: false, text: "Erreur réseau." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Utilisateurs</h1>
        <p className="mt-0.5 text-sm text-muted">Crée les comptes qui pourront se connecter à l'application.</p>
      </div>

      {!configured && (
        <div className="card border-l-[3px] border-l-warning-500 p-4 text-sm text-muted">
          Supabase (service role) non configuré — la création d'utilisateurs nécessite <span className="font-medium text-ink">SUPABASE_SERVICE_ROLE_KEY</span>.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Création */}
        <form onSubmit={create} className="card h-fit space-y-3 p-5">
          <div className="section-label">Nouvel utilisateur</div>
          <div>
            <label className="mb-1 block text-2xs font-medium uppercase tracking-wide text-muted">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="utilisateur@entreprise.com" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium uppercase tracking-wide text-muted">Mot de passe (8+ car.)</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium uppercase tracking-wide text-muted">Organisation (optionnel)</label>
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Nom de l'entreprise" className="input" />
          </div>
          {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>{msg.text}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Création…" : "Créer l'utilisateur"}</button>
        </form>

        {/* Liste */}
        <div>
          <div className="section-label mb-2.5">Comptes existants</div>
          <div className="card divide-y divide-hair">
            {users === null && <div className="px-4 py-6 text-sm text-muted">Chargement…</div>}
            {users?.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted">Aucun utilisateur. Créez le premier compte.</div>}
            {users?.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-page text-2xs font-bold text-white">
                  {u.email.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{u.email}</div>
                  <div className="text-2xs text-muted">{u.orgName ?? "—"} · {u.lastSignInAt ? "déjà connecté" : "jamais connecté"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
