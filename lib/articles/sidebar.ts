import { ArticleStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const POPULAR_LOOKBACK_DAYS = 7;

export const sidebarArticleInclude = {
  categories: {
    include: { category: true },
    orderBy: { assignedAt: "asc" as const },
  },
  featuredMedia: {
    select: { url: true, title: true, description: true, width: true, height: true },
  },
} satisfies Prisma.ArticleInclude;

export type SidebarArticle = Prisma.ArticleGetPayload<{ include: typeof sidebarArticleInclude }>;

export async function getArticleSidebarData(options?: { excludeSlug?: string; relatedCategoryIds?: string[] }) {
  const excludeSlug = options?.excludeSlug ?? null;
  const relatedCategoryIds = options?.relatedCategoryIds?.filter(Boolean) ?? [];

  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - POPULAR_LOOKBACK_DAYS);

  const [latestSidebarRaw, uniqueVisits, popularTags, relatedSidebarRaw] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        slug: excludeSlug ? { not: excludeSlug } : undefined,
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
  for (const entry of uniqueVisits) {
    const ip = entry.ip?.trim();
    if (!ip) continue;
    const extractedSlug = entry.path.replace(/^\/articles\//, "").split("/")[0];
    if (!extractedSlug || extractedSlug === excludeSlug) continue;
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

  return {
    latestSidebarArticles,
    popularSidebarArticles,
    popularTags,
    relatedSidebarArticles,
  };
}
