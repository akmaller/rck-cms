"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  checkPasswordResetRequestLimit,
  createPasswordResetToken,
} from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset-email";
import { extractClientIp } from "@/lib/security/ip-block";
import { logSecurityIncident } from "@/lib/security/activity-log";
import { writeAuditLog } from "@/lib/audit/log";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const requestSchema = z.object({
  email: z.string().email("Email tidak valid"),
});

export type ForgotPasswordActionState = {
  success?: string;
  error?: string;
  fieldErrors?: Partial<Record<"email", string>>;
};

const GENERIC_SUCCESS_MESSAGE =
  "Jika email terdaftar, kami telah mengirim tautan reset password. Jika baru saja meminta reset, tunggu beberapa menit sebelum mencoba lagi.";

export async function requestPasswordResetAction(
  _: ForgotPasswordActionState | undefined,
  formData: FormData
): Promise<ForgotPasswordActionState> {
  const parsed = requestSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      error: "Validasi gagal",
      fieldErrors: { email: parsed.error.issues[0]?.message ?? "Email tidak valid" },
    };
  }

  const headersList = await headers();
  const ip = extractClientIp({ headers: headersList, ip: null });
  const turnstileToken = formData.get("turnstileToken");

  const verification = await verifyTurnstileToken(typeof turnstileToken === "string" ? turnstileToken : null, ip);
  if (!verification.success) {
    await logSecurityIncident({
      category: "password-reset",
      source: "turnstile",
      ip,
      description: "Verifikasi anti-robot gagal untuk permintaan reset password.",
      metadata: {
        errors: verification.errors ?? [],
      },
    });
    return {
      error: "Verifikasi anti-robot gagal. Silakan coba lagi.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.emailVerified) {
    return { success: GENERIC_SUCCESS_MESSAGE };
  }

  const limitCheck = await checkPasswordResetRequestLimit(user.id);
  if (!limitCheck.allowed) {
    await logSecurityIncident({
      category: "password-reset",
      source: "auth",
      ip,
      description: "Permintaan reset password diblokir karena melebihi batas.",
      metadata: {
        userId: user.id,
        email,
        retryAt: limitCheck.retryAt.toISOString(),
      },
    });
    return { success: GENERIC_SUCCESS_MESSAGE };
  }

  const tokenRecord = await createPasswordResetToken(user.id);

  try {
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      token: tokenRecord.token,
    });
  } catch (error) {
    console.error("Failed to send password reset email", error);
    return {
      error: "Gagal mengirim email reset password. Coba lagi nanti.",
    };
  }

  await writeAuditLog({
    action: "PASSWORD_RESET_REQUESTED",
    entity: "User",
    entityId: user.id,
    metadata: {
      ip,
      email,
      tokenId: tokenRecord.id,
    },
    userId: user.id,
  });

  return { success: GENERIC_SUCCESS_MESSAGE };
}
