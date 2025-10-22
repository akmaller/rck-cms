import { NextRequest, NextResponse } from "next/server";

import { assertMediaOwnership, assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { deleteMediaFile } from "@/lib/storage/media";
import { writeAuditLog } from "@/lib/audit/log";

export async function GET(
  _request: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const media = await prisma.media.findUnique({
    where: { id: params.mediaId },
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
      url: media.url,
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.size,
      storageType: media.storageType,
      width: media.width,
      height: media.height,
      createdAt: media.createdAt,
      createdBy: media.createdBy,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  let result;
  try {
    result = await assertMediaOwnership(params.mediaId);
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
