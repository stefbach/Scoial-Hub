import { CompanySwitcher } from "./CompanySwitcher";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b-hair border-hair bg-card px-5 py-3">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold tracking-tight text-ink">
            Social Hub
          </span>
          <span className="text-hair">|</span>
          <CompanySwitcher />
        </div>
        <UserMenu />
      </header>
      <div className="mx-auto flex max-w-[1180px]">
        <Sidebar />
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
