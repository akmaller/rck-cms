import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertMediaOwnership, assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { deleteMediaFile, deriveThumbnailUrl, saveMediaFile } from "@/lib/storage/media";
import { writeAuditLog } from "@/lib/audit/log";

const updateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
});

const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await context.params;
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!media) {
    return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  }

  if (session.user.role === "AUTHOR" && media.createdById !== session.user.id) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  return NextResponse.json({
    data: {
      id: media.id,
      title: media.title,
      description: media.description,
      url: media.url,
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.size,
      storageType: media.storageType,
      width: media.width,
      height: media.height,
      duration: media.duration,
      createdAt: media.createdAt,
      createdBy: media.createdBy,
      thumbnailUrl: media.thumbnailUrl ?? deriveThumbnailUrl(media.url) ?? undefined,
      thumbnailFileName: media.thumbnailFileName ?? undefined,
      thumbnailWidth: media.thumbnailWidth ?? undefined,
      thumbnailHeight: media.thumbnailHeight ?? undefined,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await context.params;
  let ownership;
  try {
    ownership = await assertMediaOwnership(mediaId);
  } catch (error) {
    if (error instanceof Error && error.message === "NotFound") {
      return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Form data tidak valid" }, { status: 400 });
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File gambar wajib diunggah" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Hanya gambar yang dapat diganti" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Ukuran gambar maksimal 5MB" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Format gambar tidak didukung" }, { status: 400 });
    }

    let saved;
    try {
      saved = await saveMediaFile(file);
    } catch (error) {
      console.error("Gagal memproses file hasil crop", error);
      return NextResponse.json({ error: "File gambar tidak valid" }, { status: 422 });
    }

    const updated = await prisma.media.update({
      where: { id: mediaId },
      data: {
        fileName: saved.fileName,
        url: saved.url,
        storageType: saved.storageType,
        size: saved.size,
        width: saved.width,
        height: saved.height,
        duration: saved.duration,
        thumbnailFileName: saved.thumbnailFileName,
        thumbnailUrl: saved.thumbnailUrl,
        thumbnailWidth: saved.thumbnailWidth,
        thumbnailHeight: saved.thumbnailHeight,
        mimeType: "image/webp",
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await deleteMediaFile(
      ownership.media.storageType,
      ownership.media.fileName,
      ownership.media.thumbnailFileName,
    );

    await writeAuditLog({
      action: "MEDIA_UPDATE",
      entity: "Media",
      entityId: updated.id,
      metadata: { title: updated.title, replacedFile: true },
      userId: ownership.session.user.id,
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        url: updated.url,
        fileName: updated.fileName,
        mimeType: updated.mimeType,
        size: updated.size,
        storageType: updated.storageType,
        width: updated.width,
        height: updated.height,
        duration: updated.duration,
        thumbnailUrl: updated.thumbnailUrl ?? deriveThumbnailUrl(updated.url) ?? undefined,
        thumbnailFileName: updated.thumbnailFileName ?? undefined,
        thumbnailWidth: updated.thumbnailWidth ?? undefined,
        thumbnailHeight: updated.thumbnailHeight ?? undefined,
        createdAt: updated.createdAt,
        createdBy: updated.createdBy,
      },
    });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 422 }
    );
  }

  const updateData: {
    title?: string;
    description?: string | null;
  } = {};

  if (parsed.data.title !== undefined) {
    updateData.title = parsed.data.title;
  }
  if (parsed.data.description !== undefined) {
    updateData.description = parsed.data.description ?? null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "Tidak ada perubahan" });
  }

  const updated = await prisma.media.update({
    where: { id: mediaId },
    data: updateData,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  await writeAuditLog({
    action: "MEDIA_UPDATE",
    entity: "Media",
    entityId: updated.id,
    metadata: { title: updated.title },
    userId: ownership.session.user.id,
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      url: updated.url,
      fileName: updated.fileName,
      mimeType: updated.mimeType,
      size: updated.size,
      storageType: updated.storageType,
      width: updated.width,
      height: updated.height,
      duration: updated.duration,
      createdAt: updated.createdAt,
      createdBy: updated.createdBy,
      thumbnailUrl: updated.thumbnailUrl ?? deriveThumbnailUrl(updated.url) ?? undefined,
      thumbnailFileName: updated.thumbnailFileName ?? undefined,
      thumbnailWidth: updated.thumbnailWidth ?? undefined,
      thumbnailHeight: updated.thumbnailHeight ?? undefined,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await context.params;
  let result;
  try {
    result = await assertMediaOwnership(mediaId);
  } catch (error) {
    if (error instanceof Error && error.message === "NotFound") {
      return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const { media } = result;

  await prisma.$transaction([
    prisma.article.updateMany({
      where: { featuredMediaId: media.id },
      data: { featuredMediaId: null },
    }),
    prisma.media.delete({
      where: { id: media.id },
    }),
  ]);

  await deleteMediaFile(media.storageType, media.fileName, media.thumbnailFileName);

  await writeAuditLog({
    action: "MEDIA_DELETE",
    entity: "Media",
    entityId: media.id,
    metadata: { title: media.title },
  });

  return NextResponse.json({ message: "Media dihapus" });
}
