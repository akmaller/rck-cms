"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { dashboardNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 flex-col border-r border-border bg-card/40 p-4 md:flex">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Navigasi
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 text-sm">
        {dashboardNavigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 border-t border-border/60 pt-4">
        <SignOutButton />
      </div>
    </aside>
  );
}
