import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArticleForm } from "@/components/forms/article-form";

export default async function DashboardArticlesPage() {
  const [articles, media] = await Promise.all([
    prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    }),
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

  const primaryBtn =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const outlineBtn =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const ghostBtn =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Artikel</h1>
          <p className="text-sm text-muted-foreground">
            Kelola artikel, status publikasi, dan media unggulan.
          </p>
        </div>
        <Link className={primaryBtn} href="/dashboard/articles/new">
          + Artikel Baru
        </Link>
      </div>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Artikel</CardTitle>
            <CardDescription>{articles.length} artikel tersimpan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {articles.map((article) => (
              <div
                key={article.id}
                className="flex flex-col gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-foreground">{article.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{article.status}</Badge>
                    <span>{article.author?.name ?? "Anonim"}</span>
                    <span>{new Date(article.updatedAt).toLocaleDateString("id-ID")}</span>
                  </div>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{article.excerpt ?? "Belum ada ringkasan."}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {article.categories.map((item) => item.category.name).join(", ") || "Tanpa kategori"}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span>{article.tags.map((item) => `#${item.tag.name}`).join(" ")}</span>
                </div>
                <div className="flex gap-2">
                  <Link className={outlineBtn} href={`/dashboard/articles/${article.id}/edit`}>
                    Edit
                  </Link>
                  <Link className={ghostBtn} href={`/articles/${article.slug}`} target="_blank">
                    Lihat publik
                  </Link>
                </div>
              </div>
            ))}
            {articles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada artikel. Mulai dengan membuat artikel baru.</p>
            ) : null}
          </CardContent>
        </Card>
        <ArticleForm mediaItems={mediaItems} />
      </section>
    </div>
  );
}
