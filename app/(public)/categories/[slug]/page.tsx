import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArticleStatus } from "@prisma/client";

import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArticleSidebar } from "@/app/(public)/(components)/article-sidebar";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";
import { getArticleSidebarData } from "@/lib/articles/sidebar";
import { ArticleLoadMoreList } from "@/app/(public)/(components)/article-load-more-list";
import { articleListInclude, serializeArticleForList } from "@/lib/articles/list";

const INITIAL_LIMIT = 20;
const LOAD_MORE_LIMIT = 10;

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });

  if (!category) {
    return createMetadata({
      title: "Kategori tidak ditemukan",
      description: "Kategori yang Anda cari tidak tersedia.",
      path: `/categories/${slug}`,
      robots: { index: false, follow: false },
    });
  }

  const config = await getSiteConfig();
  const description =
    category.description?.trim() ??
    `Kumpulan artikel bertema ${category.name} dari ${config.name}.`;

  return createMetadata({
    config,
    title: `Kategori: ${category.name}`,
    description,
    path: `/categories/${slug}`,
    keywords: [category.name],
    tags: [category.name],
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) {
    notFound();
  }

  const whereClause = {
    status: ArticleStatus.PUBLISHED,
    categories: {
      some: {
        category: {
          slug,
        },
      },
    },
  } as const;

  const [articles, totalCount, sidebarData] = await Promise.all([
    prisma.article.findMany({
      where: whereClause,
      include: articleListInclude,
      orderBy: { publishedAt: "desc" },
      skip: 0,
      take: INITIAL_LIMIT,
    }),
    prisma.article.count({ where: whereClause }),
    getArticleSidebarData(),
  ]);

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const path = `/categories/${slug}`;
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({ path, url, referrer, ip, userAgent });

  const initialArticles = articles.map((article) =>
    serializeArticleForList(article, {
      overrideCategory: { name: category.name, slug: category.slug },
    })
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <header className="space-y-2">
            <Link href="/" className="text-sm text-muted-foreground">
              ← Kembali ke Beranda
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Kategori: {category.name}</h1>
            {category.description ? (
              <p className="text-muted-foreground">{category.description}</p>
            ) : null}
          </header>

          <ArticleLoadMoreList
            initialArticles={initialArticles}
            totalCount={totalCount}
            loadSize={LOAD_MORE_LIMIT}
            request={{ mode: "category", slug }}
            emptyState={
              <Card>
                <CardHeader>
                  <CardTitle>Belum ada artikel</CardTitle>
                  <CardDescription>
                    Konten untuk kategori ini akan segera hadir. Sementara, jelajahi artikel lain.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link className={buttonVariants({ variant: "outline" })} href="/articles">
                    Lihat semua artikel
                  </Link>
                </CardContent>
              </Card>
            }
          />
        </div>

        <aside className="lg:sticky lg:top-24">
          <ArticleSidebar
            latestArticles={sidebarData.latestSidebarArticles}
            popularArticles={sidebarData.popularSidebarArticles}
            popularTags={sidebarData.popularTags}
          />
        </aside>
      </div>
    </div>
  );
}
