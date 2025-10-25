"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";

const twoFactorSchema = z.object({
  token: z.string().min(1, { message: "Token 2FA tidak valid." }),
  code: z
    .string()
    .min(6, { message: "Kode 2FA wajib 6 digit." })
    .max(6, { message: "Kode 2FA wajib 6 digit." }),
  redirectTo: z.string().optional(),
});

type TwoFactorState = {
  error?: string;
};

export async function verifyTwoFactorAction(
  _prevState: TwoFactorState,
  formData: FormData
): Promise<TwoFactorState> {
  const parsed = twoFactorSchema.safeParse({
    token: formData.get("token"),
    code: formData.get("code"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form tidak valid" };
  }

  const { token, code, redirectTo } = parsed.data;
  const normalizedRedirect =
    typeof redirectTo === "string" && redirectTo.trim().length > 0 ? redirectTo : undefined;

  const pending = await prisma.twoFactorToken.findUnique({ where: { token } });
  if (!pending || pending.purpose !== "LOGIN") {
    return { error: "Sesi 2FA kedaluwarsa. Silakan masuk kembali." };
  }

  if (pending.expiresAt < new Date()) {
    await prisma.twoFactorToken.delete({ where: { id: pending.id } });
    return { error: "Sesi 2FA kedaluwarsa. Silakan masuk kembali." };
  }

  try {
    await signIn("credentials", {
      twoFactorToken: token,
      twoFactorCode: code,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const causeMessage =
        typeof error.cause === "object" && error.cause && "message" in error.cause
          ? (typeof (error.cause as { message?: unknown }).message === "string"
              ? (error.cause as { message: string }).message
              : "")
          : "";
      return { error: causeMessage || "Kode 2FA tidak valid" };
    }

    return { error: "Terjadi kesalahan saat memverifikasi 2FA" };
  }

  redirect(normalizedRedirect ?? "/dashboard");
}
