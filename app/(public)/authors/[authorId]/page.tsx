import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleStatus, Prisma } from "@prisma/client";
import { Facebook, Instagram, Link2, Linkedin, Twitter, Youtube, type LucideIcon } from "lucide-react";

import { AUTHOR_SOCIAL_FIELDS, AUTHOR_SOCIAL_KEYS, type AuthorSocialKey } from "@/lib/authors/social-links";
import { prisma } from "@/lib/prisma";
import { deriveThumbnailUrl } from "@/lib/storage/media";
import { createMetadata } from "@/lib/seo/metadata";
import { ArticleLoadMoreList } from "@/app/(public)/(components)/article-load-more-list";
import { articleListInclude, serializeArticleForList } from "@/lib/articles/list";
import { formatRelativeTime } from "@/lib/datetime/relative";

const sidebarArticleInclude = {
  categories: {
    include: { category: true },
    orderBy: { assignedAt: "asc" as const },
  },
  featuredMedia: {
    select: { url: true, title: true, width: true, height: true },
  },
} satisfies Prisma.ArticleInclude;

type SidebarArticle = Prisma.ArticleGetPayload<{ include: typeof sidebarArticleInclude }>;

const POPULAR_LOOKBACK_DAYS = 7;
const INITIAL_LIMIT = 20;
const LOAD_MORE_LIMIT = 10;
const SOCIAL_ICON_MAP: Record<AuthorSocialKey, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
};

