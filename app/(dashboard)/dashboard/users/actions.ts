"use server";

import { revalidatePath } from "next/cache";

import type { UserRole } from "@prisma/client";

import { requireAuth } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { userUpdateSchema } from "@/lib/validators/user";
import { writeAuditLog } from "@/lib/audit/log";

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
        userId
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

export async function deleteUserAction(userId: string) {
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

    await prisma.$transaction([
      prisma.article.updateMany({
        where: { authorId: targetUser.id },
        data: { authorId: session.user.id },
      }),
      prisma.user.delete({ where: { id: targetUser.id } }),
    ]);

    await writeAuditLog({
      action: "USER_DELETE",
      entity: "User",
      entityId: targetUser.id,
      metadata: { email: targetUser.email, deletedBy: session.user.id },
    });

    revalidatePath("/dashboard/users");

    return { success: true };
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

    revalidatePath("/dashboard/users");
    revalidatePath(`/dashboard/users/${userId}`);

    return { success: true, message: "Autentikator pengguna telah dinonaktifkan." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal mereset autentikator pengguna." };
  }
}
