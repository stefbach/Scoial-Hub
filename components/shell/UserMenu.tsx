"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { initialsFor, useAuth } from "@/lib/auth-context";

export function UserMenu() {
  const router = useRouter();
  const { profile, session, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const initials = initialsFor(profile, session?.user?.email);
  const displayName = profile?.full_name?.trim() || session?.user?.email || "Account";
  const email = profile?.email || session?.user?.email || "";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-page text-2xs font-semibold text-white hover:opacity-90"
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-md border-hair border-hair bg-card shadow-lg">
          <div className="border-b-hair border-hair px-3 py-2">
            <div className="truncate text-sm font-medium text-ink">{displayName}</div>
            {email && <div className="truncate text-2xs text-muted">{email}</div>}
          </div>
          <Link
            href="/settings?section=profile"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-ink hover:bg-canvas"
          >
            Profile &amp; settings
          </Link>
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.replace("/login");
              router.refresh();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
