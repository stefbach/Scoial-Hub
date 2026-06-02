import Link from "next/link";
import type { AuthError } from "@supabase/supabase-js";

// Map raw Supabase auth errors to friendlier copy. Anything we don't recognise
// falls back to the original message. Returns React content so we can include
// a "sign in" link for duplicate-email cases.
export function friendlyAuthError(error: AuthError | { message: string; code?: string; status?: number } | null): React.ReactNode {
  if (!error) return null;
  const message = (error as { message?: string }).message ?? "";
  const code = (error as { code?: string }).code ?? "";
  const status = (error as { status?: number }).status ?? 0;
  const lower = `${code} ${message}`.toLowerCase();

  if (lower.includes("user already registered") || lower.includes("already_registered") || lower.includes("user_already_exists")) {
    return (
      <>
        An account with this email already exists.{" "}
        <Link href="/login" className="font-medium underline">Sign in instead</Link>
        .
      </>
    );
  }

  if (lower.includes("rate") && (lower.includes("limit") || lower.includes("exceeded") || status === 429)) {
    return "Too many attempts — please wait a minute and try again.";
  }

  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return "Email or password isn't right. Try again, or reset your password.";
  }

  if (lower.includes("email") && lower.includes("not confirmed")) {
    return "Please confirm your email first — check your inbox for the link we sent.";
  }

  if (lower.includes("email address") && lower.includes("invalid")) {
    return "That email address doesn't look valid. Check for typos.";
  }

  if (lower.includes("password") && lower.includes("should be at least")) {
    return "Password is too short — please use at least 8 characters.";
  }

  if (lower.includes("weak_password") || (lower.includes("password") && lower.includes("weak"))) {
    return "That password is too easy to guess. Try a longer one with mixed characters.";
  }

  return message || "Something went wrong. Please try again.";
}
