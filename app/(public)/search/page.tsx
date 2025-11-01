import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArticleStatus, Prisma } from "@prisma/client";

import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const query = (resolved?.q ?? "").trim();
  const config = await getSiteConfig();

  if (!query) {
    return createMetadata({
      config,
      title: "Pencarian Konten",
      description: `Cari artikel dan halaman dari ${config.name}.`,
      path: "/search",
    });
  }

  return createMetadata({
    config,
    title: `Pencarian: ${query}`,
    description: `Hasil pencarian untuk “${query}” di ${config.name}.`,
    path: `/search?q=${encodeURIComponent(query)}`,
    keywords: [query],
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const query = (resolved.q ?? "").trim();

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const path = query ? `/search?q=${encodeURIComponent(query)}` : "/search";
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({ path, url, referrer, ip, userAgent });

  const sidebarDataPromise = getArticleSidebarData();

  if (!query) {
    const sidebarData = await sidebarDataPromise;
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Pencarian Konten</h1>
              <p className="text-muted-foreground">
                Cari artikel berdasarkan judul, ringkasan, atau nama penulis.
              </p>
            </div>
            <SearchForm defaultValue="" />
            <Card>
              <CardHeader>
                <CardTitle>Tips Pencarian</CardTitle>
                <CardDescription>Gunakan kata kunci spesifik untuk menemukan artikel terkait.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Contoh: gunakan kata kunci seperti <strong>budaya</strong>, <strong>kuliner</strong>, atau judul artikel.
                </p>
              </CardContent>
            </Card>
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

  const where: Prisma.ArticleWhereInput = {
    status: ArticleStatus.PUBLISHED,
    OR: [
      { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { excerpt: { contains: query, mode: Prisma.QueryMode.insensitive } },
      {
        author: {
          name: { contains: query, mode: Prisma.QueryMode.insensitive },
          NOT: { role: "ADMIN" },
        },
      },
    ],
  };

  const [articles, totalCount, sidebarData] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: articleListInclude,
      skip: 0,
      take: INITIAL_LIMIT,
    }),
    prisma.article.count({ where }),
    sidebarDataPromise,
  ]);

  const initialArticles = articles.map((article) => serializeArticleForList(article));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">Pencarian</h1>
            <SearchForm defaultValue={query} />
            <p className="text-sm text-muted-foreground">
              Ditemukan {totalCount} artikel untuk “{query}”.
            </p>
          </div>

          <ArticleLoadMoreList
            initialArticles={initialArticles}
            totalCount={totalCount}
            loadSize={LOAD_MORE_LIMIT}
            request={{ mode: "search", query }}
            emptyState={
              <Card>
                <CardHeader>
                  <CardTitle>Hasil tidak ditemukan</CardTitle>
                  <CardDescription>Coba kata kunci lain atau lihat artikel terbaru.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link className={buttonVariants({ variant: "outline" })} href="/articles">
                    Artikel Terbaru
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

type SearchFormProps = {
  defaultValue: string;
};

function SearchForm({ defaultValue }: SearchFormProps) {
  return (
    <form action="/search" className="grid gap-2 sm:flex sm:items-center sm:gap-4">
      <div className="w-full space-y-2 sm:max-w-lg">
        <Label htmlFor="search">Kata kunci</Label>
        <Input
          id="search"
          name="q"
          placeholder="cari artikel..."
          defaultValue={defaultValue}
          required
        />
      </div>
      <Button type="submit" className="mt-2 sm:mt-8">
        Cari
      </Button>
    </form>
  );
}
