import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { CompanyProvider } from "@/lib/company-context";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Social Hub",
  description: "Social media management platform",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body>
        <AuthProvider initialSession={session}>
          {session ? (
            <CompanyProvider>
              <AppShell>{children}</AppShell>
            </CompanyProvider>
          ) : (
            children
          )}
        </AuthProvider>
      </body>
    </html>
  );
}
