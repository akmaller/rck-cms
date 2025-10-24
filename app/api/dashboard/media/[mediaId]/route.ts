import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertMediaOwnership, assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { deleteMediaFile, deriveThumbnailUrl } from "@/lib/storage/media";
import { writeAuditLog } from "@/lib/audit/log";

const updateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
});

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
      createdAt: media.createdAt,
      createdBy: media.createdBy,
      thumbnailUrl: deriveThumbnailUrl(media.url) ?? undefined,
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
      createdAt: updated.createdAt,
      createdBy: updated.createdBy,
      thumbnailUrl: deriveThumbnailUrl(updated.url) ?? undefined,
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

  await deleteMediaFile(media.storageType, media.fileName);

  await writeAuditLog({
    action: "MEDIA_DELETE",
    entity: "Media",
    entityId: media.id,
    metadata: { title: media.title },
  });

  return NextResponse.json({ message: "Media dihapus" });
}
