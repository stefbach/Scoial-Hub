"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthState } from "@/app/auth/actions";

export function LoginForm({ checkEmail }: { checkEmail: boolean }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    login,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {checkEmail && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Check your email to confirm your account, then sign in.
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-gray-900 px-4 py-2 font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-gray-900 underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
