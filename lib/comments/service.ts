import { randomUUID } from "node:crypto";

import { ArticleStatus, CommentStatus, Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/log";
import { isRateLimited } from "@/lib/rate-limit";
import { getPrismaClient } from "@/lib/security/prisma-client";
import { getSiteConfig } from "@/lib/site-config/server";
import { commentCreateSchema } from "@/lib/validators/comment";
import { detectForbiddenPhrase } from "@/lib/moderation/forbidden-terms";

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
  replies: ArticleComment[];
};

type CommentRowSelect = Prisma.CommentGetPayload<{
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
      select: {
        id: true;
        name: true;
        avatarUrl: true;
      };
    };
  };
}>;

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

function buildCommentTree(rows: CommentRowSelect[]): ArticleComment[] {
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

export async function getArticleComments(articleId: string) {
  const prisma = await getPrismaClient();
  if (!prisma) {
    return [];
  }

  const commentDelegate = (prisma as {
    comment?: { findMany: typeof prisma.comment.findMany };
  }).comment;

  if (commentDelegate?.findMany) {
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
    return buildCommentTree(rows as CommentRowSelect[]);
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

  const mapped: CommentRowSelect[] = rows.map((row) => ({
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
  }));

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
}) {
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

  let parentComment: { id: string; parentId: string | null } | null = null;
  if (targetParentId) {
    parentComment = await prisma.comment.findFirst({
      where: {
        id: targetParentId,
        articleId: params.articleId,
        status: ENUM_STATUS_PUBLISHED,
      },
      select: { id: true, parentId: true },
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
    return created;
  }

  // Fallback when Prisma client belum digenerate ulang.
  const statusLiteral = Prisma.raw(`'${RAW_STATUS_PUBLISHED}'::"CommentStatus"`);
  const generatedId = randomUUID();
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "Comment" ("id", "articleId", "userId", "content", "status", "ipAddress", "userAgent", "parentId")
      VALUES (${generatedId}, ${params.articleId}, ${params.userId}, ${sanitizedContent}, ${statusLiteral}, ${sanitizedIp}, ${sanitizedAgent}, ${parentComment?.id ?? null})
    `
  );

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

  return null;
}
