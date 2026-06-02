"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ImageUpload, type UploadedImage } from "@/components/ui/ImageUpload";
import { SubHeader, SectionLabel } from "./shared";
import { ORG_NAME } from "@/lib/mock-data";

const TIMEZONES = [
  "Indian/Mauritius (UTC+4)",
  "Europe/Paris (UTC+1)",
  "Europe/London (UTC+0)",
  "America/New_York (UTC-5)",
  "Africa/Dakar (UTC+0)",
  "Asia/Dubai (UTC+4)",
];

export function Profile() {
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
    setToast("Profile saved.");
  };

  return (
    <div>
      <SubHeader title="Profile" scope="org" scopeLabel={ORG_NAME} />

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
            onChange={(e) => mark(setEmail)(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          />
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
            onChange={(e) => mark(setLang)(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            <option>English</option>
            <option>Français</option>
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
            if (on) setTwoFaOpen(true);
            else setTwoFa(false);
          }}
        />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {dirty && <span className="text-2xs text-amber-700">● Unsaved changes</span>}
        <Button variant="primary" disabled={!dirty} onClick={save}>Save changes</Button>
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
