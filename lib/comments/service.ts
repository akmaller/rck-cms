import { randomUUID } from "node:crypto";

import { ArticleStatus, CommentStatus, Prisma, NotificationType } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/log";
import { isRateLimited } from "@/lib/rate-limit";
import { getPrismaClient } from "@/lib/security/prisma-client";
import { getSiteConfig } from "@/lib/site-config/server";
import { commentCreateSchema } from "@/lib/validators/comment";
import { detectForbiddenPhrase } from "@/lib/moderation/forbidden-terms";
import { createNotification } from "@/lib/notifications/service";

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const RAW_STATUS_PUBLISHED =
  typeof CommentStatus === "object" && CommentStatus && "PUBLISHED" in CommentStatus
    ? (CommentStatus as Record<string, string>).PUBLISHED
    : "PUBLISHED";
const ENUM_STATUS_PUBLISHED =
  (typeof CommentStatus === "object" && CommentStatus && "PUBLISHED" in CommentStatus
    ? (CommentStatus as Record<string, CommentStatus>).PUBLISHED
    : undefined) ?? (("PUBLISHED" as unknown) as CommentStatus);

export type ArticleCommentUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type ArticleComment = {
  id: string;
  articleId: string;
  userId: string;
  parentId: string | null;
  content: string;
  status: CommentStatus;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: ArticleCommentUser;
  likeCount: number;
  viewerHasLiked: boolean;
  replies: ArticleComment[];
};

type CommentNodeInput = {
  id: string;
  articleId: string;
  userId: string;
  parentId: string | null;
  content: string;
  status: CommentStatus;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: ArticleCommentUser;
  likeCount: number;
  viewerHasLiked: boolean;
};

function isLikesTableUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2026";
}

export function sanitizeCommentContent(input: string): string {
  const normalized = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  const strippedControl = normalized
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(ZERO_WIDTH_REGEX, "");

  return strippedControl.replace(/[<>&]/g, (char) => {
    if (char === "<") return "‹";
    if (char === ">") return "›";
    return "＆";
  });
}

export function sanitizeMetadata(value: string | null | undefined, maxLength = 255): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = trimmed
    .replace(/[\r\n\t]+/g, " ")
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(ZERO_WIDTH_REGEX, "");
  return cleaned.slice(0, maxLength);
}

function buildCommentTree(rows: CommentNodeInput[]): ArticleComment[] {
  const nodes = new Map<string, ArticleComment>();
  const roots: ArticleComment[] = [];

  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      articleId: row.articleId,
      userId: row.userId,
      parentId: row.parentId ?? null,
      content: row.content,
      status: row.status,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.user.id,
        name: row.user.name,
        avatarUrl: row.user.avatarUrl,
      },
      likeCount: row.likeCount,
      viewerHasLiked: row.viewerHasLiked,
      replies: [],
    });
  }

  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (items: ArticleComment[]) => {
    items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const item of items) {
      if (item.replies.length) {
        sortTree(item.replies);
      }
    }
  };

  sortTree(roots);
  return roots;
}

