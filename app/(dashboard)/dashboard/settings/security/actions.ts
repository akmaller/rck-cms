"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/permissions";
import { generateTwoFactorSecret, verifyTwoFactorToken } from "@/lib/auth/totp";
import { prisma } from "@/lib/prisma";

const SETUP_EXPIRATION_MINUTES = 15;

export async function startTwoFactorSetup() {
  const session = await requireAuth();
  const userId = session.user.id;

  const { secret, uri } = generateTwoFactorSecret(session.user.email ?? userId);

  await prisma.twoFactorToken.deleteMany({ where: { userId, purpose: "SETUP" } });

  await prisma.twoFactorToken.create({
    data: {
      userId,
      token: secret,
      expiresAt: new Date(Date.now() + SETUP_EXPIRATION_MINUTES * 60 * 1000),
      purpose: "SETUP",
    },
  });

  return { secret, uri };
}

export async function confirmTwoFactorSetup(code: string) {
  const session = await requireAuth();
  const userId = session.user.id;

  const pendingSetup = await prisma.twoFactorToken.findFirst({
    where: { userId, purpose: "SETUP" },
    orderBy: { createdAt: "desc" },
  });

  if (!pendingSetup) {
    return { success: false, message: "Tidak ada setup 2FA yang aktif." };
  }

  if (pendingSetup.expiresAt < new Date()) {
    await prisma.twoFactorToken.delete({ where: { id: pendingSetup.id } });
    return { success: false, message: "Kode setup 2FA kedaluwarsa. Mulai ulang." };
  }

  const isValid = verifyTwoFactorToken(code, pendingSetup.token);
  if (!isValid) {
    return { success: false, message: "Kode 2FA tidak valid." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorSecret: pendingSetup.token },
    }),
    prisma.twoFactorToken.delete({ where: { id: pendingSetup.id } }),
    prisma.twoFactorConfirmation.upsert({
      where: { userId },
      update: { createdAt: new Date() },
      create: { userId },
    }),
  ]);

  revalidatePath("/dashboard/settings/security");
  revalidatePath("/dashboard/profile");
  return { success: true, message: "Autentikasi dua faktor diaktifkan." };
}

export async function disableTwoFactor() {
  const session = await requireAuth();
  const userId = session.user.id;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    }),
    prisma.twoFactorToken.deleteMany({ where: { userId } }),
    prisma.twoFactorConfirmation.deleteMany({ where: { userId } }),
  ]);

  revalidatePath("/dashboard/settings/security");
  revalidatePath("/dashboard/profile");
  return { success: true, message: "Autentikasi dua faktor dinonaktifkan." };
}
