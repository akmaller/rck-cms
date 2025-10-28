"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { Prisma, type UserRole } from "@prisma/client";

import { requireAuth } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { userUpdateSchema } from "@/lib/validators/user";
import { writeAuditLog } from "@/lib/audit/log";
import {
  USER_DELETE_TARGET_ANON,
  type DeleteUserArticleStrategy,
  type DeleteUserCommentStrategy,
  type DeleteUserOptions,
} from "./delete-user-types";

function sanitize(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function updateUserAction(userId: string, formData: FormData) {
  try {
    const session = await requireAuth();
    if ((session.user.role ?? "") !== "ADMIN") {
      return { success: false, message: "Hanya Administrator yang dapat memperbarui pengguna." };
    }

    const payload = {
      name: sanitize(formData.get("name")),
      email: sanitize(formData.get("email")),
      role: sanitize(formData.get("role")),
      password: sanitize(formData.get("password")),
    };

    const emailVerifiedRaw = formData.get("emailVerified");
    const canPublishRaw = formData.get("canPublish");
    const emailVerifiedSetting =
      emailVerifiedRaw === "true" ? true : emailVerifiedRaw === "false" ? false : undefined;
    const canPublishSetting =
      canPublishRaw === "true" ? true : canPublishRaw === "false" ? false : undefined;

    const parsed = userUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Data pengguna tidak valid.",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }

    if (parsed.data.email && parsed.data.email !== targetUser.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (emailTaken && emailTaken.id !== userId) {
        return { success: false, message: "Email sudah digunakan oleh pengguna lain." };
      }
    }

    const data: {
      name?: string;
      email?: string;
      role?: UserRole;
      passwordHash?: string;
      emailVerified?: Date | null;
    } = {};

    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.email) data.email = parsed.data.email;
    if (parsed.data.role) data.role = parsed.data.role as UserRole;
    if (parsed.data.password) {
      data.passwordHash = await hashPassword(parsed.data.password);
    }
    if (typeof emailVerifiedSetting === "boolean") {
      data.emailVerified = emailVerifiedSetting
        ? targetUser.emailVerified ?? new Date()
        : null;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    if (typeof canPublishSetting === "boolean" && canPublishSetting !== targetUser.canPublish) {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "canPublish" = ${canPublishSetting ? "TRUE" : "FALSE"} WHERE "id" = $1`,
        userId,
      );
    }

    const refreshedUser = await prisma.user.findUnique({ where: { id: userId } });

    await writeAuditLog({
      action: "USER_UPDATE",
      entity: "User",
      entityId: updated.id,
      metadata: {
        email: refreshedUser?.email ?? updated.email,
        role: refreshedUser?.role ?? updated.role,
        updatedBy: session.user.id,
        emailVerified: refreshedUser?.emailVerified ?? updated.emailVerified,
        canPublish: refreshedUser?.canPublish ?? targetUser.canPublish,
      },
    });

    revalidatePath("/dashboard/users");
    revalidatePath(`/dashboard/users/${userId}`);

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal memperbarui pengguna." };
  }
}

type DeleteActionResult =
  | { success: true; message?: string }
  | { success: false; message: string };

const ANON_EMAIL = "anonim@system.local";
const ANON_NAME = "Pengguna Anonim";

async function ensureAnonymousUser(tx: Prisma.TransactionClient) {
  const existing = await tx.user.findUnique({
    where: { email: ANON_EMAIL },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const randomPassword = randomUUID();
  const passwordHash = await hashPassword(randomPassword);

  const created = await tx.user.create({
    data: {
      email: ANON_EMAIL,
      name: ANON_NAME,
      role: "AUTHOR",
      passwordHash,
      canPublish: false,
    },
    select: { id: true },
  });
  return created.id;
}

async function resolveTransferTarget(
  tx: Prisma.TransactionClient,
  requestedTarget: string,
  fallbackUserId: string,
  userBeingDeletedId: string,
) {
  if (!requestedTarget) {
    requestedTarget = fallbackUserId;
  }

  if (requestedTarget === USER_DELETE_TARGET_ANON) {
    return ensureAnonymousUser(tx);
  }

  if (requestedTarget === userBeingDeletedId) {
    throw new Error("TARGET_SAME_AS_SOURCE");
  }

  const target = await tx.user.findUnique({
    where: { id: requestedTarget },
    select: { id: true },
  });
  if (!target) {
    throw new Error("TARGET_USER_NOT_FOUND");
  }
  return target.id;
}

function normalizeCommentStrategy(
  strategy: DeleteUserCommentStrategy | undefined,
  fallbackUserId: string,
): DeleteUserCommentStrategy {
  if (!strategy) {
    return { mode: "transfer", targetUserId: fallbackUserId };
  }
  if (strategy.mode === "transfer" && !strategy.targetUserId) {
    return { mode: "transfer", targetUserId: fallbackUserId };
  }
  return strategy;
}

function normalizeArticleStrategy(
  strategy: DeleteUserArticleStrategy | undefined,
  fallbackUserId: string,
): DeleteUserArticleStrategy {
  if (!strategy) {
    return { mode: "transfer", targetUserId: fallbackUserId };
  }
  if (strategy.mode === "transfer" && !strategy.targetUserId) {
    return { mode: "transfer", targetUserId: fallbackUserId };
  }
  return strategy;
}

export async function deleteUserAction(
  userId: string,
  options?: DeleteUserOptions,
): Promise<DeleteActionResult> {
  try {
    const session = await requireAuth();
    if ((session.user.role ?? "") !== "ADMIN") {
      return { success: false, message: "Hanya Administrator yang dapat menghapus pengguna." };
    }

    if (userId === session.user.id) {
      return { success: false, message: "Tidak dapat menghapus akun Anda sendiri." };
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }

    const commentStrategy = normalizeCommentStrategy(options?.commentStrategy, session.user.id);
    const articleStrategy = normalizeArticleStrategy(options?.articleStrategy, session.user.id);

    await prisma.$transaction(async (tx) => {
      if (commentStrategy.mode === "delete") {
        await tx.comment.deleteMany({ where: { userId: targetUser.id } });
      } else {
        const commentTarget = await resolveTransferTarget(
          tx,
          commentStrategy.targetUserId,
          session.user.id,
          targetUser.id,
        );
        await tx.comment.updateMany({
          where: { userId: targetUser.id },
          data: { userId: commentTarget },
        });
      }

      if (articleStrategy.mode === "delete") {
        await tx.article.deleteMany({ where: { authorId: targetUser.id } });
      } else {
        const articleTarget = await resolveTransferTarget(
          tx,
          articleStrategy.targetUserId,
          session.user.id,
          targetUser.id,
        );
        await tx.article.updateMany({
          where: { authorId: targetUser.id },
          data: { authorId: articleTarget },
        });
      }

      await tx.user.delete({ where: { id: targetUser.id } });
    });

    await writeAuditLog({
      action: "USER_DELETE",
      entity: "User",
      entityId: targetUser.id,
      metadata: {
        email: targetUser.email,
        deletedBy: session.user.id,
        commentStrategy,
        articleStrategy,
      },
    });

    revalidatePath("/dashboard/users");

    return { success: true, message: "Pengguna dihapus." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal menghapus pengguna." };
  }
}

export async function resetTwoFactorAction(userId: string) {
  try {
    const session = await requireAuth();
    if ((session.user.role ?? "") !== "ADMIN") {
      return { success: false, message: "Hanya Administrator yang dapat mengelola autentikator pengguna." };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
      },
    });

    if (!targetUser) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }

    if (!targetUser.twoFactorEnabled) {
      await prisma.twoFactorToken.deleteMany({ where: { userId } });
      await prisma.twoFactorConfirmation.deleteMany({ where: { userId } });
      return { success: true, message: "Autentikator pengguna sudah dinonaktifkan." };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      }),
      prisma.twoFactorToken.deleteMany({ where: { userId } }),
      prisma.twoFactorConfirmation.deleteMany({ where: { userId } }),
    ]);

    await writeAuditLog({
      action: "USER_RESET_TWO_FACTOR",
      entity: "User",
      entityId: userId,
      metadata: {
        email: targetUser.email,
        resetBy: session.user.id,
      },
    });

    return { success: true, message: "Autentikator pengguna dinonaktifkan." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal mengatur ulang autentikator pengguna." };
  }
}
