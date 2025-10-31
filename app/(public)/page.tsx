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
import { formatRelativeTime } from "@/lib/datetime/relative";
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
  author: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.ArticleInclude;

type ArticleWithRelations = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;

type StructuredDataNode = Record<string, unknown>;

function resolvePreferredSiteUrl(preferred?: string | null) {
  const candidates = [
    preferred,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.SITE_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

function toAbsoluteUrl(value: string | null | undefined, base: URL | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return base ? new URL(trimmed, base).toString() : new URL(trimmed).toString();
  } catch {
    if (!base) return null;
    try {
      return new URL(trimmed.replace(/^\/+/, ""), base).toString();
    } catch {
      return null;
    }
  }
}

function buildStructuredData({
  siteConfig,
  homepageTitle,
  heroArticles,
  siteUrl,
}: {
  siteConfig: Awaited<ReturnType<typeof getSiteConfig>>;
  homepageTitle: string;
  heroArticles: HeroSliderArticle[];
  siteUrl: URL | null;
}): StructuredDataNode[] {
  const items: StructuredDataNode[] = [];
  const siteOrigin = siteUrl?.origin ?? null;
  const siteHref = siteUrl?.toString() ?? null;

  if (siteHref) {
    const searchUrl = toAbsoluteUrl("/search?q={search_term_string}", siteUrl);
    items.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: homepageTitle,
      url: siteHref,
      potentialAction: searchUrl
        ? {
            "@type": "SearchAction",
            target: searchUrl,
            "query-input": "required name=search_term_string",
          }
        : undefined,
    });
  }

  items.push({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteHref ?? undefined,
    logo: toAbsoluteUrl(siteConfig.logoUrl ?? null, siteUrl) ?? undefined,
    sameAs: [
      toAbsoluteUrl(siteConfig.links.facebook ?? null, siteUrl),
      toAbsoluteUrl(siteConfig.links.instagram ?? null, siteUrl),
      toAbsoluteUrl(siteConfig.links.twitter ?? null, siteUrl),
      toAbsoluteUrl(siteConfig.links.youtube ?? null, siteUrl),
    ].filter((value): value is string => Boolean(value)),
  });

  if (heroArticles.length > 0) {
    const articleItems = heroArticles.slice(0, 6).map((article, index) => {
      const articleUrl = toAbsoluteUrl(`/articles/${article.slug}`, siteUrl);
      const imageUrl = article.featuredImage?.url
        ? toAbsoluteUrl(article.featuredImage.url, siteUrl)
        : null;
      return {
        "@type": "ListItem",
        position: index + 1,
        url: articleUrl ?? undefined,
        name: article.title,
        image: imageUrl ?? undefined,
      };
    });

    items.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListOrder: "Descending",
      url: siteHref ?? siteOrigin ?? undefined,
      itemListElement: articleItems,
    });
  }

  return items;
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const baseTitle = config.metadata.title ?? config.name;
  const metadata = await createMetadata({
    config,
    title: baseTitle,
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
  return {
    ...metadata,
    title: { absolute: baseTitle },
  };
}

function formatRelativeLabel(date: Date | string | null | undefined) {
  const label = formatRelativeTime(date);
  return label || "-";
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

  const [latestArticles, randomizableCategories, popularArticlePaths, siteConfig] = await Promise.all([
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
    getSiteConfig(),
  ]);
  const heroArticles = latestArticles.slice(0, 5);
  const heroSliderArticles: HeroSliderArticle[] = heroArticles.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    publishDateLabel: formatRelativeLabel(article.publishedAt ?? article.createdAt),
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
  const remainingAfterHero = latestArticles.slice(heroArticles.length);
  const heroRightArticles = remainingAfterHero.slice(0, 8);
  const heroRightMobileArticles = heroRightArticles.slice(0, 4);
  const heroRightTabletArticles = heroRightArticles.slice(0, 3);
  const heroRightDesktopArticles = heroRightArticles.slice(0, 8);
  const horizontalHighlightArticles = remainingAfterHero.slice(
    heroRightArticles.length,
    heroRightArticles.length + 4,
  );
  const remainingAfterHighlights = remainingAfterHero.slice(
    heroRightArticles.length + horizontalHighlightArticles.length,
  );
  const latestArticlesForCards = (
    remainingAfterHighlights.length > 0 ? remainingAfterHighlights : latestArticles
  ).slice(0, 9);

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
  const homepageTitle = siteConfig.metadata.title?.trim() || siteConfig.name;
  const preferredSiteUrl = resolvePreferredSiteUrl(siteConfig.url);
  const structuredDataNodes = buildStructuredData({
    siteConfig,
    homepageTitle,
    heroArticles: heroSliderArticles,
    siteUrl: preferredSiteUrl,
  });
  const structuredDataScripts = structuredDataNodes.map(
    (node) => JSON.stringify(node).replace(/</g, "\\u003c"),
  );

  return (
    <div className="flex flex-col gap-12 -mt-6 sm:-mt-8 lg:-mt-10">
      {structuredDataScripts.length > 0 ? (
        structuredDataScripts.map((json, index) => (
          <script
            key={`structured-data-${index}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: json }}
          />
        ))
      ) : null}
      <h1 className="sr-only">{homepageTitle}</h1>
      <section
        aria-labelledby="homepage-highlights-heading"
        className="flex flex-col gap-5"
      >
        <div className="space-y-1.5">
          <h2 id="homepage-highlights-heading" className="sr-only">
            Sorotan Utama
          </h2>
        </div>
        <div className="grid items-stretch gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-h-[260px] h-full">
            {heroSliderArticles.length > 0 ? (
              <HeroSlider articles={heroSliderArticles} />
            ) : (
              <Card className="h-full border-dashed border-border/70">
                <CardContent className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                  Belum ada artikel yang dipublikasikan.
                </CardContent>
              </Card>
            )}
          </div>
          <div>
            {heroRightArticles.length === 0 ? (
              <Card className="border-dashed border-border/70">
                <CardContent className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                  Artikel terbaru akan tampil di sini setelah tersedia.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 md:hidden">
                  {heroRightMobileArticles.map((article) => {
                    const thumbnail = getThumbnailUrl(article);
                    return (
                      <Link
                        key={`hero-mobile-${article.id}`}
                        href={`/articles/${article.slug}`}
                        className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition hover:border-primary/60 hover:shadow-md"
                      >
                        {thumbnail ? (
                          <div className="relative aspect-[4/3] w-full overflow-hidden">
                            <Image
                              src={thumbnail}
                              alt={article.featuredMedia?.title ?? article.title}
                              fill
                              className="object-cover transition duration-300 group-hover:scale-105"
                              sizes="50vw"
                            />
                          </div>
                        ) : (
                          <div className="aspect-[4/3] w-full bg-muted text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <span className="inline-block p-3">{getPrimaryCategory(article)}</span>
                          </div>
                        )}
                        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                          <span className="inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                            {getPrimaryCategory(article)}
                          </span>
                          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground transition group-hover:text-primary">
                            {article.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeLabel(article.publishedAt)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="hidden md:flex xl:hidden flex-col gap-2">
                  {heroRightTabletArticles.map((article) => {
                    const thumbnail = getThumbnailUrl(article);
                    return (
                      <Link
                        key={`hero-tablet-${article.id}`}
                        href={`/articles/${article.slug}`}
                        className="group flex gap-2.5 rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/60 hover:shadow-md"
                      >
                        {thumbnail ? (
                          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border/60">
                            <Image
                              src={thumbnail}
                              alt={article.featuredMedia?.title ?? article.title}
                              fill
                              className="object-cover transition duration-300 group-hover:scale-105"
                              sizes="64px"
                            />
                          </div>
                        ) : (
                          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {getPrimaryCategory(article)}
                          </div>
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {getPrimaryCategory(article)}
                          </span>
                          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground transition group-hover:text-primary">
                            {article.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeLabel(article.publishedAt)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="hidden xl:grid gap-2 md:grid-cols-2">
                  {heroRightDesktopArticles.map((article) => {
                    const thumbnail = getThumbnailUrl(article);
                    return (
                      <Link
                        key={`hero-desktop-${article.id}`}
                        href={`/articles/${article.slug}`}
                        className="group flex gap-2.5 rounded-xl border border-border/60 bg-card p-3 transition hover:border-primary/60 hover:shadow-md"
                      >
                        {thumbnail ? (
                          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border/60">
                            <Image
                              src={thumbnail}
                              alt={article.featuredMedia?.title ?? article.title}
                              fill
                              className="object-cover transition duration-300 group-hover:scale-105"
                              sizes="64px"
                            />
                          </div>
                        ) : (
                          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {getPrimaryCategory(article)}
                          </div>
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                              {getPrimaryCategory(article)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeLabel(article.publishedAt)}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground transition group-hover:text-primary">
                            {article.title}
                          </p>
                          {(() => {
                            const authorName = article.author?.name?.trim() || "Administrator";
                            const avatarUrl = article.author?.avatarUrl ?? null;
                            const authorInitial = authorName.charAt(0).toUpperCase();
                            return (
                              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                {avatarUrl ? (
                                  <Image
                                    src={avatarUrl}
                                    alt={`Foto ${authorName}`}
                                    width={20}
                                    height={20}
                                    className="h-5 w-5 rounded-full object-cover"
                                    sizes="20px"
                                  />
                                ) : (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold uppercase text-muted-foreground/70">
                                    {authorInitial}
                                  </span>
                                )}
                                <span className="font-medium text-foreground">{authorName}</span>
                              </span>
                            );
                          })()}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          {horizontalHighlightArticles.length === 0 ? (
            <Card className="border-dashed border-border/70">
              <CardContent className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                Konten pilihan akan terlihat di sini setelah tersedia.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {horizontalHighlightArticles.map((article) => {
                const thumbnail = getThumbnailUrl(article);
                return (
                  <Link
                    key={article.id}
                    href={`/articles/${article.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition hover:border-primary/60 hover:shadow-md"
                  >
                    {thumbnail ? (
                      <div className="relative aspect-[16/9] w-full overflow-hidden">
                        <Image
                          src={thumbnail}
                          alt={article.featuredMedia?.title ?? article.title}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-105"
                          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/10 via-primary/5 to-card" />
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-3.5">
                      <span className="inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
                        {getPrimaryCategory(article)}
                      </span>
                      <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground transition group-hover:text-primary">
                        {article.title}
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        {formatRelativeLabel(article.publishedAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
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
                        {getPrimaryCategory(article)} • {formatRelativeLabel(article.publishedAt)}
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
                      {formatRelativeLabel(article.publishedAt)}
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
                                {getPrimaryCategory(article)} • {formatRelativeLabel(article.publishedAt)}
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
