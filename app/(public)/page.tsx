import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { ArticleStatus, Prisma } from "@prisma/client";

import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { deriveThumbnailUrl } from "@/lib/storage/media";
import { getSiteConfig } from "@/lib/site-config/server";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";
import type { HeroSliderArticle } from "./(components)/hero-slider";
import { HeroSlider } from "./(components)/hero-slider";

const POPULAR_LOOKBACK_DAYS = 7;

const articleInclude = {
  categories: {
    include: { category: true },
    orderBy: { assignedAt: "asc" as const },
  },
  featuredMedia: {
    select: { url: true, title: true, width: true, height: true },
  },
} satisfies Prisma.ArticleInclude;

type ArticleWithRelations = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return createMetadata({
    config,
    title: config.metadata.title ?? config.name,
    description: config.metadata.description ?? config.description,
    path: "/",
    image: config.logoUrl
      ? {
          url: config.logoUrl,
          alt: `${config.name} logo`,
        }
      : config.ogImage
        ? {
            url: config.ogImage,
            alt: config.name,
          }
        : null,
  });
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function getPrimaryCategory(article: ArticleWithRelations) {
  return article.categories[0]?.category.name ?? "Umum";
}

export default async function HomePage() {
  const now = new Date();
  const popularWindowStart = new Date(now);
  popularWindowStart.setDate(popularWindowStart.getDate() - POPULAR_LOOKBACK_DAYS);

  const [latestArticles, randomizableCategories, popularArticlePaths] = await Promise.all([
    prisma.article.findMany({
      where: { status: ArticleStatus.PUBLISHED },
      include: articleInclude,
      orderBy: [{ publishedAt: "desc" }],
      take: 24,
    }),
    prisma.category.findMany({
      where: {
        articles: {
          some: {
            article: {
              status: ArticleStatus.PUBLISHED,
              publishedAt: { not: null },
            },
          },
        },
      },
      select: { id: true, name: true, slug: true },
    }),
    prisma.visitLog.groupBy({
      by: ["path"],
      where: {
        createdAt: { gte: popularWindowStart },
        path: { startsWith: "/articles/" },
      },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 40,
    }),
  ]);
  const heroArticles = latestArticles.slice(0, 5);
  const remainingAfterHero = latestArticles.slice(heroArticles.length);
  const sidebarArticles = remainingAfterHero.slice(0, 4);
  const latestArticlesAfterSidebar = remainingAfterHero.slice(sidebarArticles.length);
  const latestArticlesForCards = (
    latestArticlesAfterSidebar.length > 0 ? latestArticlesAfterSidebar : latestArticles
  ).slice(0, 9);

  const heroSliderArticles: HeroSliderArticle[] = heroArticles.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    publishDateLabel: formatDate(article.publishedAt),
    categories: article.categories.map((entry) => entry.category.name),
    featuredImage: article.featuredMedia
      ? {
          url: article.featuredMedia.url,
          title: article.featuredMedia.title ?? article.title,
          width: article.featuredMedia.width ?? 1280,
          height: article.featuredMedia.height ?? 720,
        }
      : null,
  }));

  const randomCategory =
    randomizableCategories.length > 0
      ? randomizableCategories[
          (now.getUTCDate() + now.getUTCMonth() * 3) % randomizableCategories.length
        ]
      : null;

  const randomCategoryArticles = randomCategory
    ? await prisma.article.findMany({
        where: {
          status: ArticleStatus.PUBLISHED,
          publishedAt: { not: null },
          categories: { some: { categoryId: randomCategory.id } },
        },
        include: articleInclude,
        orderBy: [{ publishedAt: "desc" }],
        take: 3,
      })
    : [];

  const popularSlugs = popularArticlePaths
    .map((entry) => entry.path.replace(/^\/articles\//, "").split("/")[0])
    .filter((slug): slug is string => Boolean(slug));
  const uniquePopularSlugs = Array.from(new Set(popularSlugs));

  const popularArticlesRaw = uniquePopularSlugs.length
    ? await prisma.article.findMany({
        where: {
          status: ArticleStatus.PUBLISHED,
          slug: { in: uniquePopularSlugs },
        },
        include: articleInclude,
      })
    : [];

  const popularArticles = uniquePopularSlugs
    .map((slug) => popularArticlesRaw.find((article) => article.slug === slug))
    .filter((article): article is ArticleWithRelations => Boolean(article))
    .slice(0, 9);

  const latestCardGroups = chunk(latestArticlesForCards, 3);
  const popularCardGroups = chunk(popularArticles, 3);

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const fullUrl = host ? `${protocol}://${host}/` : undefined;

  await logPageView({
    path: "/",
    url: fullUrl,
    referrer,
    ip,
    userAgent,
  });

  const getThumbnailUrl = (entry: ArticleWithRelations) => {
    const source = entry.featuredMedia?.url;
    if (!source) return null;
    return deriveThumbnailUrl(source) ?? source;
  };

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-[70%_30%] lg:grid-cols-[65%_35%]">
          <div>
            {heroSliderArticles.length > 0 ? (
              <HeroSlider
                key={heroSliderArticles.map((article) => article.id).join(":")}
                articles={heroSliderArticles}
              />
            ) : (
              <Card className="border-dashed border-border/70">
                <CardContent className="flex h-full min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Belum ada artikel yang dipublikasikan.
                </CardContent>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            {sidebarArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Artikel terbaru akan tampil di sini setelah tersedia.
              </p>
            ) : (
              sidebarArticles.map((article) => {
                const thumbnail = getThumbnailUrl(article);
                return (
                  <Link
                    key={article.id}
                    href={`/articles/${article.slug}`}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-2.5 transition hover:border-primary/60 hover:bg-primary/5"
                  >
                    {thumbnail ? (
                      <div className="relative aspect-video w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border/60">
                        <Image
                          src={thumbnail}
                          alt={article.featuredMedia?.title ?? article.title}
                          fill
                          className="object-cover transition duration-300 group-hover:scale-105"
                          sizes="(min-width: 1024px) 96px, 30vw"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video w-24 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
                        {getPrimaryCategory(article)}
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="line-clamp-3 text-sm font-semibold leading-snug text-foreground transition group-hover:text-primary">
                        {article.title}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {getPrimaryCategory(article)} • {formatDate(article.publishedAt)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Kabar Terbaru</h2>
            <p className="text-sm text-muted-foreground">
              Update terhangat dari komunitas dan penulis.
            </p>
          </div>
          <Link href="/articles" className="text-sm font-semibold text-primary hover:underline">
            Lihat semua artikel
          </Link>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {latestCardGroups.length === 0 ? (
            <Card className="border-dashed border-border/70">
              <CardContent className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                Kami akan segera menghadirkan tulisan terbaru di sini.
              </CardContent>
            </Card>
          ) : (
            latestCardGroups.map((group, groupIndex) => (
              <Card key={`latest-group-${groupIndex}`} className="border-border/70">
                <CardContent className="divide-y divide-border/60 p-0">
                  {group.map((article) => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="group block px-5 py-4 transition hover:bg-primary/5"
                    >
                      <p className="text-sm font-semibold leading-snug group-hover:text-primary">
                        {article.title}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {getPrimaryCategory(article)} • {formatDate(article.publishedAt)}
                      </span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {randomCategory ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Pilihan Kategori: {randomCategory.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Artikel rekomendasi dari kategori <span className="font-semibold text-foreground">{randomCategory.name}</span>.
              </p>
            </div>
            <Link
              href={`/categories/${randomCategory.slug}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Jelajahi kategori
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {randomCategoryArticles.length === 0 ? (
              <Card className="border-dashed border-border/70">
                <CardContent className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                  Belum ada artikel pada kategori ini.
                </CardContent>
              </Card>
            ) : (
              randomCategoryArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition hover:border-primary/60 hover:shadow-lg"
                >
                  {article.featuredMedia?.url ? (
                    <div className="relative aspect-[16/9] w-full overflow-hidden">
                      <Image
                        src={article.featuredMedia.url}
                        alt={article.featuredMedia.title ?? article.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/10 via-primary/5 to-card" />
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {randomCategory.name}
                    </span>
                    <h3 className="text-base font-semibold leading-tight group-hover:text-primary">
                      {article.title}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(article.publishedAt)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Populer Minggu Ini</h2>
            <p className="text-sm text-muted-foreground">
              Artikel dengan kunjungan terbanyak dalam 7 hari terakhir.
            </p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {popularCardGroups.length === 0 ? (
            <Card className="border-dashed border-border/70">
              <CardContent className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                Data kunjungan belum tersedia. Silakan kembali lagi nanti.
              </CardContent>
            </Card>
          ) : (
                popularCardGroups.map((group, groupIndex) => (
                  <Card key={`popular-group-${groupIndex}`} className="border-border/70">
                    <CardContent className="divide-y divide-border/60 p-0">
                      {group.map((article) => {
                        const thumbnail = getThumbnailUrl(article);
                        const fallbackInitial = article.title.trim().charAt(0).toUpperCase() || "R";
                        return (
                          <Link
                            key={article.id}
                            href={`/articles/${article.slug}`}
                            className="group flex items-center gap-3 px-5 py-4 transition hover:bg-primary/5"
                          >
                            {thumbnail ? (
                              <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border/60">
                                <Image
                                  src={thumbnail}
                                  alt={article.featuredMedia?.title ?? article.title}
                                  fill
                                  className="object-cover transition duration-500 group-hover:scale-105"
                                  sizes="(min-width: 1280px) 96px, (min-width: 768px) 88px, 72px"
                                />
                              </div>
                            ) : (
                              <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-primary/10 text-lg font-semibold text-primary">
                                {fallbackInitial}
                              </div>
                            )}
                            <div className="min-w-0 space-y-1">
                              <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                                {article.title}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {getPrimaryCategory(article)} • {formatDate(article.publishedAt)}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
    </div>
  );
}
