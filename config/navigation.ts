import type { RoleKey } from "@/lib/auth/permissions";

export type NavItem = {
  name: string;
  href: string;
  description?: string;
  external?: boolean;
  roles?: RoleKey[];
};

export const publicNavigation: NavItem[] = [
  { name: "Beranda", href: "/" },
  { name: "Artikel", href: "/articles" },
  { name: "Kategori", href: "/categories" },
  { name: "Album", href: "/albums" },
  { name: "Tentang", href: "/about" },
  { name: "Kontak", href: "/contact" },
];

export const dashboardNavigation: NavItem[] = [
  { name: "Dasbor", href: "/dashboard", roles: ["ADMIN", "EDITOR", "AUTHOR"] },
  { name: "Artikel", href: "/dashboard/articles", roles: ["ADMIN", "EDITOR", "AUTHOR"] },
  { name: "Kategori & Tag", href: "/dashboard/taxonomies", roles: ["ADMIN", "EDITOR"] },
  { name: "Media", href: "/dashboard/media", roles: ["ADMIN", "EDITOR", "AUTHOR"] },
  { name: "Album", href: "/dashboard/albums", roles: ["ADMIN", "EDITOR"] },
  { name: "Menu", href: "/dashboard/menus", roles: ["ADMIN", "EDITOR"] },
  { name: "Halaman", href: "/dashboard/pages", roles: ["ADMIN", "EDITOR"] },
  { name: "Pengguna", href: "/dashboard/users", roles: ["ADMIN"] },
  { name: "Log Aktivitas", href: "/dashboard/audit-log", roles: ["ADMIN"] },
  { name: "Konfigurasi", href: "/dashboard/settings/general", roles: ["ADMIN"] },
  { name: "Keamanan", href: "/dashboard/settings/security", roles: ["ADMIN"] },
];