export async function getArticleComments(articleId: string, viewerUserId?: string | null) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return [];
  }

  const commentDelegate = (prisma as {
    comment?: { findMany: typeof prisma.comment.findMany };
  }).comment;

  if (commentDelegate?.findMany) {
    type CommentQueryRow = Prisma.CommentGetPayload<{
      select: {
        id: true;
        articleId: true;
        userId: true;
        parentId: true;
        content: true;
        status: true;
        ipAddress: true;
        userAgent: true;
        createdAt: true;
        updatedAt: true;
        user: {
          select: { id: true, name: true, avatarUrl: true };
        };
        _count: { select: { likes: true } };
        likes: { select: { userId: true } };
      };
    }>;

    try {
      const rows = (await commentDelegate.findMany({
        where: {
          articleId,
          status: ENUM_STATUS_PUBLISHED,
        },
        select: {
          id: true,
          articleId: true,
          userId: true,
          parentId: true,
          content: true,
          status: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: { select: { likes: true } },
          ...(viewerUserId
            ? {
                likes: {
                  where: { userId: viewerUserId },
                  select: { userId: true },
                },
              }
            : {}),
        },
        orderBy: { createdAt: "asc" },
      })) as (CommentQueryRow & { likes?: Array<{ userId: string }> })[];

      const mapped: CommentNodeInput[] = rows.map((row) => ({
        id: row.id,
        articleId: row.articleId,
        userId: row.userId,
        parentId: row.parentId ?? null,
        content: row.content,
        status: row.status,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user: {
          id: row.user.id,
          name: row.user.name,
          avatarUrl: row.user.avatarUrl,
        },
        likeCount: row._count?.likes ?? 0,
        viewerHasLiked: Boolean(viewerUserId && row.likes && row.likes.length > 0),
      }));

      return buildCommentTree(mapped);
    } catch (error) {
      if (!isLikesTableUnavailable(error)) {
        throw error;
      }

      const rows = await commentDelegate.findMany({
        where: {
          articleId,
          status: ENUM_STATUS_PUBLISHED,
        },
        select: {
          id: true,
          articleId: true,
          userId: true,
          parentId: true,
          content: true,
          status: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const mapped: CommentNodeInput[] = rows.map((row) => ({
        id: row.id,
        articleId: row.articleId,
        userId: row.userId,
        parentId: row.parentId ?? null,
        content: row.content,
        status: row.status,
        ipAddress: row.ipAddress ?? null,
        userAgent: row.userAgent ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user: {
          id: row.user.id,
          name: row.user.name,
          avatarUrl: row.user.avatarUrl,
        },
        likeCount: 0,
        viewerHasLiked: false,
      }));

      return buildCommentTree(mapped);
    }
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    articleId: string;
    userId: string;
    parentId: string | null;
    content: string;
    status: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
    user_id: string | null;
    user_name: string | null;
    user_avatarUrl: string | null;
  }>>(
    Prisma.sql`
      SELECT c."id",
             c."articleId",
             c."userId",
             c."parentId",
             c."content",
             c."status",
             c."ipAddress",
             c."userAgent",
             c."createdAt",
             c."updatedAt",
             u."id"   AS user_id,
             u."name" AS user_name,
             u."avatarUrl" AS user_avatarUrl
      FROM "Comment" c
      LEFT JOIN "User" u ON u."id" = c."userId"
      WHERE c."articleId" = ${articleId}
        AND c."status" = ${Prisma.raw(`'${RAW_STATUS_PUBLISHED}'::"CommentStatus"`)}
      ORDER BY c."createdAt" ASC
    `
  );

  const mapped: CommentNodeInput[] = rows.map((row) => ({
    id: row.id,
    articleId: row.articleId,
    userId: row.userId,
    parentId: row.parentId,
    content: row.content,
    status: (row.status as CommentStatus) ?? ENUM_STATUS_PUBLISHED,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: {
      id: row.user_id ?? row.userId,
      name: row.user_name ?? "Pengunjung",
      avatarUrl: row.user_avatarUrl,
    },
    likeCount: 0,
    viewerHasLiked: false,
  }));

  const commentIds = mapped.map((row) => row.id);
  if (commentIds.length > 0) {
    let likeCounts: Array<{
      commentId: string;
      likeCount: bigint;
    }> = [];
    try {
      likeCounts = await prisma.$queryRaw<Array<{
        commentId: string;
        likeCount: bigint;
      }>>(
        Prisma.sql`
          SELECT cl."commentId" AS "commentId", COUNT(*) AS "likeCount"
          FROM "CommentLike" cl
          WHERE cl."commentId" IN (${Prisma.join(commentIds)})
          GROUP BY cl."commentId"
        `
      );
    } catch (error) {
      if (!isLikesTableUnavailable(error)) {
        throw error;
      }
    }
    const countMap = new Map<string, number>();
    for (const entry of likeCounts) {
      countMap.set(entry.commentId, Number(entry.likeCount));
    }
    for (const row of mapped) {
      row.likeCount = countMap.get(row.id) ?? 0;
    }

    if (viewerUserId) {
      let userLikes: Array<{ commentId: string }> = [];
      try {
        userLikes = await prisma.$queryRaw<Array<{ commentId: string }>>(
          Prisma.sql`
            SELECT cl."commentId"
            FROM "CommentLike" cl
            WHERE cl."commentId" IN (${Prisma.join(commentIds)})
              AND cl."userId" = ${viewerUserId}
          `
        );
      } catch (error) {
        if (!isLikesTableUnavailable(error)) {
          throw error;
        }
      }
      const likedSet = new Set(userLikes.map((entry) => entry.commentId));
      for (const row of mapped) {
        row.viewerHasLiked = likedSet.has(row.id);
      }
    }
  }

  return buildCommentTree(mapped);
}

export async function verifyCommentTarget(articleId: string) {
  const prisma = await getPrismaClient();
  if (!prisma?.article) {
    throw new Error("TARGET_UNAVAILABLE");
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, status: true },
  });
  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    throw new Error("TARGET_UNAVAILABLE");
  }
}

export async function ensureCommentRateLimit(key: string, limit: number, windowMs: number) {
  const blocked = await isRateLimited(key, limit, windowMs);
  if (blocked) {
    throw new Error("RATE_LIMITED");
  }
}

