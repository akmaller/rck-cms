import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig as defaultSiteConfig } from "@/config/site";
import { getSiteConfig } from "@/lib/site-config/server";

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "RC"
  );
}

export default async function NotFound() {
  let site;
  try {
    site = await getSiteConfig();
  } catch {
    site = defaultSiteConfig;
  }

  const description =
    site.metadata?.description ?? site.description ?? "Halaman yang Anda cari tidak tersedia.";
  const tagline = site.tagline ?? description;
  const logoUrl = site.logoUrl ?? null;

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-background/95">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_45%)] dark:bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.08),transparent_55%)]"
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card/80 shadow-sm">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={site.name}
                width={72}
                height={72}
                className="h-16 w-16 rounded-full object-contain"
                priority
              />
            ) : (
              <span className="text-2xl font-semibold text-primary">{getInitials(site.name)}</span>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{site.name}</h1>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {tagline}
            </p>
          </div>
        </div>

        <div className="relative mb-10 flex w-full flex-col items-center gap-4 rounded-3xl border border-border/60 bg-card/70 px-6 py-10 shadow-lg shadow-black/5 backdrop-blur-sm sm:px-10">
          <span className="rounded-full border border-border bg-background px-4 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            404 — Not Found
          </span>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Halaman tidak ditemukan
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Mohon maaf, halaman yang Anda cari tidak tersedia atau mungkin telah dipindahkan. Gunakan
            tombol di bawah ini untuk kembali atau jelajahi konten lainnya.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Beranda
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/search">
                <Search className="mr-2 h-4 w-4" />
                Cari Artikel
              </Link>
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {site.name}. Semua hak dilindungi undang-undang.
        </div>
      </main>
    </div>
  );
}
