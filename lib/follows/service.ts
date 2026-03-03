import { NotificationType, Prisma, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "@/lib/security/prisma-client";
import { createNotification } from "@/lib/notifications/service";

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

type ToggleAuthorFollowParams = {
  authorId: string;
  followerId: string;
};

type ToggleAuthorFollowResult = {
  following: boolean;
  followerCount: number;
};

function isRelationUnavailable(error: unknown) {
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

export async function getAuthorFollowSummary(authorId: string, viewerId?: string | null) {
  let prisma: PrismaClientLike;
  try {
    prisma = await resolveClient();
  } catch (error) {
    if (error instanceof Error && error.message === "TARGET_UNAVAILABLE") {
      return { followerCount: 0, viewerFollows: false };
    }
    throw error;
  }

  try {
    const [followerCount, viewerFollows] = await Promise.all([
      prisma.userFollow.count({ where: { followingId: authorId } }),
      viewerId && viewerId !== authorId
        ? prisma.userFollow
            .findUnique({
              where: {
                followerId_followingId: {
                  followerId: viewerId,
                  followingId: authorId,
                },
              },
              select: { id: true },
            })
            .then((follow) => Boolean(follow))
        : Promise.resolve(false),
    ]);

    return { followerCount, viewerFollows };
  } catch (error) {
    if (isRelationUnavailable(error)) {
      return { followerCount: 0, viewerFollows: false };
    }
    throw error;
  }
}

export async function toggleAuthorFollow(
  params: ToggleAuthorFollowParams,
  client?: PrismaClientLike
): Promise<ToggleAuthorFollowResult> {
  if (params.authorId === params.followerId) {
    throw new Error("SELF_FOLLOW_NOT_ALLOWED");
  }

  const prisma = await resolveClient(client);

  const executeToggle = async (tx: PrismaClientLike): Promise<ToggleAuthorFollowResult> => {
    const author = await tx.user.findUnique({
      where: { id: params.authorId },
      select: { id: true },
    });

    if (!author) {
      throw new Error("TARGET_UNAVAILABLE");
    }

    const existing = await tx.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: params.followerId,
          followingId: params.authorId,
        },
      },
      select: { id: true },
    });

    let following = false;
    if (existing) {
      await tx.userFollow.delete({ where: { id: existing.id } });
    } else {
      await tx.userFollow.create({
        data: {
          followerId: params.followerId,
          followingId: params.authorId,
        },
      });
      following = true;
      await createNotification(
        {
          recipientId: params.authorId,
          actorId: params.followerId,
          type: "USER_FOLLOWED" as NotificationType,
        },
        tx
      );
    }

    const followerCount = await tx.userFollow.count({
      where: { followingId: params.authorId },
    });

    return { following, followerCount };
  };

  try {
    if ("$transaction" in prisma && typeof prisma.$transaction === "function") {
      return await prisma.$transaction((tx) => executeToggle(tx));
    }
    return await executeToggle(prisma);
  } catch (error) {
    if (isRelationUnavailable(error)) {
      throw new Error("FOLLOW_TABLE_UNAVAILABLE");
    }
    throw error;
  }
}

export async function notifyFollowersAboutPublishedArticle(
  params: { articleId: string; authorId: string },
  client?: PrismaClientLike
) {
  let prisma: PrismaClientLike;
  try {
    prisma = await resolveClient(client);
  } catch (error) {
    if (error instanceof Error && error.message === "TARGET_UNAVAILABLE") {
      return;
    }
    throw error;
  }

  try {
    const followers = await prisma.userFollow.findMany({
      where: { followingId: params.authorId },
      select: { followerId: true },
    });

    if (followers.length === 0) {
      return;
    }

    const data = followers
      .filter((entry) => entry.followerId !== params.authorId)
      .map((entry) => ({
        userId: entry.followerId,
        actorId: params.authorId,
        type: NotificationType.ARTICLE_PUBLISHED,
        articleId: params.articleId,
        commentId: null,
      }));

    if (data.length === 0) {
      return;
    }

    if ("notification" in prisma && prisma.notification?.createMany) {
      await prisma.notification.createMany({ data });
      return;
    }

    await Promise.all(
      data.map((item) =>
        prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO "Notification" ("userId", "actorId", "type", "articleId", "commentId")
            VALUES (${item.userId}, ${item.actorId}, ${Prisma.raw(`'${item.type}'::"NotificationType"`)}, ${item.articleId}, NULL)
          `
        )
      )
    );
  } catch (error) {
    if (isRelationUnavailable(error)) {
      return;
    }
    console.error("Failed to notify followers about published article", error);
  }
}
