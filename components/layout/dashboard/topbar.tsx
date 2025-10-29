"use client";

import Link from "next/link";
import { Home, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useDashboardHeader } from "./dashboard-header-context";
import { DashboardSearch } from "./dashboard-search";
import { DashboardNotificationBell } from "./dashboard-notification-bell";

type DashboardTopbarProps = {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  siteName: string;
};

export function DashboardTopbar({ onToggleSidebar, isSidebarOpen, siteName }: DashboardTopbarProps) {
  const {
    state: { heading, description },
  } = useDashboardHeader();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleSidebar}
          aria-expanded={isSidebarOpen}
          aria-controls="dashboard-mobile-sidebar"
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <div className="flex flex-col">
          {heading ? (
            <h1 className="text-base font-semibold leading-tight text-foreground sm:text-lg">{heading}</h1>
          ) : (
            <h1 className="text-base font-semibold text-foreground sm:text-lg">{siteName}</h1>
          )}
          {description ? (
            <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2 [&>form]:ml-0">
        <DashboardNotificationBell />
        <DashboardSearch />
        <Button asChild variant="outline" size="icon">
          <Link href="/" aria-label="Ke Beranda">
            <Home className="h-4 w-4" />
            <span className="sr-only">Ke Beranda</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
