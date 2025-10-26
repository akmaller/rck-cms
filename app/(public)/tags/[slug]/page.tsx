import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArticleStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArticleListCard } from "@/app/(public)/(components)/article-list-card";
import { ArticleSidebar } from "@/app/(public)/(components)/article-sidebar";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";
import { getArticleSidebarData } from "@/lib/articles/sidebar";

const PAGE_SIZE = 6;

type TagPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!tag) {
    return createMetadata({
      title: "Tag tidak ditemukan",
      description: "Tag yang Anda cari tidak tersedia.",
      path: `/tags/${slug}`,
      robots: { index: false, follow: false },
    });
  }

  const currentPage = Math.max(1, Number(query?.page ?? 1));
  const config = await getSiteConfig();
  const baseTitle = `Tag: ${tag.name}`;
  const title = currentPage > 1 ? `${baseTitle} — Halaman ${currentPage}` : baseTitle;
  const description = `Artikel dengan tag ${tag.name} dari ${config.name}.`;
  const path = currentPage > 1 ? `/tags/${slug}?page=${currentPage}` : `/tags/${slug}`;

  return createMetadata({
    config,
    title,
    description,
    path,
    keywords: [tag.name],
    tags: [tag.name],
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
  const pages: Array<{ label: string; href: string; active: boolean } | "ellipsis"> = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      pages.push({ label: `${i}`, href: `${basePath}?page=${i}`, active: i === current });
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }
  return pages;
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const currentPage = Math.max(1, Number(query.page ?? 1));

  const tag = await prisma.tag.findUnique({
    where: { slug },
  });

  if (!tag) {
    notFound();
  }

  const whereClause = {
    status: ArticleStatus.PUBLISHED,
    tags: {
      some: {
        tag: {
          slug,
        },
      },
    },
  } as const;

  const [articles, totalCount, sidebarData] = await Promise.all([
    prisma.article.findMany({
      where: whereClause,
      include: {
        author: { select: { id: true, name: true } },
        categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
        featuredMedia: { select: { url: true, title: true, description: true, width: true, height: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where: whereClause }),
    getArticleSidebarData(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagination = buildPaginationLinks({
    current: currentPage,
    total: totalPages,
    basePath: `/tags/${slug}`,
  });

  const queryParams = new URLSearchParams();
  if (query.page && query.page !== "1") {
    queryParams.set("page", query.page);
  }
  const pathWithQuery = queryParams.toString() ? `/tags/${slug}?${queryParams.toString()}` : `/tags/${slug}`;
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
          <header className="space-y-2">
            <Link href="/" className="text-sm text-muted-foreground">
              ← Kembali ke Beranda
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Tag: {tag.name}</h1>
          </header>

          <div className="space-y-4">
            {articles.map((article) => (
              <ArticleListCard
                key={article.id}
                href={`/articles/${article.slug}`}
                title={article.title}
                excerpt={article.excerpt}
                publishedAt={article.publishedAt}
                authorName={article.author?.name}
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
                <CardDescription>
                  Konten untuk tag ini akan segera hadir. Sementara, jelajahi artikel lain.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link className={buttonVariants({ variant: "outline" })} href="/articles">
                  Lihat semua artikel
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {totalPages > 1 ? (
            <nav className="flex flex-wrap items-center gap-2" aria-label="Pagination">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
              >
                <Link href={`/tags/${slug}?page=${currentPage - 1}`}>Sebelumnya</Link>
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
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
              >
                <Link href={`/tags/${slug}?page=${currentPage + 1}`}>Berikutnya</Link>
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
