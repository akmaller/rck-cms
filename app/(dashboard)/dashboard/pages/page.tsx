import Link from "next/link";

import { PageForm } from "@/components/forms/page-form";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function DashboardPages() {
  const [pages, media] = await Promise.all([
    prisma.page.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const mediaItems = media.map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    mimeType: item.mimeType,
    size: item.size,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Halaman Statis</h1>
          <p className="text-sm text-muted-foreground">
            Atur halaman konten seperti Tentang, Kontak, atau landing khusus.
          </p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/dashboard/articles">
          Kelola Artikel
        </Link>
      </div>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Halaman</CardTitle>
            <CardDescription>Halaman yang sudah dibuat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pages.map((page) => (
              <div key={page.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{page.title}</p>
                  <p className="text-xs text-muted-foreground">
                    /{page.slug} • {page.status}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(page.updatedAt).toLocaleDateString("id-ID")}</span>
                  <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={`/dashboard/pages/${page.id}/edit`}>
                    Edit
                  </Link>
                </div>
              </div>
            ))}
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada halaman statis.</p>
            ) : null}
          </CardContent>
        </Card>
        <PageForm mediaItems={mediaItems} />
      </section>
    </div>
  );
}
