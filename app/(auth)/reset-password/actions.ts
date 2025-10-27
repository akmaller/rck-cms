"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { findActivePasswordResetToken, pruneExpiredPasswordResetTokens } from "@/lib/auth/password-reset";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { extractClientIp } from "@/lib/security/ip-block";
import { logSecurityIncident } from "@/lib/security/activity-log";
import { writeAuditLog } from "@/lib/audit/log";

const resetSchema = z
  .object({
    token: z.string().min(1, "Token tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string().min(8, "Password minimal 8 karakter"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sesuai",
  });

export type ResetPasswordActionState = {
  success?: string;
  error?: string;
  fieldErrors?: Partial<Record<"password" | "confirmPassword", string>>;
};

export async function resetPasswordAction(
  _: ResetPasswordActionState | undefined,
  formData: FormData
): Promise<ResetPasswordActionState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: ResetPasswordActionState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "password" || field === "confirmPassword") {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      error: "Validasi gagal",
      fieldErrors,
    };
  }

  const { token, password } = parsed.data;
  const headersList = await headers();
  const ip = extractClientIp({ headers: headersList, ip: null });

  const record = await findActivePasswordResetToken(token);
  if (!record) {
    await logSecurityIncident({
      category: "password-reset",
      source: "auth",
      ip,
      description: "Token reset password tidak valid atau kedaluwarsa.",
      metadata: { token },
    });
    return {
      error: "Token reset password tidak valid atau sudah kedaluwarsa.",
    };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.session.deleteMany({
      where: { userId: record.userId },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await pruneExpiredPasswordResetTokens(record.userId);

  await writeAuditLog({
    action: "PASSWORD_RESET_COMPLETED",
    entity: "User",
    entityId: record.userId,
    metadata: {
      ip,
      tokenId: record.id,
    },
    userId: record.userId,
  });

  return {
    success: "Password berhasil diperbarui. Silakan masuk dengan password baru Anda.",
  };
}
