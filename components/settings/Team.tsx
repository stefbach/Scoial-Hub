"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toast } from "@/components/ui/Toast";
import { SubHeader } from "./shared";
import { TEAM, type TeamMember } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import type { Company } from "@/lib/types";
import { useT } from "@/lib/i18n";

type Role = "admin" | "editor" | "viewer";

export function Team() {
  const t = useT();
  // UAT #14/#16 — sociétés RÉELLES de l'utilisateur pour la matrice d'accès.
  const { companies } = useCompany();

  const ROLE_LABEL: Record<Role, string> = {
    admin: t("Admin", "Admin"),
    editor: t("Éditeur", "Editor"),
    viewer: t("Lecteur", "Viewer"),
  };

  const [team, setTeam] = useState<TeamMember[]>(TEAM);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const allCompanyIds = useMemo(() => companies.map((c) => c.id), [companies]);

  const addMember = (m: TeamMember) => {
    setTeam((prev) => [...prev, m]);
    TEAM.push(m);
  };

  const updateMember = (id: string, patch: Partial<TeamMember>) => {
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const idx = TEAM.findIndex((m) => m.id === id);
    if (idx >= 0) TEAM[idx] = { ...TEAM[idx], ...patch };
  };

  const removeMember = (id: string) => {
    setTeam((prev) => prev.filter((m) => m.id !== id));
    const idx = TEAM.findIndex((m) => m.id === id);
    if (idx >= 0) TEAM.splice(idx, 1);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <SubHeader title={t("Équipe & rôles", "Team & roles")} scope="org" scopeLabel={t("Votre organisation", "Your organization")} />
        </div>
        <Button variant="primary" className="shrink-0" onClick={() => setInviteOpen(true)}>{t("+ Inviter un membre", "+ Invite team member")}</Button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full min-w-0 text-sm">
          <tbody className="divide-y divide-hair">
            {team.map((m) => (
              <tr
                key={m.id}
                onClick={() => setEditing(m)}
                className="cursor-pointer transition-colors hover:bg-canvas"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-page text-2xs font-semibold text-white">
                      {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </span>
                    <span className="font-medium text-ink">{m.name}</span>
                  </div>
                </td>
                <td className="hidden px-3 py-2.5 text-muted sm:table-cell">
                  <span className="block max-w-[12rem] truncate">{m.email}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {m.status === "pending" && <StatusBadge tone="amber">{t("En attente", "Pending")}</StatusBadge>}
                    <StatusBadge tone={m.role === "admin" ? "blue" : "gray"}>{ROLE_LABEL[m.role as Role] ?? m.role}</StatusBadge>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <TeamMemberModal
          mode="invite"
          companies={companies}
          allCompanyIds={allCompanyIds}
          onClose={() => setInviteOpen(false)}
          onSubmit={async (payload) => {
            // UAT #16 — on appelle la VRAIE route d'invitation et on n'affirme
            // « e-mail envoyé » QUE si le serveur l'a réellement envoyé.
            const mode: "edit" | "view" = payload.role === "viewer" ? "view" : "edit";
            const access = payload.companyAccess.map((companyId) => ({ companyId, mode }));
            try {
              const res = await fetch("/api/team", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: payload.email, role: payload.role, access }),
              });
              const body = (await res.json().catch(() => ({}))) as {
                added?: boolean; invited?: boolean; emailSent?: boolean; error?: string;
              };

              if (!res.ok) {
                if (res.status === 401) {
                  setToast(t("Connectez-vous pour inviter des membres.", "Sign in to invite members."));
                } else if (res.status === 403) {
                  setToast(t("Seul un administrateur du compte peut inviter des membres.", "Only an account admin can invite members."));
                } else {
                  setToast(body.error || t("Invitation impossible.", "Couldn't send invite."));
                }
                return;
              }

              // Reflète l'ajout dans la liste (membre déjà connu → actif ; sinon en attente).
              addMember({
                id: `u-${Date.now()}`,
                name: payload.email.split("@")[0],
                email: payload.email,
                role: payload.role,
                status: body.added ? "active" : "pending",
                companyAccess: payload.companyAccess,
              });
              setInviteOpen(false);

              if (body.added) {
                setToast(t(
                  `${payload.email} a été ajouté à l'équipe (compte déjà existant).`,
                  `${payload.email} was added to the team (existing account).`,
                ));
              } else if (body.emailSent) {
                setToast(t(
                  `Invitation envoyée par e-mail à ${payload.email}.`,
                  `Invitation emailed to ${payload.email}.`,
                ));
              } else {
                // HONNÊTETÉ : invitation enregistrée mais AUCUN e-mail envoyé
                // (livraison e-mail non configurée). L'accès s'appliquera à la
                // première connexion de la personne avec cette adresse.
                setToast(t(
                  `Invitation créée pour ${payload.email}, mais l'envoi d'e-mail n'est pas configuré. L'accès s'activera à sa première connexion avec cet e-mail.`,
                  `Invitation created for ${payload.email}, but email delivery isn't configured. Access applies on their first sign-in with this email.`,
                ));
              }
            } catch {
              setToast(t("Invitation impossible : serveur injoignable.", "Couldn't invite: server unreachable."));
            }
          }}
        />
      )}

      {editing && (
        <TeamMemberModal
          mode="edit"
          companies={companies}
          allCompanyIds={allCompanyIds}
          member={editing}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => {
            updateMember(editing.id, { role: payload.role, companyAccess: payload.companyAccess });
            setEditing(null);
            setToast(t(`Modifications enregistrées pour ${editing.name}.`, `Saved changes to ${editing.name}.`));
          }}
          onRemove={() => {
            removeMember(editing.id);
            setEditing(null);
            setToast(t(`${editing.name} retiré de l'équipe.`, `${editing.name} removed from the team.`));
          }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function TeamMemberModal({
  mode,
  member,
  companies,
  allCompanyIds,
  onClose,
  onSubmit,
  onRemove,
}: {
  mode: "invite" | "edit";
  member?: TeamMember;
  companies: Company[];
  allCompanyIds: string[];
  onClose: () => void;
  onSubmit: (payload: { email: string; role: Role; companyAccess: string[] }) => void | Promise<void>;
  onRemove?: () => void;
}) {
  const t = useT();

  const ROLE_HELP: Record<Role, string> = {
    admin: t("Accès complet incluant facturation et gestion d'équipe", "Full access including billing and team management"),
    editor: t("Peut créer, modifier, planifier des publications et campagnes. Ne peut pas modifier la facturation ni inviter des utilisateurs.", "Can create, edit, schedule posts and campaigns. Cannot change billing or invite users."),
    viewer: t("Accès en lecture seule à toutes les données", "Read-only access to all data"),
  };

  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState<Role>((member?.role as Role) ?? "editor");
  const [access, setAccess] = useState<string[]>(member?.companyAccess ?? allCompanyIds);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const editing = mode === "edit";
  const canSubmit = editing
    ? access.length > 0
    : email.includes("@") && access.length > 0;

  const toggleAccess = (id: string) =>
    setAccess((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="border-b border-hair px-4 py-3 text-sm font-semibold text-ink">
        {editing ? `${t("Modifier", "Edit")} ${member?.name}` : t("Inviter un membre de l'équipe", "Invite team member")}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <label className="text-2xs font-medium text-muted">{t("Email", "Email")}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={editing}
            className={`mt-1 w-full rounded-md border border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none ${
              editing ? "cursor-not-allowed opacity-70" : ""
            }`}
          />
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Rôle", "Role")}</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 block w-full rounded-md border border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            <option value="admin">{t("Admin", "Admin")}</option>
            <option value="editor">{t("Éditeur", "Editor")}</option>
            <option value="viewer">{t("Lecteur", "Viewer")}</option>
          </select>
          <div className="mt-1 text-2xs text-muted">{ROLE_HELP[role]}</div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Accès aux entreprises", "Company access")}</label>
          <div className="mt-1 flex flex-wrap gap-3 rounded-md border border-hair bg-canvas/40 p-3">
            {companies.length === 0 ? (
              <span className="text-2xs text-muted">{t("Aucune entreprise à partager pour le moment.", "No companies to share yet.")}</span>
            ) : (
              companies.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={access.includes(c.id)}
                    onChange={() => toggleAccess(c.id)}
                  />
                  {c.name}
                </label>
              ))
            )}
          </div>
          <div className="mt-1 text-2xs text-muted">
            {t("Multi-tenant : cet utilisateur ne verra que les données des entreprises sélectionnées.", "Multi-tenant: this user will only see data for the companies you select.")}
          </div>
        </div>

        {editing && onRemove && (
          <div className="mt-2 rounded-md border-hair border-red-200 bg-red-50/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-2xs text-red-700">{t("Retirer cette personne de l'équipe.", "Remove this person from the team.")}</div>
              <Button variant="danger" className="shrink-0" onClick={() => setConfirmRemove(true)}>{t("Retirer de l'équipe", "Remove from team")}</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button
          variant="primary"
          disabled={!canSubmit}
          onClick={() => onSubmit({ email, role, companyAccess: access })}
        >
          {editing ? t("Enregistrer", "Save changes") : t("Envoyer l'invitation", "Send invite")}
        </Button>
      </div>

      {confirmRemove && member && onRemove && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20 p-6">
          <div className="w-full max-w-xs rounded-lg border border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">{t(`Retirer ${member.name} de l'équipe ?`, `Remove ${member.name} from the team?`)}</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmRemove(false)}>{t("Annuler", "Cancel")}</Button>
              <Button variant="danger" onClick={onRemove}>{t("Retirer", "Remove")}</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
