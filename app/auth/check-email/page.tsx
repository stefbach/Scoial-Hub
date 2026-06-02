"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const params = useSearchParams();
  const email = params.get("email") ?? "your inbox";

  return (
    <AuthCard
      title="Check your email"
      subtitle={`We sent a confirmation link to ${email}. Click it to finish creating your organization.`}
    >
      <div className="space-y-3 text-2xs text-muted">
        <p>
          The link opens Social Hub and signs you in automatically. You can close this tab.
        </p>
        <p>
          Didn&apos;t get the email? Check your spam folder, or{" "}
          <Link href="/signup" className="text-ai-text hover:underline">
            try again with a different address
          </Link>
          .
        </p>
        <p>
          Already confirmed?{" "}
          <Link href="/login" className="text-ai-text hover:underline">
            Sign in
          </Link>
          .
        </p>
      </div>
    </AuthCard>
  );
}
