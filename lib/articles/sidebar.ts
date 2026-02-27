import { unstable_cache } from "next/cache";
import { ArticleStatus, Prisma } from "@prisma/client";

import { getTopArticlePathsByUniqueVisitors } from "@/lib/analytics/article-visit-summary";
import { prisma } from "@/lib/prisma";

export const POPULAR_LOOKBACK_DAYS = 7;
const SIDEBAR_CACHE_TTL_SECONDS = 120;

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

type SidebarBaseData = {
  latestSidebarRaw: SidebarArticle[];
  popularSidebarRaw: SidebarArticle[];
  popularTags: Array<{
    id: string;
    name: string;
    slug: string;
    _count: { articles: number };
  }>;
};

const getSidebarBaseData = unstable_cache(
  async (): Promise<SidebarBaseData> => {
    const [latestSidebarRaw, popularPaths, popularTags] = await Promise.all([
      prisma.article.findMany({
        where: { status: ArticleStatus.PUBLISHED },
        include: sidebarArticleInclude,
        orderBy: { publishedAt: "desc" },
        take: 8,
      }),
      getTopArticlePathsByUniqueVisitors(POPULAR_LOOKBACK_DAYS, 60),
      prisma.tag.findMany({
        orderBy: { articles: { _count: "desc" } },
        take: 10,
        include: { _count: { select: { articles: true } } },
      }),
    ]);

    const popularRankedSlugs = popularPaths
      .map((path) => path.replace(/^\/articles\//, "").split("/")[0])
      .filter((slug): slug is string => Boolean(slug))
      .slice(0, 16);

    const popularSidebarRaw = popularRankedSlugs.length
      ? await prisma.article.findMany({
          where: {
            status: ArticleStatus.PUBLISHED,
            slug: { in: popularRankedSlugs },
          },
          include: sidebarArticleInclude,
        })
      : [];

    return {
      latestSidebarRaw,
      popularSidebarRaw,
      popularTags,
    };
  },
  ["article-sidebar-base"],
  {
    tags: ["content"],
    revalidate: SIDEBAR_CACHE_TTL_SECONDS,
  }
);

const getRelatedSidebarData = unstable_cache(
  async (relatedCategoryIds: string[]): Promise<SidebarArticle[]> => {
    if (relatedCategoryIds.length === 0) {
      return [];
    }

    return prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
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
      take: 12,
    });
  },
  ["article-sidebar-related"],
  {
    tags: ["content"],
    revalidate: SIDEBAR_CACHE_TTL_SECONDS,
  }
);

export async function getArticleSidebarData(options?: { excludeSlug?: string; relatedCategoryIds?: string[] }) {
  const excludeSlug = options?.excludeSlug ?? null;
  const relatedCategoryIds = Array.from(new Set(options?.relatedCategoryIds?.filter(Boolean) ?? []));
  relatedCategoryIds.sort();

  const [baseData, relatedSidebarRaw] = await Promise.all([
    getSidebarBaseData(),
    relatedCategoryIds.length ? getRelatedSidebarData(relatedCategoryIds) : Promise.resolve([] as SidebarArticle[]),
  ]);

  const latestSidebarArticles = baseData.latestSidebarRaw
    .filter((item) => item.slug !== excludeSlug)
    .slice(0, 4);
  const relatedSidebarArticles = relatedSidebarRaw
    .filter((item) => item.slug !== excludeSlug)
    .slice(0, 4);
  const popularSidebarArticles = baseData.popularSidebarRaw
    .filter((item) => item.slug !== excludeSlug)
    .slice(0, 4)
    .map((article) => ({ article }));

  return {
    latestSidebarArticles,
    popularSidebarArticles,
    popularTags: baseData.popularTags,
    relatedSidebarArticles,
  };
}