async function getAuthor(authorId: string) {
  return prisma.user.findUnique({
    where: { id: authorId },
    select: {
      id: true,
      name: true,
      bio: true,
      createdAt: true,
      avatarUrl: true,
      socialLinks: true,
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ authorId: string }> }): Promise<Metadata> {
  const { authorId } = await params;
  const author = await getAuthor(authorId);
  if (!author) {
    return createMetadata({
      title: "Penulis tidak ditemukan",
      description: "Profil penulis tidak tersedia.",
      path: `/authors/${authorId}`,
      robots: { index: false, follow: false },
    });
  }

  return createMetadata({
    title: `Profil ${author.name}`,
    description: author.bio ?? `Profil dan tulisan ${author.name} di platform kami.`,
    path: `/authors/${authorId}`,
    type: "article",
    image: author.avatarUrl
      ? {
          url: author.avatarUrl,
          alt: author.name,
          width: 320,
          height: 320,
        }
      : null,
  });
}

type AuthorPageProps = {
  params: Promise<{ authorId: string }>;
};

export default async function AuthorProfilePage({ params }: AuthorPageProps) {
  const { authorId } = await params;
  const author = await getAuthor(authorId);
  if (!author) {
    notFound();
  }

  const now = new Date();
  const lookbackStart = new Date(now);
  lookbackStart.setDate(lookbackStart.getDate() - POPULAR_LOOKBACK_DAYS);

  const authoredWhere = { authorId, status: ArticleStatus.PUBLISHED } as const;

  const [initialArticlesRaw, totalCount, authorSlugs, latestSidebarRaw, popularVisitLogs, popularTags] = await Promise.all([
    prisma.article.findMany({
      where: authoredWhere,
      include: articleListInclude,
      orderBy: { publishedAt: "desc" },
      skip: 0,
      take: INITIAL_LIMIT,
    }),
    prisma.article.count({ where: authoredWhere }),
    prisma.article.findMany({
      where: authoredWhere,
      select: { slug: true },
    }),
    prisma.article.findMany({
      where: { status: ArticleStatus.PUBLISHED, authorId: { not: authorId } },
      include: sidebarArticleInclude,
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
    prisma.visitLog.groupBy({
      by: ["path"],
      where: {
        createdAt: { gte: lookbackStart },
        path: { startsWith: "/articles/" },
      },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 40,
    }),
    prisma.tag.findMany({
      orderBy: { articles: { _count: "desc" } },
      take: 10,
      include: { _count: { select: { articles: true } } },
    }),
  ]);

  const articleSlugs = authorSlugs.map((article) => article.slug);
  const articlePaths = articleSlugs.map((slug) => `/articles/${slug}`);

  const uniqueVisitors = articlePaths.length
    ? await prisma.visitLog.findMany({
        where: {
          path: { in: articlePaths },
          ip: { not: null },
        },
        select: { ip: true },
        distinct: ["ip"],
      })
    : [];

  const articleCount = totalCount;
  const viewerCount = uniqueVisitors.length;

  const popularSlugs = popularVisitLogs
    .map((entry) => entry.path.replace(/^\/articles\//, "").split("/")[0])
    .filter((slug): slug is string => Boolean(slug));
  const uniquePopularSlugs = Array.from(new Set(popularSlugs));

  const popularArticlesRaw = uniquePopularSlugs.length
    ? await prisma.article.findMany({
        where: { status: ArticleStatus.PUBLISHED, slug: { in: uniquePopularSlugs } },
        include: sidebarArticleInclude,
      })
    : [];

  const popularSidebarArticles = uniquePopularSlugs
    .map((slug) => popularArticlesRaw.find((article) => article.slug === slug))
    .filter((article): article is SidebarArticle => Boolean(article))
    .slice(0, 4);

  const latestSidebarArticles = latestSidebarRaw.slice(0, 4);

  const formatDate = (date: Date | string | null | undefined) => {
    const label = formatRelativeTime(date);
    return label || "-";
  };

  const formatJoinDate = formatDate(author.createdAt);

  const getPrimaryCategory = (entry: { categories: { category: { name: string } }[] }) =>
    entry.categories[0]?.category.name ?? "Umum";

  const getThumbnailUrl = (entry: { featuredMedia?: { url: string | null } | null }) => {
    const source = entry.featuredMedia?.url ?? null;
    if (!source) return null;
    return deriveThumbnailUrl(source) ?? source;
  };

  const sidebarLatestList = latestSidebarArticles.map((item) => ({
    ...item,
    thumbnail: getThumbnailUrl(item),
  }));

  const sidebarPopularList = popularSidebarArticles.map((item) => ({
    article: item,
    thumbnail: getThumbnailUrl(item),
  }));

  const authorSocialRaw = (author.socialLinks as Record<string, unknown> | null) ?? {};
  const socialFieldLabelMap = new Map(AUTHOR_SOCIAL_FIELDS.map((field) => [field.key, field.label] as const));
  const socialEntries: Array<{ key: string; label: string; href: string; icon: LucideIcon; display?: string }> = [];
  const knownSocialKeySet = new Set<AuthorSocialKey>(AUTHOR_SOCIAL_KEYS);

  for (const key of AUTHOR_SOCIAL_KEYS) {
    const rawValue = authorSocialRaw?.[key];
    if (typeof rawValue !== "string") {
      continue;
    }
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      continue;
    }
    socialEntries.push({
      key,
      label: socialFieldLabelMap.get(key) ?? key,
      href: trimmedValue,
      icon: SOCIAL_ICON_MAP[key],
    });
  }

  for (const [rawKey, rawValue] of Object.entries(authorSocialRaw)) {
    if (knownSocialKeySet.has(rawKey as AuthorSocialKey)) {
      continue;
    }
    if (typeof rawValue !== "string") {
      continue;
    }
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      continue;
    }
    const normalizedLabel = rawKey
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
    socialEntries.push({
      key: rawKey,
      label: normalizedLabel || rawKey,
      href: trimmedValue,
      icon: Link2,
    });
  }

  const socialLinks = socialEntries.map((entry) => {
    let hostname: string | null = null;
    try {
      hostname = new URL(entry.href).hostname.replace(/^www\./, "");
    } catch {
      hostname = null;
    }
    return {
      ...entry,
      display: hostname,
    };
  });

  const initialArticles = initialArticlesRaw.map((article) => serializeArticleForList(article));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <div className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:gap-6 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-border/60 shadow-sm sm:h-28 sm:w-28 lg:h-32 lg:w-32">
                {author.avatarUrl ? (
                  <Image
                    src={author.avatarUrl}
                    alt={author.name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 128px, 112px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/10 text-3xl font-semibold text-primary">
                    {author.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{author.name}</h1>
                <p className="text-sm text-muted-foreground">Bergabung sejak {formatJoinDate}</p>
                {author.bio ? (
                  <p className="max-w-2xl text-sm text-muted-foreground">{author.bio}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Penulis ini belum menambahkan bio.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-3 sm:px-4 sm:py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Artikel Ditulis</p>
                <p className="text-2xl font-semibold text-foreground">{articleCount.toLocaleString("id-ID")}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-3 sm:px-4 sm:py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pembaca Unik</p>
                <p className="text-2xl font-semibold text-foreground">{viewerCount.toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-6">
              <h2 className="text-lg font-semibold">Media Sosial</h2>
              {socialLinks.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-3">
                  {socialLinks.map((entry) => (
                    <li key={entry.key}>
                      <Link
                        href={entry.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-3 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                      >
                        <entry.icon className="h-4 w-4 transition group-hover:scale-105" />
                        <div className="flex flex-col leading-tight">
                          <span>{entry.label}</span>
                          {entry.display ? (
                            <span className="text-xs font-normal text-muted-foreground">{entry.display}</span>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Penulis belum menautkan media sosial. Hubungi redaksi untuk menambahkan informasi.
                </p>
              )}
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Tulisan {author.name}</h2>
              <span className="text-sm text-muted-foreground">
                {articleCount > 0 ? `${articleCount} artikel` : "Belum ada artikel"}
              </span>
            </div>
            <ArticleLoadMoreList
              initialArticles={initialArticles}
              totalCount={totalCount}
              loadSize={LOAD_MORE_LIMIT}
              request={{ mode: "author", authorId }}
              emptyState={
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/80 p-6 text-center text-sm text-muted-foreground">
                  Penulis ini belum memiliki artikel yang dipublikasikan.
                </div>
              }
            />
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-2.5 text-primary-foreground sm:px-5 sm:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em]">Sorotan Terbaru</p>
              <h2 className="text-lg font-semibold">Artikel Pilihan Hari Ini</h2>
            </div>
            <div className="space-y-2.5 px-3 py-3 sm:px-5 sm:py-3.5">
              {sidebarLatestList.length > 0 ? (
                sidebarLatestList.map((item) => {
                  const fallbackInitial = item.title.trim().charAt(0).toUpperCase() || "R";
                  return (
                    <Link
                      key={item.id}
                      href={`/articles/${item.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 sm:p-0 transition hover:border-primary/60 hover:bg-primary/5"
                    >
                      {item.thumbnail ? (
                        <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border/60 sm:h-18 sm:w-28">
                          <Image
                            src={item.thumbnail}
                            alt={item.featuredMedia?.title ?? item.title}
                            fill
                            className="object-cover transition duration-500 group-hover:scale-105"
                            sizes="(min-width: 640px) 112px, 96px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-primary/10 text-xl font-semibold text-primary sm:h-18 sm:w-28">
                          {fallbackInitial}
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition group-hover:text-primary">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.publishedAt)}</p>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada artikel lain yang tersedia saat ini.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
              <span className="inline-flex h-8 w-1 rounded-full bg-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold leading-tight">Populer Minggu Ini</h2>
                <p className="text-xs text-muted-foreground">Berdasarkan kunjungan unik 7 hari terakhir.</p>
              </div>
            </div>
            {sidebarPopularList.length > 0 ? (
              <ol className="divide-y divide-border/60">
                {sidebarPopularList.map((entry, index) => {
                  const fallbackInitial = entry.article.title.trim().charAt(0).toUpperCase() || "R";
                  return (
                    <li key={entry.article.id} className="flex gap-3 px-4 py-3 sm:px-5 sm:py-4">
                      <span className="min-w-[2.5rem] text-2xl font-bold leading-none text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Link
                        href={`/articles/${entry.article.slug}`}
                        className="group flex flex-1 items-center gap-3"
                      >
                        {entry.thumbnail ? (
                          <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border/60">
                            <Image
                              src={entry.thumbnail}
                              alt={entry.article.featuredMedia?.title ?? entry.article.title}
                              fill
                              className="object-cover transition duration-500 group-hover:scale-105"
                              sizes="(min-width: 1024px) 96px, 80px"
                            />
                          </div>
                        ) : (
                          <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-primary/10 text-lg font-semibold text-primary">
                            {fallbackInitial}
                          </div>
                        )}
                        <div className="min-w-0 space-y-1">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition group-hover:text-primary">
                            {entry.article.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{getPrimaryCategory(entry.article)}</span>
                            <span aria-hidden>•</span>
                            <span>{formatDate(entry.article.publishedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 sm:py-6">Data kunjungan belum tersedia. Silakan kembali lagi nanti.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
              <span className="inline-flex h-8 w-1 rounded-full bg-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold leading-tight">Topik Pilihan</h2>
                <p className="text-xs text-muted-foreground">Hashtag populer untuk eksplorasi cepat.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 px-4 py-3 sm:px-5 sm:py-4">
              {popularTags.length > 0 ? (
                popularTags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary"
                  >
                    #{tag.name}
                    <span className="text-[10px] text-muted-foreground">{tag._count.articles.toLocaleString("id-ID")}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada tag populer.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
