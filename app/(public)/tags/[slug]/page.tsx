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

type TagPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
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

  const config = await getSiteConfig();

  return createMetadata({
    config,
    title: `Tag: ${tag.name}`,
    description: `Artikel dengan tag ${tag.name} dari ${config.name}.`,
    path: `/tags/${slug}`,
    keywords: [tag.name],
    tags: [tag.name],
  });
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;

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
  const path = `/tags/${slug}`;
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({ path, url, referrer, ip, userAgent });

  const initialArticles = articles.map((article) => serializeArticleForList(article));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <header className="space-y-2">
            <Link href="/" className="text-sm text-muted-foreground">
              ← Kembali ke Beranda
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Tag: {tag.name}</h1>
          </header>

          <ArticleLoadMoreList
            initialArticles={initialArticles}
            totalCount={totalCount}
            loadSize={LOAD_MORE_LIMIT}
            request={{ mode: "tag", slug }}
            emptyState={
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
