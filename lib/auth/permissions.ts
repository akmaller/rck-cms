import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const RoleHierarchy = {
  ADMIN: 3,
  EDITOR: 2,
  AUTHOR: 1,
} as const;

export type RoleKey = keyof typeof RoleHierarchy;

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function assertRole(required: RoleKey | RoleKey[]) {
  const session = await requireAuth();
  const userRole = (session.user.role ?? "") as RoleKey;
  const roles = Array.isArray(required) ? required : [required];
  const allowed = roles.some((role) => RoleHierarchy[userRole] >= RoleHierarchy[role]);

  if (!allowed) {
    throw new Error("Forbidden");
  }

  return session;
}

export async function assertArticleOwnership(articleId: string) {
  const session = await requireAuth();
  const role = (session.user.role ?? "") as RoleKey;

  if (role === "ADMIN" || role === "EDITOR") {
    return session;
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { authorId: true },
  });

  if (!article || article.authorId !== session.user.id) {
    throw new Error("Forbidden");
  }

  return session;
}

export async function assertMediaOwnership(mediaId: string) {
  const session = await requireAuth();
  const role = (session.user.role ?? "") as RoleKey;

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      createdById: true,
      storageType: true,
      fileName: true,
      title: true,
      description: true,
    },
  });

  if (!media) {
    throw new Error("NotFound");
  }

  if (role === "ADMIN" || role === "EDITOR" || media.createdById === session.user.id) {
    return { session, media };
  }

  throw new Error("Forbidden");
}
