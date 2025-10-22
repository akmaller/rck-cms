export type NavItem = {
  name: string;
  href: string;
  description?: string;
  external?: boolean;
};

export const publicNavigation: NavItem[] = [
  { name: "Beranda", href: "/" },
  { name: "Artikel", href: "/articles" },
  { name: "Kategori", href: "/categories" },
  { name: "Tentang", href: "/about" },
  { name: "Kontak", href: "/contact" },
];

export const dashboardNavigation: NavItem[] = [
  { name: "Dasbor", href: "/dashboard" },
  { name: "Artikel", href: "/dashboard/articles" },
  { name: "Kategori & Tag", href: "/dashboard/taxonomies" },
  { name: "Media", href: "/dashboard/media" },
  { name: "Menu", href: "/dashboard/menus" },
  { name: "Halaman", href: "/dashboard/pages" },
  { name: "Pengguna", href: "/dashboard/users" },
  { name: "Konfigurasi", href: "/dashboard/settings" },
];
