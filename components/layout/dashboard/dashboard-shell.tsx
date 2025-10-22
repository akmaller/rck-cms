import { ReactNode } from "react";

import { DashboardSidebar } from "./sidebar";
import { DashboardTopbar } from "./topbar";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="grid min-h-screen w-full bg-background md:grid-cols-[256px_1fr]">
      <DashboardSidebar />
      <div className="flex min-h-screen flex-col">
        <DashboardTopbar />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
