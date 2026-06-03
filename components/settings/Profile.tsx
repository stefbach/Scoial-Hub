"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ImageUpload, type UploadedImage } from "@/components/ui/ImageUpload";
import { SubHeader, SectionLabel } from "./shared";
import { ORG_NAME } from "@/lib/mock-data";
import { useT } from "@/lib/i18n";

const TIMEZONES = [
  "Indian/Mauritius (UTC+4)",
  "Europe/Paris (UTC+1)",
  "Europe/London (UTC+0)",
  "America/New_York (UTC-5)",
  "Africa/Dakar (UTC+0)",
  "Asia/Dubai (UTC+4)",
];

export function Profile() {
  const t = useT();
  const [name, setName] = useState("Younes O.");
  const [email, setEmail] = useState("younes@ddsgroup.mu");
  const [tz, setTz] = useState(TIMEZONES[0]);
  const [lang, setLang] = useState("English");
  const [avatar, setAvatar] = useState<UploadedImage | null>(null);
  const [twoFa, setTwoFa] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const save = () => {
    setDirty(false);
    setToast(t("Profil enregistré.", "Profile saved."));
  };

  return (
    <div>
      <SubHeader title={t("Profil", "Profile")} scope="org" scopeLabel={ORG_NAME} />

      {/* Avatar */}
      <div className="mb-5">
        <ImageUpload
          value={avatar}
          onChange={(img) => { setAvatar(img); setDirty(true); }}
          variant="avatar"
          fallback={initials}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-medium text-muted">{t("Nom complet", "Full name")}</label>
          <input
            value={name}
            onChange={(e) => mark(setName)(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          />
        </div>
        <div>
          <label className="text-2xs font-medium text-muted">{t("Email", "Email")}</label>
          <input
            value={email}
            onChange={(e) => mark(setEmail)(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          />
        </div>
        <div>
          <label className="text-2xs font-medium text-muted">{t("Fuseau horaire", "Time zone")}</label>
          <select
            value={tz}
            onChange={(e) => mark(setTz)(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {TIMEZONES.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
          <div className="mt-1 text-2xs text-muted">
            {t("Utilisé pour la planification et les horodatages dans l'application.", "Used for scheduling and timestamps throughout the app.")}
          </div>
        </div>
        <div>
          <label className="text-2xs font-medium text-muted">{t("Langue", "Language")}</label>
          <select
            value={lang}
            onChange={(e) => mark(setLang)(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            <option>English</option>
            <option>Français</option>
          </select>
        </div>
      </div>

      <SectionLabel>{t("Mot de passe", "Password")}</SectionLabel>
      <Button variant="secondary" onClick={() => setPwOpen(true)}>{t("Changer le mot de passe", "Change password")}</Button>

      <SectionLabel>{t("Authentification à deux facteurs", "Two-factor authentication")}</SectionLabel>
      <div className="flex items-center justify-between rounded-md border-hair border-hair p-3">
        <div>
          <div className="text-sm font-medium text-ink">{t("Authentification à deux facteurs", "Two-factor authentication")}</div>
          <div className="text-2xs text-muted">{t("Ajoutez une deuxième étape à la connexion pour plus de sécurité.", "Add a second step at sign-in for extra security.")}</div>
        </div>
        <Toggle
          key={String(twoFa)}
          defaultOn={twoFa}
          onChange={(on) => {
            if (on) setTwoFaOpen(true);
            else setTwoFa(false);
          }}
        />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {dirty && <span className="text-2xs text-amber-700">● {t("Modifications non enregistrées", "Unsaved changes")}</span>}
        <Button variant="primary" disabled={!dirty} onClick={save}>{t("Enregistrer", "Save changes")}</Button>
      </div>

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} onDone={() => { setPwOpen(false); setToast(t("Mot de passe modifié.", "Password changed.")); }} />}
      {twoFaOpen && (
        <Modal open onClose={() => setTwoFaOpen(false)} width="max-w-sm">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">{t("Authentification à deux facteurs", "Two-factor authentication")}</div>
          <div className="p-4 text-sm text-ink">
            {t("La configuration 2FA sera activée une fois le backend connecté.", "2FA setup will be enabled when the backend is connected.")}
          </div>
          <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setTwoFaOpen(false)}>{t("Annuler", "Cancel")}</Button>
            <Button variant="primary" onClick={() => setTwoFaOpen(false)}>OK</Button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [curr, setCurr] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = !!confirm && next !== confirm;
  const canSave = !!curr && !!next && !mismatch;

  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">{t("Changer le mot de passe", "Change password")}</div>
      <div className="space-y-3 p-4">
        <Field label={t("Mot de passe actuel", "Current password")} value={curr} onChange={setCurr} type="password" />
        <Field label={t("Nouveau mot de passe", "New password")} value={next} onChange={setNext} type="password" />
        <Field label={t("Confirmer le nouveau mot de passe", "Confirm new password")} value={confirm} onChange={setConfirm} type="password" />
        {mismatch && <div className="text-2xs text-red-600">{t("Les mots de passe ne correspondent pas.", "Passwords don't match.")}</div>}
      </div>
      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button variant="primary" disabled={!canSave} onClick={onDone}>{t("Enregistrer", "Save")}</Button>
      </div>
    </Modal>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-2xs font-medium text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
      />
    </div>
  );
}
