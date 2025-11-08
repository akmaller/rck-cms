import { ArticleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PublishSchedulerResult = {
  updated: number;
  slugs: string[];
};

export async function publishDueScheduledArticles(): Promise<PublishSchedulerResult> {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const dueArticles = await tx.article.findMany({
      where: {
        status: ArticleStatus.SCHEDULED,
        publishedAt: { lte: now },
      },
      select: { id: true, slug: true },
    });

    if (dueArticles.length === 0) {
      return { updated: 0, slugs: [] };
    }

    const articleIds = dueArticles.map((article) => article.id);
    await tx.article.updateMany({
      where: { id: { in: articleIds } },
      data: { status: ArticleStatus.PUBLISHED },
    });

    return {
      updated: dueArticles.length,
      slugs: dueArticles.map((article) => article.slug).filter((slug): slug is string => Boolean(slug)),
    };
  });

  return result;
}
