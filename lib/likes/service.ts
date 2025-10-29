import { ArticleStatus, CommentStatus, NotificationType } from "@prisma/client";

import { getPrismaClient } from "@/lib/security/prisma-client";
import { createNotification } from "@/lib/notifications/service";

type LikeToggleResult = {
  liked: boolean;
  likeCount: number;
};

function isMissingRelationTableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2026";
}

export async function getArticleLikeSummary(articleId: string, userId?: string | null) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return { likeCount: 0, viewerHasLiked: false };
  }

  try {
    const [likeCount, viewerHasLiked] = await Promise.all([
      prisma.articleLike.count({ where: { articleId } }),
      userId
        ? prisma.articleLike
            .findFirst({
              where: { articleId, userId },
              select: { id: true },
            })
            .then((like) => Boolean(like))
        : Promise.resolve(false),
    ]);

    return { likeCount, viewerHasLiked };
  } catch (error) {
    if (isMissingRelationTableError(error)) {
      return { likeCount: 0, viewerHasLiked: false };
    }
    throw error;
  }
}

export async function toggleArticleLike(params: { articleId: string; userId: string }) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    throw new Error("TARGET_UNAVAILABLE");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const article = await tx.article.findUnique({
        where: { id: params.articleId },
        select: { status: true, authorId: true },
      });
      if (!article || article.status !== ArticleStatus.PUBLISHED) {
        throw new Error("TARGET_UNAVAILABLE");
      }

      const existing = await tx.articleLike.findUnique({
        where: {
          articleId_userId: {
            articleId: params.articleId,
            userId: params.userId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await tx.articleLike.delete({ where: { id: existing.id } });
        const likeCount = await tx.articleLike.count({
          where: { articleId: params.articleId },
        });
        return { liked: false, likeCount } satisfies LikeToggleResult;
      }

      await tx.articleLike.create({
        data: {
          articleId: params.articleId,
          userId: params.userId,
        },
      });
      if (article.authorId && article.authorId !== params.userId) {
        await createNotification(
          {
            recipientId: article.authorId,
            actorId: params.userId,
            type: NotificationType.ARTICLE_LIKE,
            articleId: params.articleId,
          },
          tx
        );
      }
      const likeCount = await tx.articleLike.count({
        where: { articleId: params.articleId },
      });
      return { liked: true, likeCount } satisfies LikeToggleResult;
    });

    return result;
  } catch (error) {
    if (isMissingRelationTableError(error)) {
      throw new Error("LIKES_TABLE_UNAVAILABLE");
    }
    throw error;
  }
}

export async function toggleCommentLike(params: { commentId: string; userId: string }) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    throw new Error("TARGET_UNAVAILABLE");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({
        where: { id: params.commentId },
        select: { status: true, userId: true, articleId: true },
      });
      if (!comment || comment.status !== CommentStatus.PUBLISHED) {
        throw new Error("TARGET_UNAVAILABLE");
      }

      const existing = await tx.commentLike.findUnique({
        where: {
          commentId_userId: {
            commentId: params.commentId,
            userId: params.userId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await tx.commentLike.delete({ where: { id: existing.id } });
        const likeCount = await tx.commentLike.count({
          where: { commentId: params.commentId },
        });
        return { liked: false, likeCount } satisfies LikeToggleResult;
      }

      await tx.commentLike.create({
        data: {
          commentId: params.commentId,
          userId: params.userId,
        },
      });
      if (comment.userId && comment.userId !== params.userId) {
        await createNotification(
          {
            recipientId: comment.userId,
            actorId: params.userId,
            type: NotificationType.COMMENT_LIKE,
            articleId: comment.articleId,
            commentId: params.commentId,
          },
          tx
        );
      }
      const likeCount = await tx.commentLike.count({
        where: { commentId: params.commentId },
      });
      return { liked: true, likeCount } satisfies LikeToggleResult;
    });

    return result;
  } catch (error) {
    if (isMissingRelationTableError(error)) {
      throw new Error("LIKES_TABLE_UNAVAILABLE");
    }
    throw error;
  }
}
