// Lightweight typed snapshot of the sh schema rows that the frontend reads or
// writes today. Expand as more screens get wired in subsequent phases. The
// supabase-js client uses these to type the row shapes returned from the
// query builder.

export interface ShUserRow {
  id: string;
  auth_user_id: string | null;
  org_id: string;
  full_name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "pending";
  avatar_url: string | null;
  time_zone: string;
  language: "English" | "Francais";
  two_factor_enabled: boolean;
  created_at: string;
}

export interface ShOrganizationRow {
  id: string;
  name: string;
  industry: "Healthcare" | "Marketing" | "Retail" | "Education" | "Other";
  logo_url: string | null;
  plan: string | null;
  trial_days_remaining: number | null;
  next_billing_date: string | null;
  payment_method: string | null;
  created_at: string;
}

// Minimal Database type for typed Supabase clients. We list only the tables
// the auth phase touches; the rest will be added when their screens are
// wired in Phase 3+.
export interface Database {
  sh: {
    Tables: {
      sh_users: {
        Row: ShUserRow;
        Insert: Partial<ShUserRow> & {
          auth_user_id?: string | null;
          org_id: string;
          email: string;
        };
        Update: Partial<ShUserRow>;
      };
      sh_organizations: {
        Row: ShOrganizationRow;
        Insert: Partial<ShOrganizationRow> & { name: string };
        Update: Partial<ShOrganizationRow>;
      };
    };
  };
}
