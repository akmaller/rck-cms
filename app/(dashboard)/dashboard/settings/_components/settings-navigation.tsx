"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard/settings/general", label: "Umum" },
  { href: "/dashboard/settings/content", label: "Konten" },
  { href: "/dashboard/settings/configuration", label: "Konfigurasi" },
  { href: "/dashboard/settings/moderation", label: "Moderasi" },
  { href: "/dashboard/settings/wordpress-import", label: "Import WordPress" },
  { href: "/dashboard/settings/performance", label: "Performa" },
  { href: "/dashboard/settings/maintenance", label: "Pemeliharaan" },
  { href: "/dashboard/settings/security", label: "Keamanan" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard/settings/security") {
    return pathname.startsWith(href);
  }
  return pathname === href;
}

export function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto">
      <div className="flex w-full items-center gap-2 border-b border-border/60 pb-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({ variant: active ? "default" : "ghost", size: "sm" }),
                "rounded-full"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
