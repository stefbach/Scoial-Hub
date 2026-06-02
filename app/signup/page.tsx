"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();

    // org_name + full_name go into auth.users.raw_user_meta_data; the
    // sh_provision_user_on_signup trigger reads them to create the
    // sh_organizations + sh_users rows server-side.
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          org_name: orgName.trim(),
        },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined,
      },
    });

    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    router.replace(`/auth/check-email?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <AuthCard
      title="Create your organization"
      subtitle="One signup creates the organization and makes you the first admin."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Full name" value={fullName} onChange={setFullName} required autoComplete="name" />
        <Field label="Organization name" value={orgName} onChange={setOrgName} required placeholder="e.g. DDS Group" />
        <Field label="Work email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} required autoComplete="new-password" helper="At least 8 characters." />
        {error && (
          <div className="rounded-md border-hair border-red-200 bg-red-50 px-3 py-2 text-2xs text-red-700">
            {error}
          </div>
        )}
        <Button
          variant="primary"
          className="w-full justify-center"
          disabled={submitting || !fullName || !orgName || !email || !password}
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
