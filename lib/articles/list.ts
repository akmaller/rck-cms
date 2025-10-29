import { Prisma } from "@prisma/client";

import { deriveThumbnailUrl } from "@/lib/storage/media";

export const articleListInclude = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  categories: { include: { category: true }, orderBy: { assignedAt: "asc" as const } },
  featuredMedia: {
    select: { url: true, title: true, description: true, width: true, height: true },
  },
} satisfies Prisma.ArticleInclude;

export type ArticleListEntity = Prisma.ArticleGetPayload<{ include: typeof articleListInclude }>;

export type ArticleListEntry = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  category: { name: string; slug: string } | null;
  image: { url: string; alt: string | null } | null;
};

export function serializeArticleForList(
  article: ArticleListEntity,
  options?: { overrideCategory?: { name: string; slug: string } | null }
): ArticleListEntry {
  const category =
    options?.overrideCategory ??
    (article.categories[0]?.category
      ? {
          name: article.categories[0].category.name,
          slug: article.categories[0].category.slug,
        }
      : null);

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt ?? null,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    authorName: article.author?.name ?? null,
    authorAvatarUrl: article.author?.avatarUrl ?? null,
    category,
    image: (() => {
      const url = article.featuredMedia?.url ?? null;
      if (!url) return null;
      const derived = deriveThumbnailUrl(url) ?? url;
      return {
        url: derived,
        alt: article.featuredMedia?.title ?? article.title,
      };
    })(),
  };
}
