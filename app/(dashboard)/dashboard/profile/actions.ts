"use server";

import { mkdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/permissions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AUTHOR_SOCIAL_FIELDS, AUTHOR_SOCIAL_KEYS, type AuthorSocialKey } from "@/lib/authors/social-links";
import { findForbiddenPhraseInInputs } from "@/lib/moderation/forbidden-terms";

const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(1, "Nama wajib diisi")
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: z
    .string()
    .min(1, "Email wajib diisi")
    .email("Email tidak valid"),
  bio: z
    .string()
    .trim()
    .max(500, "Bio maksimal 500 karakter")
    .optional()
    .nullable(),
});

const passwordUpdateSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Password saat ini wajib diisi")
      .min(8, "Password minimal 8 karakter"),
    newPassword: z
      .string()
      .min(1, "Password baru wajib diisi")
      .min(8, "Password baru minimal 8 karakter"),
    confirmPassword: z
      .string()
      .min(1, "Konfirmasi password baru wajib diisi")
      .min(8, "Konfirmasi password minimal 8 karakter"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak cocok",
  });

export async function updateProfile(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const rawBio = formData.get("bio");
  const socialLabelMap = new Map(AUTHOR_SOCIAL_FIELDS.map((field) => [field.key, field.label] as const));
  const socialLinksPayload: Partial<Record<AuthorSocialKey, string>> = {};

  for (const key of AUTHOR_SOCIAL_KEYS) {
    const rawValue = formData.get(`socialLinks.${key}`);
    if (typeof rawValue !== "string") {
      continue;
    }
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      continue;
    }
    if (trimmedValue.length > 250) {
      const label = socialLabelMap.get(key) ?? key;
      return { success: false, message: `Tautan ${label} terlalu panjang (maksimal 250 karakter).` };
    }
    try {
      // Ensure the value is an absolute URL.
      new URL(trimmedValue);
    } catch {
      const label = socialLabelMap.get(key) ?? key;
      return { success: false, message: `Tautan ${label} harus berupa URL yang valid.` };
    }
    socialLinksPayload[key] = trimmedValue;
  }

  const sanitizedSocialLinks = Object.fromEntries(
    Object.entries(socialLinksPayload).map(([key, value]) => [key, value])
  );

  const payload = {
    name: formData.get("name"),
    email: formData.get("email"),
    bio: typeof rawBio === "string" && rawBio.trim().length > 0 ? rawBio : null,
    socialLinks: sanitizedSocialLinks,
  };

  const parsed = profileUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { success: false, message: issue?.message ?? "Data profil tidak valid" };
  }

  const forbiddenMatch = await findForbiddenPhraseInInputs([parsed.data.bio ?? null]);
  if (forbiddenMatch) {
    return {
      success: false,
      message: `Bio mengandung kata/kalimat terlarang "${forbiddenMatch.phrase}". Hapus kata tersebut sebelum melanjutkan.`,
    };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!existing) {
      return { success: false, message: "Pengguna tidak ditemukan" };
    }

    if (parsed.data.email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      });

      if (emailTaken && emailTaken.id !== userId) {
        return { success: false, message: "Email sudah digunakan oleh pengguna lain" };
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        bio: parsed.data.bio ?? null,
        socialLinks: sanitizedSocialLinks,
      },
    });

    await writeAuditLog({
      action: "USER_UPDATE",
      entity: "User",
      entityId: userId,
      metadata: {
        scope: "profile",
        email: parsed.data.email,
        socialLinks: Object.keys(sanitizedSocialLinks),
      },
    });

    revalidatePath("/dashboard/profile");
    revalidatePath(`/authors/${userId}`);

    return { success: true, message: "Profil berhasil diperbarui." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal memperbarui profil. Coba lagi nanti." };
  }
}

export async function changePassword(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const parsed = passwordUpdateSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { success: false, message: issue?.message ?? "Data password tidak valid" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return { success: false, message: "Password belum diatur. Hubungi administrator." };
    }

    const isCurrentValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return { success: false, message: "Password saat ini tidak sesuai" };
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return { success: false, message: "Password baru tidak boleh sama dengan password saat ini" };
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await writeAuditLog({
      action: "USER_UPDATE",
      entity: "User",
      entityId: userId,
      metadata: { scope: "password" },
    });

    revalidatePath("/dashboard/profile");

    return { success: true, message: "Password berhasil diperbarui." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal memperbarui password. Coba lagi nanti." };
  }
}

const AVATAR_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_SIZE = 3 * 1024 * 1024; // 3MB
const AVATAR_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

export async function updateAvatar(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "File gambar tidak ditemukan." };
  }

  if (file.size > AVATAR_MAX_SIZE) {
    return { success: false, message: "Ukuran gambar maksimal 3MB." };
  }

  if (!AVATAR_ALLOWED_TYPES.has(file.type)) {
    return { success: false, message: "Format gambar harus JPG, PNG, atau WebP." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  if (!user) {
    return { success: false, message: "Pengguna tidak ditemukan." };
  }

  let processed: Buffer;
  try {
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    processed = await sharp(rawBuffer)
      .rotate()
      .resize({
        width: 350,
        height: 350,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat("webp", { quality: 80 })
      .toBuffer();
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal memproses gambar. Gunakan file lain." };
  }

  const fileName = `${userId}-${Date.now()}.webp`;
  const targetPath = path.join(AVATAR_UPLOAD_DIR, fileName);
  const publicPath = `/uploads/avatars/${fileName}`;

  try {
    await mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
    await writeFile(targetPath, processed);
  } catch (error) {
    console.error(error);
    return { success: false, message: "Gagal menyimpan gambar. Coba lagi nanti." };
  }

  if (user.avatarUrl && user.avatarUrl.startsWith("/uploads/avatars/")) {
    const oldPath = path.join(process.cwd(), "public", user.avatarUrl);
    try {
      await stat(oldPath);
      await unlink(oldPath);
    } catch {
      // File lama sudah tidak ada, abaikan.
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: publicPath },
  });

  await writeAuditLog({
    action: "USER_UPDATE",
    entity: "User",
    entityId: userId,
    metadata: { scope: "avatar", path: publicPath },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Foto profil berhasil diperbarui.",
    url: `${publicPath}?v=${Date.now()}`,
  };
}
