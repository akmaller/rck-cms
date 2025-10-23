import Image from "next/image";
import Link from "next/link";
import { ArticleStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 9;

type ArticlesPageProps = {
  searchParams: { page?: string };
};

function buildPaginationLinks({
  current,
  total,
  basePath,
}: {
  current: number;
  total: number;
  basePath: string;
}) {
  const items: Array<{ label: string; href: string; active: boolean } | "ellipsis"> = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      items.push({ label: `${i}`, href: `${basePath}?page=${i}`, active: i === current });
    } else if (items[items.length - 1] !== "ellipsis") {
      items.push("ellipsis");
    }
  }
  return items;
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const currentPage = Math.max(1, Number(searchParams.page ?? 1));

  const where = { status: ArticleStatus.PUBLISHED } as const;

  const [articles, totalCount] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } },
        categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
        featuredMedia: { select: { url: true, title: true, width: true, height: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagination = buildPaginationLinks({ current: currentPage, total: totalPages, basePath: "/articles" });

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Artikel Terbaru</h1>
        <p className="text-muted-foreground">
          Temukan cerita terbaru dari Roemah Cita.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Card key={article.id} className="flex h-full flex-col overflow-hidden">
            {article.featuredMedia?.url ? (
              <div className="relative h-40 w-full overflow-hidden border-b border-border/60">
                <Image
                  src={article.featuredMedia.url}
                  alt={article.featuredMedia.title ?? article.title}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                />
              </div>
            ) : null}
            <CardHeader>
              <CardTitle className="line-clamp-2 text-lg">{article.title}</CardTitle>
              <CardDescription>
                Dipublikasikan {article.publishedAt?.toLocaleDateString("id-ID") ?? "-"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <p className="line-clamp-3 text-sm text-muted-foreground">{article.excerpt ?? "Belum ada ringkasan."}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{article.author?.name ?? "Anonim"}</span>
                <span>
                  {article.categories.map((item) => item.category.name).join(", ") || "Tanpa kategori"}
                </span>
              </div>
              <Button asChild size="sm" className="mt-auto">
                <Link href={`/articles/${article.slug}`}>Baca Artikel</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada artikel</CardTitle>
            <CardDescription>Konten akan segera hadir.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              Kembali ke beranda
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {totalPages > 1 ? (
        <nav className="flex items-center gap-2" aria-label="Pagination">
          <Button asChild variant="outline" size="sm" disabled={currentPage === 1}>
            <Link href={`/articles?page=${currentPage - 1}`}>Sebelumnya</Link>
          </Button>
          <div className="flex items-center gap-1">
            {pagination.map((item, index) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                  …
                </span>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className={buttonVariants({
                    variant: item.active ? "default" : "ghost",
                    size: "sm",
                  })}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>
          <Button asChild variant="outline" size="sm" disabled={currentPage === totalPages}>
            <Link href={`/articles?page=${currentPage + 1}`}>Berikutnya</Link>
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
