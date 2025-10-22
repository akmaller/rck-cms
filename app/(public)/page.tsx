import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";

const highlightStats = [
  { label: "Artikel Terbit", value: "128" },
  { label: "Penulis Aktif", value: "12" },
  { label: "Kategori", value: "9" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-6">
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Konten kreatif lokal
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {siteConfig.name} untuk mengelola cerita dan karya Roemah Cita.
          </h1>
          <p className="text-lg text-muted-foreground">
            Dashboard modern untuk tim redaksi, lengkap dengan manajemen artikel, media,
            dan konfigurasi situs. Editor Tiptap, dukungan multi-penulis, serta keamanan
            enterprise siap pakai.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/dashboard">Masuk Dashboard</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/contact">Hubungi Kami</Link>
            </Button>
          </div>
        </div>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Langkah Cepat</CardTitle>
            <CardDescription>
              Mulai mengelola konten dengan tiga langkah mudah berikut ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">1. Buat Artikel atau Halaman</h3>
              <p className="text-sm text-muted-foreground">
                Rancang konten menggunakan editor Tiptap, lengkap dengan media dan SEO.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">2. Atur Navigasi & Konfigurasi</h3>
              <p className="text-sm text-muted-foreground">
                Sesuaikan menu, halaman statis, dan identitas brand dalam satu tempat.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">3. Kolaborasi dengan Tim</h3>
              <p className="text-sm text-muted-foreground">
                Kelola peran ADMIN, EDITOR, atau AUTHOR dengan histori audit log.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {highlightStats.map((item) => (
          <Card key={item.label} className="bg-card/90">
            <CardContent className="space-y-2 pt-6">
              <span className="text-3xl font-bold">{item.value}</span>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Konten Terbaru</h2>
            <p className="text-sm text-muted-foreground">
              Dapatkan update terbaru dari penulis dan editor terbaik kami.
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/articles">Lihat Semua</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <CardHeader>
                <CardTitle className="text-lg">Judul Artikel {item}</CardTitle>
                <CardDescription>Kategori Pilihan · 12 Oktober 2025</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ringkasan artikel placeholder untuk menampilkan daftar konten terbaru.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
