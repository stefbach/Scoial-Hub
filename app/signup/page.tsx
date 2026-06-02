"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Clears any stale server error when the user edits a field. Wrapping
  // setError in a derived setter keeps things tidy.
  const editing = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    if (error) setError(null);
  };

  const mismatch = !!confirmPw && password !== confirmPw;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPw) {
      setError("Passwords don't match.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    const trimmedOrg = orgName.trim();

    setSubmitting(true);
    const supabase = createClient();

    // org_name + full_name go into auth.users.raw_user_meta_data; the
    // sh_provision_user_on_signup trigger reads them to create the
    // sh_organizations + sh_users rows server-side.
    const { error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          org_name: trimmedOrg,
        },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined,
      },
    });

    setSubmitting(false);
    if (signUpError) {
      setError(friendlyAuthError(signUpError));
      return;
    }
    router.replace(`/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`);
  };

  const disabled =
    submitting ||
    !fullName.trim() ||
    !orgName.trim() ||
    !email.trim() ||
    !password ||
    !confirmPw ||
    mismatch;

  return (
    <AuthCard
      title="Create your organization"
      subtitle="One signup creates the organization and makes you the first admin."
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <Field
          label="Full name"
          value={fullName}
          onChange={editing(setFullName)}
          required
          autoComplete="name"
        />
        <Field
          label="Organization name"
          value={orgName}
          onChange={editing(setOrgName)}
          required
          placeholder="e.g. DDS Group"
        />
        <Field
          label="Work email"
          type="email"
          value={email}
          onChange={editing(setEmail)}
          required
          autoComplete="email"
        />

        <div>
          <PasswordInput
            label="Password"
            value={password}
            onChange={editing(setPassword)}
            required
            autoComplete="new-password"
            helper="At least 8 characters."
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <PasswordInput
          label="Confirm password"
          value={confirmPw}
          onChange={editing(setConfirmPw)}
          required
          autoComplete="new-password"
          invalid={mismatch}
          helper={mismatch ? <span className="text-red-600">Passwords don&apos;t match.</span> : undefined}
        />

        {error && (
          <div
            role="alert"
            className="rounded-md border-hair border-red-200 bg-red-50 px-3 py-2 text-2xs text-red-700"
          >
            {error}
          </div>
        )}

        <Button
          variant="primary"
          className="w-full justify-center"
          disabled={disabled}
        >
          {submitting ? "Creating…" : "Create account"}
        </Button>
      </form>
      <div className="mt-4 text-center text-2xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ai-text hover:underline">
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  required,
  autoComplete,
  helper,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  helper?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-2xs font-medium text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ai-text/40"
      />
      {helper && <div className="mt-1 text-2xs text-muted">{helper}</div>}
    </div>
  );
}
