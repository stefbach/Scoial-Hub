import type { Metadata } from "next";
import "./globals.css";
import { CompanyProvider } from "@/lib/company-context";
import { ScopeProvider } from "@/lib/scope";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Social Hub",
  description: "Social media management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CompanyProvider>
          <ScopeProvider>
            <AppShell>{children}</AppShell>
          </ScopeProvider>
        </CompanyProvider>
      </body>
    </html>
  );
}
