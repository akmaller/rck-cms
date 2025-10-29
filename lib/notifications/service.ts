import { NotificationType, Prisma, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "@/lib/security/prisma-client";

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

export type DashboardNotification = {
  id: string;
  type: NotificationType;
  articleId: string | null;
  commentId: string | null;
  createdAt: Date;
  readAt: Date | null;
  actor: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
  article: {
    id: string;
    slug: string;
    title: string;
  } | null;
  comment: {
    id: string;
    content: string;
    article: {
      id: string;
      slug: string;
      title: string;
    } | null;
  } | null;
};

type CreateNotificationParams = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  articleId?: string | null;
  commentId?: string | null;
};

function isNotificationTableUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2026";
}

async function resolveClient(client?: PrismaClientLike) {
  if (client) {
    return client;
  }
  const prisma = await getPrismaClient();
  if (!prisma) {
    throw new Error("TARGET_UNAVAILABLE");
  }
  return prisma;
}

export async function createNotification(params: CreateNotificationParams, client?: PrismaClientLike) {
  if (!params.recipientId || params.recipientId === params.actorId) {
    return;
  }

  let prisma: PrismaClientLike;
  try {
    prisma = await resolveClient(client);
  } catch (error) {
    if (error instanceof Error && error.message === "TARGET_UNAVAILABLE") {
      return;
    }
    throw error;
  }

  const notificationData = {
    userId: params.recipientId,
    actorId: params.actorId,
    type: params.type,
    articleId: params.articleId ?? null,
    commentId: params.commentId ?? null,
  };

  try {
    if ("notification" in prisma && prisma.notification?.create) {
      await prisma.notification.create({
        data: notificationData,
      });
      return;
    }

    const typeLiteral = Prisma.raw(`'${params.type}'::"NotificationType"`);
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Notification" ("userId", "actorId", "type", "articleId", "commentId")
        VALUES (${params.recipientId}, ${params.actorId}, ${typeLiteral}, ${params.articleId ?? null}, ${
          params.commentId ?? null
        })
      `
    );
  } catch (error) {
    if (isNotificationTableUnavailable(error)) {
      return;
    }
    throw error;
  }
}

export async function getUserNotifications(
  userId: string,
  options: { limit?: number; cursor?: string | null } = {}
): Promise<{
  notifications: DashboardNotification[];
  unreadCount: number;
  nextCursor: string | null;
}> {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return { notifications: [], unreadCount: 0, nextCursor: null };
  }

  const take = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const cursorId = options.cursor ?? null;

  try {
    const [rowsWithCursor, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursorId
          ? {
              cursor: { id: cursorId },
              skip: 1,
            }
          : {}),
        include: {
          actor: { select: { id: true, name: true, avatarUrl: true } },
          article: { select: { id: true, slug: true, title: true } },
          comment: {
            select: {
              id: true,
              content: true,
              articleId: true,
              article: { select: { id: true, slug: true, title: true } },
            },
          },
        },
      }),
      prisma.notification.count({
        where: {
          userId,
          readAt: null,
        },
      }),
    ]);

    let nextCursor: string | null = null;
    let rows = rowsWithCursor;
    if (rowsWithCursor.length > take) {
      const nextItem = rowsWithCursor[rowsWithCursor.length - 1];
      nextCursor = nextItem?.id ?? null;
      rows = rowsWithCursor.slice(0, take);
    }

    const notifications: DashboardNotification[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      articleId: row.articleId,
      commentId: row.commentId,
      createdAt: row.createdAt,
      readAt: row.readAt,
      actor: {
        id: row.actor.id,
        name: row.actor.name,
        avatarUrl: row.actor.avatarUrl,
      },
      article: row.article ?? row.comment?.article ?? null,
      comment: row.comment
        ? {
            id: row.comment.id,
            content: row.comment.content,
            article: row.comment.article
              ? {
                  id: row.comment.article.id,
                  slug: row.comment.article.slug,
                  title: row.comment.article.title,
                }
              : null,
          }
        : null,
    }));

    return { notifications, unreadCount, nextCursor };
  } catch (error) {
    if (isNotificationTableUnavailable(error)) {
      return { notifications: [], unreadCount: 0, nextCursor: null };
    }
    throw error;
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return 0;
  }

  try {
    return await prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  } catch (error) {
    if (isNotificationTableUnavailable(error)) {
      return 0;
    }
    throw error;
  }
}

export async function markNotificationsAsRead(userId: string, notificationIds?: string[]) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return;
  }

  const targetIds = notificationIds?.filter(Boolean) ?? [];

  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(targetIds.length > 0 ? { id: { in: targetIds } } : {}),
      },
      data: {
        readAt: new Date(),
      },
    });
  } catch (error) {
    if (isNotificationTableUnavailable(error)) {
      return;
    }
    throw error;
  }
}
