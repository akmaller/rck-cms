import { ArticleStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const POPULAR_LOOKBACK_DAYS = 7;

export const sidebarArticleInclude = {
  categories: {
    include: { category: true },
    orderBy: { assignedAt: "asc" as const },
  },
  featuredMedia: {
    select: {
      url: true,
      title: true,
      description: true,
      width: true,
      height: true,
      thumbnailUrl: true,
      mimeType: true,
      thumbnailWidth: true,
      thumbnailHeight: true,
    },
  },
} satisfies Prisma.ArticleInclude;

export type SidebarArticle = Prisma.ArticleGetPayload<{ include: typeof sidebarArticleInclude }>;

export async function getArticleSidebarData(options?: { excludeSlug?: string; relatedCategoryIds?: string[] }) {
  const excludeSlug = options?.excludeSlug ?? null;
  const relatedCategoryIds = options?.relatedCategoryIds?.filter(Boolean) ?? [];

  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - POPULAR_LOOKBACK_DAYS);

  type VisitAggregateRow = { path: string; total: bigint };
  const [latestSidebarRaw, popularVisitRows, popularTags, relatedSidebarRaw] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        slug: excludeSlug ? { not: excludeSlug } : undefined,
      },
      include: sidebarArticleInclude,
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
    prisma.$queryRaw<VisitAggregateRow[]>(
      Prisma.sql`
        SELECT "path", COUNT(DISTINCT "ip")::bigint AS total
        FROM "VisitLog"
        WHERE "createdAt" >= ${lookbackStart}
          AND "path" LIKE '/articles/%'
          AND "ip" IS NOT NULL
        GROUP BY "path"
        ORDER BY COUNT(DISTINCT "ip") DESC
        LIMIT 40
      `
    ),
    prisma.tag.findMany({
      orderBy: { articles: { _count: "desc" } },
      take: 10,
      include: { _count: { select: { articles: true } } },
    }),
    relatedCategoryIds.length
      ? prisma.article.findMany({
          where: {
            status: ArticleStatus.PUBLISHED,
            slug: excludeSlug ? { not: excludeSlug } : undefined,
            categories: {
              some: {
                categoryId: { in: relatedCategoryIds },
              },
            },
          },
          include: sidebarArticleInclude,
          orderBy: [
            { publishedAt: "desc" },
            { createdAt: "desc" },
          ],
          take: 8,
        })
      : Promise.resolve([] as SidebarArticle[]),
  ]);

  const latestSidebarArticles = latestSidebarRaw.slice(0, 4);
  const relatedSidebarArticles = relatedSidebarRaw.slice(0, 4);

  const visitCounts = new Map<string, number>();
  for (const entry of popularVisitRows) {
    const extractedSlug = entry.path.replace(/^\/articles\//, "").split("/")[0];
    if (!extractedSlug || extractedSlug === excludeSlug) continue;
    visitCounts.set(extractedSlug, Number(entry.total));
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

  return {
    latestSidebarArticles,
    popularSidebarArticles,
    popularTags,
    relatedSidebarArticles,
  };
}
