import { ArticleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { notifyFollowersAboutPublishedArticle } from "@/lib/follows/service";
import { enqueueSocialPostJobsForArticle } from "@/lib/social/queue";

export type PublishSchedulerResult = {
  updated: number;
  slugs: string[];
};

export async function publishDueScheduledArticles(): Promise<PublishSchedulerResult> {
  // During `next build`/prerender, avoid write transactions so static generation
  // does not fail when DB is saturated or transaction pool is unavailable.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return { updated: 0, slugs: [] };
  }

  const now = new Date();
  let publishedArticleIds: string[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dueArticles = await tx.article.findMany({
        where: {
          status: ArticleStatus.SCHEDULED,
          publishedAt: { lte: now },
        },
        select: { id: true, slug: true, authorId: true },
      });

      if (dueArticles.length === 0) {
        return { updated: 0, slugs: [] };
      }

      publishedArticleIds = dueArticles.map((article) => article.id);
      const articleIds = dueArticles.map((article) => article.id);
      await tx.article.updateMany({
        where: { id: { in: articleIds } },
        data: { status: ArticleStatus.PUBLISHED },
      });

      for (const article of dueArticles) {
        await notifyFollowersAboutPublishedArticle(
          {
            articleId: article.id,
            authorId: article.authorId,
          },
          tx
        );
      }

      return {
        updated: dueArticles.length,
        slugs: dueArticles.map((article) => article.slug).filter((slug): slug is string => Boolean(slug)),
      };
    });

    for (const articleId of publishedArticleIds) {
      await enqueueSocialPostJobsForArticle(articleId);
    }

    return result;
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;
    if (code === "P2028") {
      return { updated: 0, slugs: [] };
    }
    throw error;
  }
}
