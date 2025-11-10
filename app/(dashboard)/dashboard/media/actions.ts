"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { deleteMediaFile, deriveThumbnailUrl, saveMediaFile } from "@/lib/storage/media";
import { writeAuditLog } from "@/lib/audit/log";

const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/ogv",
  "video/quicktime",
]);

const uploadSchema = z.object({
  title: z.string().min(2, "Judul minimal 2 karakter").optional(),
});

export async function uploadMedia(formData: FormData) {
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "File wajib dipilih" };
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  if (!isImage && !isVideo) {
    return { error: "Hanya gambar atau video yang dapat diunggah" };
  }

  if (isImage && file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return { error: "Ukuran gambar maksimal 5MB" };
  }

  if (isVideo && file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    return { error: "Ukuran video maksimal 50MB" };
  }

  if (isImage && !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return { error: "Format gambar tidak didukung" };
  }

  if (isVideo && !ALLOWED_VIDEO_MIME_TYPES.has(file.type)) {
    return { error: "Format video tidak didukung" };
  }

  const titleEntry = formData.get("title");
  const parsed = uploadSchema.safeParse({
    title: typeof titleEntry === "string" && titleEntry.trim().length > 0 ? titleEntry : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Judul tidak valid" };
  }

  let saved;
  try {
    saved = await saveMediaFile(file);
  } catch (error) {
    console.error("Gagal memproses file yang diunggah", error);
    return { error: "File media tidak valid" };
  }
  const media = await prisma.media.create({
    data: {
      title: parsed.data.title ?? file.name ?? "Media",
      fileName: saved.fileName,
      url: saved.url,
      mimeType: isImage ? "image/webp" : file.type,
      size: saved.size,
      width: saved.width,
      height: saved.height,
      duration: saved.duration,
      thumbnailFileName: saved.thumbnailFileName,
      thumbnailUrl: saved.thumbnailUrl,
      thumbnailWidth: saved.thumbnailWidth,
      thumbnailHeight: saved.thumbnailHeight,
      storageType: saved.storageType,
      createdById: session.user.id,
    },
  });

  await writeAuditLog({
    action: "MEDIA_UPLOAD",
    entity: "Media",
    entityId: media.id,
    metadata: { title: media.title, mimeType: media.mimeType },
  });

  revalidatePath("/dashboard/media");
  return {
    success: true,
    data: {
      id: media.id,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl ?? deriveThumbnailUrl(media.url) ?? undefined,
      mimeType: media.mimeType,
      duration: media.duration ?? undefined,
    },
  };
}

export async function deleteMedia(id: string) {
  await assertRole(["EDITOR", "ADMIN"]);

  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    return { error: "Media tidak ditemukan" };
  }

  await prisma.media.delete({ where: { id } });
  await deleteMediaFile(media.storageType, media.fileName, media.thumbnailFileName);

  await writeAuditLog({
    action: "MEDIA_DELETE",
    entity: "Media",
    entityId: id,
    metadata: { title: media.title },
  });

  revalidatePath("/dashboard/media");
  return { success: true };
}
