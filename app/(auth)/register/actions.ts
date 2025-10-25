"use server";

import { randomBytes } from "crypto";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { sendActivationEmail } from "@/lib/email/send-activation-email";

const registerSchema = z
  .object({
    name: z.string().min(3, "Nama minimal 3 karakter"),
    email: z.string().email("Email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string().min(8, "Password minimal 8 karakter"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sesuai",
  });

export type RegisterActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof registerSchema>, string>>;
};

export async function registerAction(_: RegisterActionState | undefined, formData: FormData): Promise<RegisterActionState> {
  const config = await getSiteConfig();
  if (!config.registration?.enabled) {
    return { error: "Registrasi penulis sedang dinonaktifkan oleh administrator." };
  }

  const autoApprove = config.registration?.autoApprove ?? false;

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    type RegisterFields = z.infer<typeof registerSchema>;
    const fieldErrors: Partial<Record<keyof RegisterFields, string>> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        fieldErrors[path as keyof RegisterFields] = issue.message;
      }
    }
    return { error: "Validasi gagal", fieldErrors };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.emailVerified) {
      return {
        error: "Email sudah terdaftar namun belum diaktifkan. Periksa inbox Anda atau hubungi administrator.",
      };
    }
    return { error: "Email sudah digunakan. Gunakan email lain." };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: UserRole.AUTHOR,
      canPublish: autoApprove,
    },
  });

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier: user.id } });

  await prisma.verificationToken.create({
    data: {
      identifier: user.id,
      token,
      expires,
    },
  });

  try {
    await sendActivationEmail({ email, name, token });
  } catch (error) {
    console.error("Failed to send activation email", error);
    return {
      error: "Akun berhasil dibuat namun email aktivasi gagal dikirim. Hubungi administrator.",
    };
  }

  return {
    success: "Pendaftaran berhasil. Periksa email Anda untuk mengaktifkan akun.",
  };
}

export async function activateUserByToken(token: string) {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) {
    return { error: "Token aktivasi tidak valid." };
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return { error: "Token aktivasi kedaluwarsa." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  return { success: "Akun berhasil diaktifkan. Anda dapat masuk sekarang." };
}
