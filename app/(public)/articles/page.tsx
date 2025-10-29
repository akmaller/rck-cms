import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArticleStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";
import { ArticleListCard } from "@/app/(public)/(components)/article-list-card";
import { ArticleSidebar } from "@/app/(public)/(components)/article-sidebar";
import { getArticleSidebarData } from "@/lib/articles/sidebar";

const PAGE_SIZE = 9;

type ArticlesPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const currentPage = Math.max(1, Number(resolved?.page ?? 1));
  const config = await getSiteConfig();
  const baseTitle = "Artikel Terbaru";
  const title = currentPage > 1 ? `${baseTitle} — Halaman ${currentPage}` : baseTitle;
  const description =
    currentPage > 1
      ? `Daftar artikel terbaru ${config.name} pada halaman ${currentPage}.`
      : `Rangkuman artikel terbaru dan pilihan redaksi dari ${config.name}.`;
  const path = currentPage > 1 ? `/articles?page=${currentPage}` : "/articles";

  return createMetadata({
    config,
    title,
    description,
    path,
  });
}

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
  const resolved = await searchParams;
  const currentPage = Math.max(1, Number(resolved.page ?? 1));

  const where = { status: ArticleStatus.PUBLISHED } as const;

  const [articles, totalCount, sidebarData] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
        featuredMedia: { select: { url: true, title: true, width: true, height: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where }),
    getArticleSidebarData(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagination = buildPaginationLinks({ current: currentPage, total: totalPages, basePath: "/articles" });

  const queryParams = new URLSearchParams();
  if (resolved.page && resolved.page !== "1") {
    queryParams.set("page", resolved.page);
  }
  const pathWithQuery = queryParams.toString() ? `/articles?${queryParams.toString()}` : "/articles";
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const url = host ? `${protocol}://${host}${pathWithQuery}` : undefined;

  await logPageView({ path: pathWithQuery, url, referrer, ip, userAgent });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Artikel Terbaru</h1>
            <p className="text-muted-foreground">Temukan cerita terbaru dari penulis kami.</p>
          </div>
          <div className="space-y-4">
            {articles.map((article) => (
              <ArticleListCard
                key={article.id}
                href={`/articles/${article.slug}`}
                title={article.title}
                excerpt={article.excerpt}
                publishedAt={article.publishedAt}
                authorName={article.author?.name}
                authorAvatarUrl={article.author?.avatarUrl ?? null}
                category={
                  article.categories[0]?.category
                    ? {
                        name: article.categories[0].category.name,
                        slug: article.categories[0].category.slug,
                      }
                    : null
                }
                image={article.featuredMedia?.url ? { url: article.featuredMedia.url, alt: article.featuredMedia.title ?? article.title } : null}
              />
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
            <nav className="flex flex-wrap items-center gap-2" aria-label="Pagination">
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

        <ArticleSidebar
          latestArticles={sidebarData.latestSidebarArticles}
          popularArticles={sidebarData.popularSidebarArticles}
          popularTags={sidebarData.popularTags}
        />
      </div>
    </div>
  );
}
