import Link from "next/link";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";

const quickActions = [
  {
    title: "Tulis Artikel Baru",
    description: "Gunakan editor Tiptap untuk merancang dan menjadwalkan publikasi.",
    action: "Buat Artikel",
    href: "/dashboard/articles/new",
  },
  {
    title: "Kelola Media",
    description: "Unggah gambar, video, atau dokumen pendukung konten.",
    action: "Buka Media",
    href: "/dashboard/media",
  },
  {
    title: "Pengaturan Situs",
    description: "Atur identitas brand, menu, dan konfigurasi SEO.",
    action: "Buka Pengaturan",
    href: "/dashboard/settings",
  },
];

export default async function DashboardHomePage() {
  const session = await auth();
  const displayName = session?.user?.name ?? "Admin";

  return (
    <div className="space-y-6">
      <DashboardHeading
        heading={`Selamat datang, ${displayName}`}
        description="Pantau aktivitas terbaru dan kelola konten dari satu tempat."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {quickActions.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={item.href}>{item.action}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Terbaru</CardTitle>
          <CardDescription>Audit log sederhana sebelum integrasi backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>[12.45] Admin mempublikasikan artikel &quot;Festival Budaya 2025&quot;</p>
          <p>[11.32] Editor mengubah menu navigasi utama</p>
          <p>[10.15] Penulis menambahkan draft artikel baru</p>
        </CardContent>
      </Card>
    </div>
  );
}
