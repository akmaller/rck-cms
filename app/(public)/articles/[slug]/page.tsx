import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArticleStatus, Prisma } from "@prisma/client";

import Image from "next/image";
import { ArticleViewer } from "@/components/article/article-viewer";
import { buttonVariants } from "@/lib/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { deriveThumbnailUrl } from "@/lib/storage/media";
import { createMetadata } from "@/lib/seo/metadata";
import { logPageView } from "@/lib/visits/log-page-view";

const POPULAR_LOOKBACK_DAYS = 7;

const sidebarArticleInclude = {
  categories: {
    include: { category: true },
    orderBy: { assignedAt: "asc" as const },
  },
  featuredMedia: {
    select: { url: true, title: true, description: true, width: true, height: true },
  },
} satisfies Prisma.ArticleInclude;

type SidebarArticle = Prisma.ArticleGetPayload<{ include: typeof sidebarArticleInclude }>;

async function getArticle(slug: string) {
  return prisma.article.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true } },
      categories: { include: { category: true }, orderBy: { assignedAt: "asc" } },
      tags: { include: { tag: true } },
      featuredMedia: { select: { url: true, title: true, description: true, width: true, height: true } },
    },
  });
}

export async function generateStaticParams() {
  const articles = await prisma.article.findMany({
    where: { status: ArticleStatus.PUBLISHED },
    select: { slug: true },
  });

  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    return createMetadata({
      title: "Artikel tidak ditemukan",
      description: "Konten yang Anda cari tidak tersedia.",
      path: `/articles/${slug}`,
      robots: { index: false, follow: false },
    });
  }

  const categories = article.categories.map((entry) => entry.category.name);
  const tags = article.tags.map((entry) => entry.tag.name);
  const keywords = [...categories, ...tags, article.title];

  return createMetadata({
    title: article.title,
    description: article.excerpt ?? undefined,
    keywords,
    path: `/articles/${slug}`,
    type: "article",
    image: article.featuredMedia
      ? {
          url: article.featuredMedia.url,
          alt: article.featuredMedia.description ?? article.featuredMedia.title ?? article.title,
          width: article.featuredMedia.width ?? undefined,
          height: article.featuredMedia.height ?? undefined,
        }
      : null,
    tags: [...new Set([...categories, ...tags])],
    authors: article.author?.name ? [article.author.name] : undefined,
    publishedTime: article.publishedAt ?? article.createdAt,
    modifiedTime: article.updatedAt,
  });
}

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ArticleDetailPage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    notFound();
  }

  const categories = article.categories.map((item) => item.category);
  const tags = article.tags.map((item) => item.tag);

  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - POPULAR_LOOKBACK_DAYS);

  const [latestSidebarRaw, uniqueVisits, popularTags] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        slug: { not: slug },
      },
      include: sidebarArticleInclude,
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
    prisma.visitLog.findMany({
      where: {
        createdAt: { gte: lookbackStart },
        path: { startsWith: "/articles/" },
        ip: { not: null },
      },
      select: { path: true, ip: true },
      distinct: ["path", "ip"],
    }),
    prisma.tag.findMany({
      orderBy: { articles: { _count: "desc" } },
      take: 10,
      include: { _count: { select: { articles: true } } },
    }),
  ]);

  const latestSidebarArticles = latestSidebarRaw.slice(0, 4);

  const visitCounts = new Map<string, number>();
  for (const entry of uniqueVisits) {
    const ip = entry.ip?.trim();
    if (!ip) continue;
    const extractedSlug = entry.path.replace(/^\/articles\//, "").split("/")[0];
    if (!extractedSlug || extractedSlug === slug) continue;
    visitCounts.set(extractedSlug, (visitCounts.get(extractedSlug) ?? 0) + 1);
  }

  const popularRanked = Array.from(visitCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const popularArticlesRaw = popularRanked.length
    ? await prisma.article.findMany({
        where: {
          status: ArticleStatus.PUBLISHED,
          slug: { in: popularRanked.map(([entrySlug]) => entrySlug) },
        },
        include: sidebarArticleInclude,
      })
    : [];

  const popularSidebarArticles = popularRanked
    .map(([entrySlug]) => {
      const matched = popularArticlesRaw.find((item) => item.slug === entrySlug);
      return matched ? { article: matched } : null;
    })
    .filter((item): item is { article: SidebarArticle } => Boolean(item))
    .slice(0, 4);

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const referrer = headerList.get("referer");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  const path = `/articles/${slug}`;
  const url = host ? `${protocol}://${host}${path}` : undefined;

  await logPageView({
    path,
    url,
    referrer,
    ip,
    userAgent,
  });

  const dateFormatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formatDateLabel = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const value = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(value.getTime())) return "-";
    return dateFormatter.format(value);
  };

  const getPrimaryCategory = (entry: { categories: { category: { name: string } }[] }) =>
    entry.categories[0]?.category.name ?? "Umum";

  const getThumbnailUrl = (entry: { featuredMedia?: { url: string | null } | null }) => {
    const source = entry.featuredMedia?.url ?? null;
    if (!source) return null;
    return deriveThumbnailUrl(source) ?? source;
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="flex flex-col gap-10">
          <header className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{article.title}</h1>
              <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                <span>{(categories.map((category) => category.name).join(" • ") || "Artikel").toUpperCase()}</span>
                <span aria-hidden>•</span>
                <span>{formatDateLabel(article.publishedAt)}</span>
                {article.author ? (
                  <>
                    <span aria-hidden>•</span>
                    <span>
                      oleh{" "}
                      <Link
                        href={`/authors/${article.author.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {article.author.name}
                      </Link>
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </header>

          <div className="space-y-6">
            {article.featuredMedia?.url ? (
              <div className="relative overflow-hidden rounded-xl border border-border/60">
                <Image
                  src={article.featuredMedia.url}
                  alt={article.featuredMedia.description ?? article.featuredMedia.title ?? article.title}
                  width={article.featuredMedia.width ?? 1280}
                  height={article.featuredMedia.height ?? 720}
                  className="h-auto w-full object-cover"
                  priority
                />
                {article.featuredMedia?.description ? (
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-xs font-medium leading-snug text-white sm:px-6 sm:text-sm">
                    {article.featuredMedia.description}
                  </div>
                ) : null}
              </div>
            ) : null}
            <ArticleViewer content={article.content} />
          </div>

          <footer className="space-y-6">
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Bagikan Artikel</CardTitle>
                <CardDescription>Menginspirasi orang lain dengan membagikan tautan ini.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Link
                  className={buttonVariants({ variant: "secondary" })}
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/articles/${article.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Twitter/X
                </Link>
                <Link
                  className={buttonVariants({ variant: "secondary" })}
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/articles/${article.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
                </Link>
              </CardContent>
            </Card>
          </footer>
        </article>

        <aside className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-2.5 text-primary-foreground sm:px-5 sm:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em]">Sorotan Terbaru</p>
              <h2 className="text-lg font-semibold">Artikel Pilihan Hari Ini</h2>
            </div>
            <div className="space-y-2.5 px-3.5 py-3 sm:px-5 sm:py-3.5">
              {latestSidebarArticles.length > 0 ? (
                latestSidebarArticles.map((item) => {
                  const thumbnail = getThumbnailUrl(item);
                  const fallbackInitial = item.title.trim().charAt(0).toUpperCase() || "R";
                  return (
                    <Link
                      key={item.id}
                      href={`/articles/${item.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 sm:p-0 transition hover:border-primary/60 hover:bg-primary/5"
                    >
                      {thumbnail ? (
                        <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border/60 sm:h-18 sm:w-28">
                          <Image
                            src={thumbnail}
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
                        <p className="text-xs text-muted-foreground">{formatDateLabel(item.publishedAt)}</p>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum ada artikel lain yang tersedia saat ini.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
              <span className="inline-flex h-8 w-1 rounded-full bg-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold leading-tight">Populer Minggu Ini</h2>
                <p className="text-xs text-muted-foreground">
                  Berdasarkan kunjungan unik 7 hari terakhir.
                </p>
              </div>
            </div>
            {popularSidebarArticles.length > 0 ? (
              <ol className="divide-y divide-border/60">
                {popularSidebarArticles.map(({ article: popularArticle }, index) => (
                  <li key={popularArticle.id} className="flex gap-3 px-5 py-4">
                    <span className="min-w-[2.5rem] text-2xl font-bold leading-none text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={`/articles/${popularArticle.slug}`}
                        className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition hover:text-primary"
                      >
                        {popularArticle.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{getPrimaryCategory(popularArticle)}</span>
                        <span aria-hidden>•</span>
                        <span>{formatDateLabel(popularArticle.publishedAt)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Data kunjungan belum tersedia. Silakan kembali lagi nanti.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
              <span className="inline-flex h-8 w-1 rounded-full bg-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold leading-tight">Topik Pilihan</h2>
                <p className="text-xs text-muted-foreground">Hashtag populer untuk eksplorasi cepat.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 px-5 py-4">
              {popularTags.length > 0 ? (
                popularTags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug}`}
                    className="inline-flex items-center rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary"
                  >
                    #{tag.name}
                    <span className="ml-1 text-[10px] text-muted-foreground">{tag._count.articles.toLocaleString("id-ID")}</span>
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
