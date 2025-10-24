"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { RoleKey } from "@/lib/auth/permissions";

import { DashboardHeaderProvider } from "./dashboard-header-context";
import { DashboardSidebar } from "./sidebar";
import { DashboardTopbar } from "./topbar";
import { DashboardNotifications } from "./dashboard-notifications";
import type { ResolvedSiteConfig } from "@/lib/site-config/types";
import { DashboardThemeProvider, type ThemePreference } from "./dashboard-theme-context";

type DashboardShellProps = {
  children: ReactNode;
  currentRole: RoleKey;
  siteConfig: ResolvedSiteConfig;
  initialTheme: ThemePreference;
  currentUser: {
    id: string;
    name: string;
    email?: string | null;
    avatarUrl?: string | null;
  };
};

export function DashboardShell({
  children,
  currentRole,
  siteConfig,
  initialTheme,
  currentUser,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseSidebar();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen, handleCloseSidebar]);

  return (
    <DashboardThemeProvider initialTheme={initialTheme}>
      <DashboardHeaderProvider>
        {isSidebarOpen ? (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity md:hidden"
            onClick={handleCloseSidebar}
            aria-hidden="true"
          />
        ) : null}
        <div className="grid min-h-screen w-full bg-background md:grid-cols-[256px_1fr]">
          <DashboardSidebar
            isOpen={isSidebarOpen}
            onClose={handleCloseSidebar}
            currentRole={currentRole}
            siteConfig={siteConfig}
            currentUser={currentUser}
          />
          <div className="flex min-h-screen flex-col">
            <DashboardTopbar
              onToggleSidebar={handleToggleSidebar}
              isSidebarOpen={isSidebarOpen}
              siteName={siteConfig.name}
            />
            <main className="flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">{children}</div>
            </main>
          </div>
        </div>
        <DashboardNotifications />
      </DashboardHeaderProvider>
    </DashboardThemeProvider>
  );
}
