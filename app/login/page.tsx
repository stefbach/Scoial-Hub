"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/auth/AuthCard";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace(next.startsWith("/") ? next : "/");
    router.refresh();
  };

  return (
    <AuthCard
      title="Sign in to Social Hub"
      subtitle="Welcome back. Enter your email and password to continue."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />
        {error && (
          <div className="rounded-md border-hair border-red-200 bg-red-50 px-3 py-2 text-2xs text-red-700">
            {error}
          </div>
        )}
        <Button
          variant="primary"
          className="w-full justify-center"
          disabled={submitting || !email || !password}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-4 text-center text-2xs text-muted">
        New here?{" "}
        <Link href="/signup" className="text-ai-text hover:underline">
          Create an organization
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
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  helper?: string;
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
        className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ai-text/40"
      />
      {helper && <div className="mt-1 text-2xs text-muted">{helper}</div>}
    </div>
  );
}