export async function createArticleComment(params: {
  articleId: string;
  userId: string;
  content: string;
  parentId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const parsed = commentCreateSchema.parse({
    content: params.content,
    parentId: params.parentId ?? undefined,
  });
  const sanitizedContent = sanitizeCommentContent(parsed.content);
  const targetParentId = parsed.parentId ?? null;

  const forbiddenMatch = await detectForbiddenPhrase(sanitizedContent);
  if (forbiddenMatch) {
    throw new Error(`FORBIDDEN_TERM:${forbiddenMatch.phrase}`);
  }

  if (!sanitizedContent.trim()) {
    throw new Error("EMPTY_COMMENT");
  }

  await verifyCommentTarget(params.articleId);

  const prisma = await getPrismaClient();
  if (!prisma) {
    throw new Error("TARGET_UNAVAILABLE");
  }

  let parentComment: { id: string; parentId: string | null; userId: string } | null = null;
  if (targetParentId) {
    parentComment = await prisma.comment.findFirst({
      where: {
        id: targetParentId,
        articleId: params.articleId,
        status: ENUM_STATUS_PUBLISHED,
      },
      select: { id: true, parentId: true, userId: true },
    });
    if (!parentComment || parentComment.parentId) {
      throw new Error("INVALID_PARENT");
    }
  }

  const config = await getSiteConfig();
  if (!(config?.comments?.enabled ?? true)) {
    throw new Error("COMMENTS_DISABLED");
  }

  const commentDelegate = (prisma as {
    comment?: { create: typeof prisma.comment.create };
  }).comment;
  const sanitizedIp = sanitizeMetadata(params.ipAddress);
  const sanitizedAgent = sanitizeMetadata(params.userAgent, 500);
  const articleOwner = await prisma.article.findUnique({
    where: { id: params.articleId },
    select: { authorId: true },
  });
  if (!articleOwner) {
    throw new Error("TARGET_UNAVAILABLE");
  }

  let createdCommentId: string | null = null;

  if (commentDelegate?.create) {
    const created = await commentDelegate.create({
      data: {
        articleId: params.articleId,
        userId: params.userId,
        content: sanitizedContent,
        status: ENUM_STATUS_PUBLISHED,
        ipAddress: sanitizedIp,
        userAgent: sanitizedAgent,
        parentId: parentComment?.id ?? null,
      },
    });
    createdCommentId = created.id;
    await writeAuditLog({
      action: "comment.create",
      entity: "Comment",
      entityId: created.id,
      metadata: {
        articleId: params.articleId,
        ipAddress: sanitizedIp,
        userAgent: sanitizedAgent,
      },
    });
  } else {
    // Fallback ketika Prisma client belum ter-generate dengan model terbaru.
    const statusLiteral = Prisma.raw(`'${RAW_STATUS_PUBLISHED}'::"CommentStatus"`);
    const generatedId = randomUUID();
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Comment" ("id", "articleId", "userId", "content", "status", "ipAddress", "userAgent", "parentId")
        VALUES (${generatedId}, ${params.articleId}, ${params.userId}, ${sanitizedContent}, ${statusLiteral}, ${sanitizedIp}, ${sanitizedAgent}, ${parentComment?.id ?? null})
      `
    );

    createdCommentId = generatedId;

    await writeAuditLog({
      action: "comment.create",
      entity: "Comment",
      entityId: generatedId,
      metadata: {
        articleId: params.articleId,
        ipAddress: sanitizedIp,
        userAgent: sanitizedAgent,
      },
    });
  }

  if (createdCommentId) {
    const notificationJobs: Promise<unknown>[] = [];
    if (
      articleOwner.authorId &&
      articleOwner.authorId !== params.userId &&
      (!parentComment || parentComment.userId !== articleOwner.authorId)
    ) {
      notificationJobs.push(
        createNotification(
          {
            recipientId: articleOwner.authorId,
            actorId: params.userId,
            type: NotificationType.ARTICLE_COMMENT,
            articleId: params.articleId,
            commentId: createdCommentId,
          },
          prisma
        )
      );
    }
    if (parentComment?.userId && parentComment.userId !== params.userId) {
      notificationJobs.push(
        createNotification(
          {
            recipientId: parentComment.userId,
            actorId: params.userId,
            type: NotificationType.COMMENT_REPLY,
            articleId: params.articleId,
            commentId: createdCommentId,
          },
          prisma
        )
      );
    }
    if (notificationJobs.length) {
      await Promise.allSettled(notificationJobs);
    }
  }

  return;
}
