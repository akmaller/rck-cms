import Link from "next/link";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardHeading } from "@/components/layout/dashboard/dashboard-heading";
import { ArticleListActions } from "@/app/(dashboard)/dashboard/articles/_components/article-list-actions";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type DashboardArticlesPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
};

export default async function DashboardArticlesPage({ searchParams }: DashboardArticlesPageProps) {
  const resolvedParams = await searchParams;
  const rawPage = Number(resolvedParams.page ?? "1");
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const query = (resolvedParams.q ?? "").trim();

  const where: Prisma.ArticleWhereInput | undefined = query
    ? {
        OR: [
          { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
          {
            categories: {
              some: {
                category: { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
              },
            },
          },
          {
            tags: {
              some: {
                tag: { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
              },
            },
          },
          {
            author: {
              OR: [
                { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
              ],
            },
          },
        ],
      }
    : undefined;

  const totalArticles = await prisma.article.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalArticles / PAGE_SIZE));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  const articles = await prisma.article.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      author: { select: { id: true, name: true, email: true } },
      categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
      tags: { include: { tag: true } },
    },
  });

  const startItem = totalArticles === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = totalArticles === 0 ? 0 : startItem + articles.length - 1;

  const buildPageLink = (pageNumber: number) => {
    const params = new URLSearchParams();
    const targetPage = Math.min(Math.max(pageNumber, 1), totalPages);
    if (query) params.set("q", query);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/dashboard/articles${qs ? `?${qs}` : ""}`;
  };

  const primaryBtn =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const paginationButtonClass = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="space-y-8">
      <DashboardHeading
        heading="Artikel"
        description="Kelola artikel, status publikasi, dan media unggulan."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          method="get"
          action="/dashboard/articles"
          className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
        >
          <Input
            name="q"
            defaultValue={query}
            placeholder="Cari judul, kategori, tag, atau penulis..."
            className="sm:max-w-sm"
          />
          <div className="flex items-center gap-2">
            {query ? (
              <Link
                href="/dashboard/articles"
                className={cn(paginationButtonClass, "whitespace-nowrap")}
              >
                Reset
              </Link>
            ) : null}
            <button type="submit" className={buttonVariants({ size: "sm" })}>
              Cari
            </button>
          </div>
        </form>
        <Link className={primaryBtn} href="/dashboard/articles/new">
          + Artikel Baru
        </Link>
      </div>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Artikel</CardTitle>
            <CardDescription>
              {totalArticles === 0
                ? "Belum ada artikel."
                : `Menampilkan ${startItem}-${endItem} dari ${totalArticles} artikel.`}
              {query ? ` Pencarian: “${query}”.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {articles.map((article) => {
              const categoryBadges = article.categories
                .map((entry) => entry.category?.name)
                .filter(Boolean) as string[];
              return (
                <div
                  key={article.id}
                  className="flex items-start gap-3 rounded-md border border-border/60 bg-card px-3 py-2 text-sm transition hover:border-primary/60 hover:bg-primary/5"
                >
                  <Link
                    href={`/dashboard/articles/${article.id}/edit`}
                    className="flex flex-1 flex-col gap-2"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-foreground">{article.title}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{article.status}</Badge>
                        <span>{article.author?.name ?? "Anonim"}</span>
                        <span>
                          {article.publishedAt
                            ? new Date(article.publishedAt).toLocaleDateString("id-ID")
                            : "-"}
                        </span>
                        {categoryBadges.length ? (
                          <span className="flex items-center gap-1">
                            <span className="text-muted-foreground/80">•</span>
                            {categoryBadges.join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                  <ArticleListActions articleId={article.id} showDeleteOnly />
                </div>
              );
            })}
            {articles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {query
                  ? "Tidak ada artikel yang cocok dengan pencarian Anda."
                  : "Belum ada artikel. Mulai dengan membuat artikel baru."}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {totalArticles > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Halaman {safePage} dari {totalPages}. Menampilkan {startItem}-{endItem}.
          </p>
          <div className="flex items-center gap-2">
            {safePage > 1 ? (
              <Link className={paginationButtonClass} href={buildPageLink(safePage - 1)}>
                Sebelumnya
              </Link>
            ) : (
              <span className={cn(paginationButtonClass, "pointer-events-none opacity-50")}>
                Sebelumnya
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Halaman {safePage} / {totalPages}
            </span>
            {safePage < totalPages ? (
              <Link className={paginationButtonClass} href={buildPageLink(safePage + 1)}>
                Berikutnya
              </Link>
            ) : (
              <span className={cn(paginationButtonClass, "pointer-events-none opacity-50")}>
                Berikutnya
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
