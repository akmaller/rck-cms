import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settingSections = [
  {
    title: "Informasi Umum",
    description: "Atur nama situs, tagline, logo, dan metadata utama.",
    href: "/dashboard/settings/general",
  },
  {
    title: "Menu & Navigasi",
    description: "Kelola struktur menu utama dan footer.",
    href: "/dashboard/settings/navigation",
  },
  {
    title: "Keamanan",
    description: "Aktifkan autentikasi dua faktor dan pantau audit log.",
    href: "/dashboard/settings/security",
  },
];

export default function SettingsIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan Situs</h1>
        <p className="text-sm text-muted-foreground">
          Sesuaikan konfigurasi global untuk Roemah Cita CMS.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {settingSections.map((section) => (
          <Card key={section.href} className="hover:border-primary/40">
            <CardHeader>
              <CardTitle className="text-lg">
                <Link href={section.href}>{section.title}</Link>
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={section.href} className="text-sm font-medium text-primary">
                Atur sekarang →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
