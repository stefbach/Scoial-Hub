"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ImageUpload, type UploadedImage } from "@/components/ui/ImageUpload";
import { SubHeader, SectionLabel } from "./shared";
import { ORG_NAME } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";

const TIMEZONES = [
  "Indian/Mauritius",
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "Africa/Dakar",
  "Asia/Dubai",
];

export function Profile() {
  const { profile, session, updateProfile, loading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tz, setTz] = useState(TIMEZONES[0]);
  const [lang, setLang] = useState<"English" | "Francais">("English");
  const [avatar, setAvatar] = useState<UploadedImage | null>(null);
  const [twoFa, setTwoFa] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Hydrate from the signed-in user's sh_users row (and fall back to the
  // session email while the profile is loading).
  useEffect(() => {
    setName(profile?.full_name ?? "");
    setEmail(profile?.email ?? session?.user?.email ?? "");
    setTz(profile?.time_zone ?? TIMEZONES[0]);
    setLang((profile?.language as "English" | "Francais") ?? "English");
    setTwoFa(!!profile?.two_factor_enabled);
    setAvatar(profile?.avatar_url ? { url: profile.avatar_url, name: "Current avatar", size: 0 } : null);
    setDirty(false);
  }, [profile, session?.user?.email]);

  const initials = (name || email || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await updateProfile({
      full_name: name.trim(),
      time_zone: tz,
      language: lang,
      two_factor_enabled: twoFa,
      // Persist the avatar URL only when the user uploaded a new file in this
      // session (the existing remote avatar already lives at profile.avatar_url).
      avatar_url: avatar?.url ?? null,
    });
    setSaving(false);
    if (error) {
      setToast(`Couldn't save: ${error}`);
      return;
    }
    setDirty(false);
    setToast("Profile saved.");
  };

  return (
    <div>
      <SubHeader title="Profile" scope="org" scopeLabel={ORG_NAME} />

      {loading && !profile && (
        <div className="mb-3 text-2xs text-muted">Loading your profile…</div>
      )}

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
          <label className="text-2xs font-medium text-muted">Full name</label>
          <input
            value={name}
            onChange={(e) => mark(setName)(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          />
        </div>
        <div>
          <label className="text-2xs font-medium text-muted">Email</label>
          <input
            value={email}
            readOnly
            className="mt-1 block w-full cursor-not-allowed rounded-md border-hair border-hair bg-canvas px-3 py-2 text-sm text-muted focus:outline-none"
          />
          <div className="mt-1 text-2xs text-muted">
            Managed by Supabase Auth. Contact support to change.
          </div>
        </div>
        <div>
          <label className="text-2xs font-medium text-muted">Time zone</label>
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
            Used for scheduling and timestamps throughout the app.
          </div>
        </div>
        <div>
          <label className="text-2xs font-medium text-muted">Language</label>
          <select
            value={lang}
            onChange={(e) => mark(setLang)(e.target.value as "English" | "Francais")}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            <option value="English">English</option>
            <option value="Francais">Français</option>
          </select>
        </div>
      </div>

      <SectionLabel>Password</SectionLabel>
      <Button variant="secondary" onClick={() => setPwOpen(true)}>Change password</Button>

      <SectionLabel>Two-factor authentication</SectionLabel>
      <div className="flex items-center justify-between rounded-md border-hair border-hair p-3">
        <div>
          <div className="text-sm font-medium text-ink">Two-factor authentication</div>
          <div className="text-2xs text-muted">Add a second step at sign-in for extra security.</div>
        </div>
        <Toggle
          key={String(twoFa)}
          defaultOn={twoFa}
          onChange={(on) => {
            if (on) {
              setTwoFaOpen(true);
              // Persisted as a preference column but no enforcement yet —
              // the modal explains the gap.
              setTwoFa(true);
              setDirty(true);
            } else {
              setTwoFa(false);
              setDirty(true);
            }
          }}
        />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {dirty && <span className="text-2xs text-amber-700">● Unsaved changes</span>}
        <Button variant="primary" disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} onDone={() => { setPwOpen(false); setToast("Password changed."); }} />}
      {twoFaOpen && (
        <Modal open onClose={() => setTwoFaOpen(false)} width="max-w-sm">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">Two-factor authentication</div>
          <div className="p-4 text-sm text-ink">
            2FA setup will be enabled when the backend is connected.
          </div>
          <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setTwoFaOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setTwoFaOpen(false)}>OK</Button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [curr, setCurr] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = !!confirm && next !== confirm;
  const canSave = !!curr && !!next && !mismatch;

  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">Change password</div>
      <div className="space-y-3 p-4">
        <Field label="Current password" value={curr} onChange={setCurr} type="password" />
        <Field label="New password" value={next} onChange={setNext} type="password" />
        <Field label="Confirm new password" value={confirm} onChange={setConfirm} type="password" />
        {mismatch && <div className="text-2xs text-red-600">Passwords don&apos;t match.</div>}
      </div>
      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSave} onClick={onDone}>Save</Button>
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
