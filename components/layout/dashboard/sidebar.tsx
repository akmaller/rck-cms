"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { dashboardNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";
import type { RoleKey } from "@/lib/auth/permissions";
import type { ResolvedSiteConfig } from "@/lib/site-config/types";
import { DashboardThemeToggle } from "./theme-toggle";

type SidebarUser = {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
};

type DashboardSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  currentRole: RoleKey;
  siteConfig: ResolvedSiteConfig;
  currentUser: SidebarUser;
};

function getInitials(name?: string | null, email?: string | null) {
  const source = name && name.trim().length > 0 ? name : email ?? "";
  if (!source) return "U";
  const words = source.trim().split(/\s+/);
  const initials = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase());
  return initials.join("") || source.charAt(0).toUpperCase();
}

export function DashboardSidebar({
  isOpen,
  onClose,
  currentRole,
  siteConfig,
  currentUser,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const mobileSidebarRef = useRef<HTMLElement | null>(null);
  const navigationItems = useMemo(
    () =>
      dashboardNavigation.filter((item) => {
        if (!item.roles || item.roles.length === 0) {
          return true;
        }
        return item.roles.includes(currentRole);
      }),
    [currentRole]
  );

  useEffect(() => {
    const sidebar = mobileSidebarRef.current;
    if (!sidebar) {
      return;
    }

    if (isOpen) {
      sidebar.removeAttribute("inert");
      return;
    }

    sidebar.setAttribute("inert", "");
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && sidebar.contains(activeElement)) {
      activeElement.blur();
    }
  }, [isOpen]);

  const renderNavigation = (onNavigate?: () => void) => (
    <div className="flex-1 overflow-hidden">
      <nav className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1 text-sm">
        {navigationItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            Tidak ada menu yang tersedia untuk peran Anda.
          </p>
        ) : null}
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="hidden h-screen w-64 flex-col border-r border-border bg-card/40 p-4 md:sticky md:top-0 md:flex">
        <div className="mb-6 flex items-center gap-3">
          {siteConfig.iconUrl ? (
            <Image
              src={siteConfig.iconUrl}
              alt={`${siteConfig.name} icon`}
              width={32}
              height={32}
              className="h-8 w-8 rounded"
            />
          ) : siteConfig.logoUrl ? (
            <Image
              src={siteConfig.logoUrl}
              alt={siteConfig.name}
              width={32}
              height={32}
              className="h-8 w-8 rounded"
            />
          ) : null}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{siteConfig.name}</span>
            {siteConfig.tagline ? (
              <span className="text-[11px] text-muted-foreground line-clamp-1">{siteConfig.tagline}</span>
            ) : null}
          </div>
        </div>
        {renderNavigation()}
        <div className="mt-auto space-y-4 border-t border-border/60 pt-4">
          <DashboardThemeToggle />
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 rounded-md border border-border/80 bg-card px-3 py-2 text-sm transition hover:border-primary/60 hover:bg-primary/5"
          >
            {currentUser.avatarUrl ? (
              <Image
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {getInitials(currentUser.name, currentUser.email)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{currentUser.name}</p>
              {currentUser.email ? (
                <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
              ) : null}
            </div>
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <aside
        id="dashboard-mobile-sidebar"
        ref={mobileSidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col overflow-hidden border-r border-border bg-card/95 p-4 shadow-lg backdrop-blur transition-transform duration-200 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Navigasi dashboard"
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {siteConfig.iconUrl ? (
              <Image
                src={siteConfig.iconUrl}
                alt={`${siteConfig.name} icon`}
                width={24}
                height={24}
                className="h-6 w-6 rounded"
              />
            ) : siteConfig.logoUrl ? (
              <Image
                src={siteConfig.logoUrl}
                alt={siteConfig.name}
                width={24}
                height={24}
                className="h-6 w-6 rounded"
              />
            ) : null}
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Navigasi
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {renderNavigation(onClose)}
        <div className="mt-auto space-y-4 border-t border-border/60 pt-4">
          <DashboardThemeToggle />
          <Link
            href="/dashboard/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-md border border-border/80 bg-card px-3 py-2 text-sm transition hover:border-primary/60 hover:bg-primary/5"
          >
            {currentUser.avatarUrl ? (
              <Image
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {getInitials(currentUser.name, currentUser.email)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{currentUser.name}</p>
              {currentUser.email ? (
                <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
              ) : null}
            </div>
          </Link>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
