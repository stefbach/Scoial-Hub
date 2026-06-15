"use client";

// ── Mon équipe ───────────────────────────────────────────────────────────────
// L'admin du compte ajoute des utilisateurs et leur accorde un accès à une ou
// plusieurs sociétés, en mode ÉDITION ou LECTURE. Réservé aux admins du compte.

import { useCallback, useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/lib/i18n";
import type { TeamMember, TeamInvitation, CompanyAccessGrant, OrgRole } from "@/lib/rbac/types";

interface TeamCompany { id: string; name: string; code: string }
type AccessChoice = "none" | "view" | "edit";

function accessFor(list: CompanyAccessGrant[], companyId: string): AccessChoice {
  const g = list.find((a) => a.companyId === companyId);
  return g ? g.mode : "none";
}

export default function MonEquipePage() {
  const { access } = useCompany();
  const t = useT();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [companies, setCompanies] = useState<TeamCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Aucun email n'est envoyé automatiquement : on fournit un texte d'invitation
  // copiable (lien d'inscription + email) que l'admin partage lui-même.
  const inviteText = useCallback((email: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return t(
      `Bonjour,\n\nVous êtes invité(e) à rejoindre notre espace AXON-AI Social Hub.\nCréez votre compte avec cette adresse e-mail : ${email}\n👉 ${origin}/signup\n\nVos accès seront actifs dès votre première connexion.`,
      `Hello,\n\nYou've been invited to join our AXON-AI Social Hub workspace.\nCreate your account using this email: ${email}\n👉 ${origin}/signup\n\nYour access will be active on your first sign-in.`
    );
  }, [t]);

  const copyInvite = useCallback(async (email: string) => {
    try {
      await navigator.clipboard.writeText(inviteText(email));
      setNote(t("Invitation copiée — collez-la dans un e-mail ou un message.", "Invitation copied — paste it into an email or message."));
    } catch {
      setNote(t("Copie impossible. Sélectionnez le texte manuellement.", "Copy failed. Select the text manually."));
    }
  }, [inviteText, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (res.status === 403) { setDenied(true); return; }
      const d = await res.json();
      setMembers(d.members ?? []);
      setInvitations(d.invitations ?? []);
      setCompanies(d.companies ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeMember(userId: string) {
    if (!window.confirm(t("Retirer ce membre de l'équipe ?", "Remove this member from the team?"))) return;
    await fetch(`/api/team?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    load();
  }
  async function revokeInvite(id: string) {
    await fetch(`/api/team?invitationId=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  if (!access.isAccountAdmin || denied) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t("Mon équipe", "My team")} scoped={false} />
        <div className="card p-8 text-center text-sm text-muted">
          {t("Cet espace est réservé aux administrateurs du compte.", "This area is reserved for account administrators.")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={t("Mon équipe", "My team")}
        scoped={false}
        actions={
          <button onClick={() => setAdding(true)} className="btn-primary text-sm">
            + {t("Ajouter un utilisateur", "Add a user")}
          </button>
        }
      />
      <p className="-mt-3 max-w-3xl text-sm text-muted">
        {t(
          "Ajoutez des utilisateurs et donnez-leur accès à une ou plusieurs sociétés, en édition ou en lecture. Les administrateurs ont accès à tout.",
          "Add users and grant them access to one or several companies, in edit or view mode. Admins have full access."
        )}
        <br />
        {t(
          "Un utilisateur qui a déjà un compte est ajouté immédiatement. Sinon, une invitation est créée : copiez-la et envoyez-la-lui — ses accès s'activeront à sa première connexion.",
          "A user who already has an account is added immediately. Otherwise an invitation is created: copy it and send it to them — their access activates on first sign-in."
        )}
      </p>

      {note && (
        <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink ring-1 ring-hair">{note}</p>
      )}

      {loading ? (
        <div className="card p-8 text-center text-sm text-muted">{t("Chargement…", "Loading…")}</div>
      ) : (
        <>
          {/* Membres */}
          <div className="card divide-y divide-hair">
            {members.length === 0 && (
              <div className="p-6 text-center text-sm text-muted">{t("Aucun membre. Ajoutez votre équipe.", "No members yet. Add your team.")}</div>
            )}
            {members.map((m) => (
              <div key={m.userId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{m.email}</p>
                    <span className={`chip ${m.role === "member" ? "" : "text-ai-text"}`}>
                      {m.role === "owner" ? t("Propriétaire", "Owner") : m.role === "admin" ? t("Admin", "Admin") : t("Utilisateur", "User")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs text-muted">
                    {m.role !== "member"
                      ? t("Accès total à toutes les sociétés", "Full access to all companies")
                      : m.access.length
                      ? m.access.map((a) => {
                          const c = companies.find((x) => x.id === a.companyId);
                          return `${c?.name ?? "?"} (${a.mode === "edit" ? t("éd.", "edit") : t("lect.", "view")})`;
                        }).join(" · ")
                      : t("Aucune société assignée", "No company assigned")}
                  </p>
                </div>
                {m.role !== "owner" && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => setEditing(m)} className="btn-secondary text-2xs">{t("Accès", "Access")}</button>
                    <button onClick={() => removeMember(m.userId)} className="btn-ghost text-2xs text-danger-600">{t("Retirer", "Remove")}</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Invitations en attente */}
          {invitations.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-2">{t("Invitations en attente", "Pending invitations")}</p>
              <div className="space-y-2">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-hair bg-white/[0.03] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{inv.email}</p>
                      <p className="text-2xs text-muted">{t("Rejoindra à la première connexion", "Will join on first sign-in")} · {inv.access.length} {t("société(s)", "company(ies)")}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => copyInvite(inv.email)} className="btn-secondary text-2xs">{t("📋 Copier l'invitation", "📋 Copy invitation")}</button>
                      <button onClick={() => revokeInvite(inv.id)} className="btn-ghost text-2xs text-danger-600">{t("Annuler", "Cancel")}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {adding && (
        <MemberEditor
          companies={companies}
          onClose={() => setAdding(false)}
          onSaved={(res) => {
            setAdding(false);
            load();
            if (res?.invited && res.email) {
              copyInvite(res.email);
              // Un e-mail d'invitation est envoyé via Supabase Auth quand c'est
              // possible ; sinon on retombe sur le texte copié (lien-relais).
              setNote(
                res.emailSent
                  ? t(
                      `Invitation envoyée par e-mail à ${res.email} ✓ (le texte a aussi été copié, en secours). Ses accès s'activeront à sa première connexion.`,
                      `Invitation emailed to ${res.email} ✓ (the text was also copied, as a backup). Their access activates on first sign-in.`
                    )
                  : t(
                      `Invitation créée pour ${res.email}, mais l'e-mail n'a pas pu être envoyé (SMTP non configuré côté Supabase). Le texte d'invitation a été copié — envoyez-le-lui vous-même pour finaliser la création de son compte.`,
                      `Invitation created for ${res.email}, but the email could not be sent (SMTP not configured in Supabase). The invitation text was copied — send it to them yourself so they can finish creating their account.`
                    )
              );
            } else if (res?.added) {
              setNote(t("Utilisateur ajouté à l'équipe ✓", "User added to the team ✓"));
            }
          }}
        />
      )}
      {editing && (
        <MemberEditor
          companies={companies}
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// Éditeur d'un membre : email + rôle + matrice d'accès par société.
function MemberEditor({
  companies,
  member,
  onClose,
  onSaved,
}: {
  companies: TeamCompany[];
  member?: TeamMember;
  onClose: () => void;
  onSaved: (res?: { added?: boolean; invited?: boolean; emailSent?: boolean; email?: string }) => void;
}) {
  const t = useT();
  const isEdit = Boolean(member);
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState<OrgRole>(member?.role ?? "member");
  const [grants, setGrants] = useState<Record<string, AccessChoice>>(() => {
    const init: Record<string, AccessChoice> = {};
    for (const c of companies) init[c.id] = member ? accessFor(member.access, c.id) : "none";
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!isEdit && !email.trim()) { setError(t("Email requis.", "Email required.")); return; }
    setSaving(true);
    setError(null);
    const access: CompanyAccessGrant[] = Object.entries(grants)
      .filter(([, v]) => v !== "none")
      .map(([companyId, v]) => ({ companyId, mode: v as "edit" | "view" }));
    try {
      const res = await fetch("/api/team", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { userId: member!.userId, role, access } : { email: email.trim(), role, access }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "fail");
      onSaved({ added: data.added, invited: data.invited, emailSent: data.emailSent, email: email.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally {
      setSaving(false);
    }
  }

  const isAdminRole = role !== "member";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-h-[88vh] w-full max-w-lg overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-ink">
          {isEdit ? t("Accès de l'utilisateur", "User access") : t("Ajouter un utilisateur", "Add a user")}
        </h2>

        <div className="mt-4 space-y-4">
          {!isEdit && (
            <div>
              <label className="section-label">{t("Email", "Email")}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="prenom@exemple.com" className="input mt-1" />
              <p className="mt-1 text-2xs text-muted">{t("S'il a déjà un compte, il est ajouté immédiatement ; sinon, il sera invité.", "If they already have an account, added immediately; otherwise invited.")}</p>
            </div>
          )}

          <div>
            <label className="section-label">{t("Rôle", "Role")}</label>
            <div className="mt-1 flex gap-2">
              {(["member", "admin"] as OrgRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${role === r ? "border-page bg-page/15 text-ink" : "border-hair text-muted hover:text-ink"}`}
                >
                  {r === "admin" ? t("Admin (accès total)", "Admin (full access)") : t("Utilisateur", "User")}
                </button>
              ))}
            </div>
          </div>

          {!isAdminRole && (
            <div>
              <label className="section-label">{t("Accès par société", "Per-company access")}</label>
              <div className="mt-2 space-y-1.5">
                {companies.length === 0 && <p className="text-2xs text-muted">{t("Aucune société à assigner.", "No company to assign.")}</p>}
                {companies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-hair bg-white/[0.03] px-3 py-2">
                    <span className="truncate text-sm text-ink">{c.name}</span>
                    <div className="flex shrink-0 gap-1">
                      {(["none", "view", "edit"] as AccessChoice[]).map((choice) => (
                        <button
                          key={choice}
                          onClick={() => setGrants((g) => ({ ...g, [c.id]: choice }))}
                          className={`rounded-md px-2 py-1 text-[11px] font-medium ${grants[c.id] === choice
                            ? choice === "edit" ? "bg-page text-white" : choice === "view" ? "bg-primary-500/80 text-white" : "bg-white/10 text-ink"
                            : "text-muted hover:bg-white/[0.06]"}`}
                        >
                          {choice === "none" ? t("Aucun", "None") : choice === "view" ? t("Lecture", "View") : t("Édition", "Edit")}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-2xs text-danger-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">{t("Annuler", "Cancel")}</button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? t("Enregistrement…", "Saving…") : isEdit ? t("Enregistrer", "Save") : t("Ajouter", "Add")}
          </button>
        </div>
      </div>
    </div>
  );
}
