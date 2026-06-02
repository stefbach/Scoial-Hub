"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ShUserRow } from "@/lib/supabase/types";

interface AuthContextValue {
  session: Session | null;
  // The sh_users row for the signed-in auth user. Null while loading, or
  // when the provisioning trigger hasn't created it yet.
  profile: ShUserRow | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<ShUserRow>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialSession,
  children,
}: {
  initialSession: Session | null;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [profile, setProfile] = useState<ShUserRow | null>(null);
  const [loading, setLoading] = useState<boolean>(!!initialSession);

  const fetchProfile = useCallback(
    async (authUserId: string) => {
      const { data, error } = await supabase
        .from("sh_users")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      const row = (data as unknown as ShUserRow | null) ?? null;
      if (!error) setProfile(row);
      return row;
    },
    [supabase]
  );

  // Hydrate the profile whenever the session changes.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      await fetchProfile(session.user.id);
      if (!cancelled) setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [session, fetchProfile]);

  // Keep client state in sync with Supabase's auth events.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refreshProfile: async () => {
        if (session?.user) await fetchProfile(session.user.id);
      },
      updateProfile: async (patch) => {
        if (!profile) return { error: "Not signed in" };
        const { data, error } = await supabase
          .from("sh_users")
          .update(patch as unknown as Record<string, unknown>)
          .eq("id", profile.id)
          .select()
          .single();
        if (error) return { error: error.message };
        setProfile(data as unknown as ShUserRow);
        return { error: null };
      },
    }),
    [session, profile, loading, supabase, fetchProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Render initials from a full name, falling back to the email's local part.
export function initialsFor(profile: ShUserRow | null, email?: string | null): string {
  const source = profile?.full_name?.trim() || email || "";
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return source.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
