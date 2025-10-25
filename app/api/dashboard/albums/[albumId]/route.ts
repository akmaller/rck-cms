import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ArticleStatus } from "@prisma/client";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { deleteMediaFile, saveMediaFile } from "@/lib/storage/media";

const MAX_FILES = 20;

const updateAlbumSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, { message: "Judul album minimal 2 karakter" })
    .max(150, { message: "Judul album maksimal 150 karakter" }),
  description: z
    .string()
    .trim()
    .max(500, { message: "Deskripsi maksimal 500 karakter" })
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional(),
  status: z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => value in ArticleStatus, {
      message: "Status album tidak dikenal",
    })
    .transform((value) => value as keyof typeof ArticleStatus),
});

function parseJsonArray(value: FormDataEntryValue | null, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return [] as string[];
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} tidak valid`);
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error();
    }
    const result = parsed.map((item) => {
      if (typeof item !== "string") {
        throw new Error();
      }
      return item;
    });
    return result;
  } catch {
    throw new Error(`${fieldName} tidak valid`);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await context.params;
  const session = await assertRole(["EDITOR", "ADMIN"]);
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Form data tidak valid" }, { status: 400 });
  }

  const parsed = updateAlbumSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    status: formData.get("status"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Data album tidak valid" },
      { status: 400 }
    );
  }

  let imageOrder: string[] = [];
  let removedImageIds: string[] = [];

  try {
    imageOrder = parseJsonArray(formData.get("imageOrder"), "Urutan gambar");
    removedImageIds = Array.from(
      new Set(parseJsonArray(formData.get("removedImageIds"), "Daftar gambar yang dihapus"))
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Data urutan gambar tidak valid";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maksimal ${MAX_FILES} gambar dapat diunggah sekaligus.` },
      { status: 400 }
    );
  }

  const parseStringArray = (value: FormDataEntryValue | null, fieldName: string) => {
    if (value === null || value === undefined || value === "") {
      return [] as string[];
    }
    if (typeof value !== "string") {
      throw new Error(`${fieldName} tidak valid`);
    }
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error();
      }
      return parsed.map((entry) => (typeof entry === "string" ? entry : ""));
    } catch {
      throw new Error(`${fieldName} tidak valid`);
    }
  };

  const parseCaptionsMap = (value: FormDataEntryValue | null, fieldName: string) => {
    if (value === null || value === undefined || value === "") {
      return new Map<string, string>();
    }
    if (typeof value !== "string") {
      throw new Error(`${fieldName} tidak valid`);
    }
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      const entries = Object.entries(parsed).map(
        ([key, val]) => [key, typeof val === "string" ? val : ""] as [string, string]
      );
      return new Map<string, string>(entries);
    } catch {
      throw new Error(`${fieldName} tidak valid`);
    }
  };

  let newFileDescriptions: string[] = [];
  let captionMap = new Map<string, string>();

  try {
    newFileDescriptions = parseStringArray(formData.get("fileDescriptions"), "Deskripsi gambar baru");
    captionMap = parseCaptionsMap(formData.get("imageCaptions"), "Deskripsi gambar album");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data deskripsi gambar tidak valid";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: {
      images: {
        include: {
          media: {
            select: {
              id: true,
              title: true,
              fileName: true,
              url: true,
              size: true,
              storageType: true,
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!album) {
    return NextResponse.json({ error: "Album tidak ditemukan" }, { status: 404 });
  }

  const existingIds = new Set(album.images.map((item) => item.id));
  const invalidOrderEntries = imageOrder.filter((id) => !existingIds.has(id));
  const invalidRemovedEntries = removedImageIds.filter((id) => !existingIds.has(id));
  const invalidCaptionEntries = Array.from(captionMap.keys()).filter((id) => !existingIds.has(id));

  if (invalidOrderEntries.length > 0) {
    return NextResponse.json(
      { error: "Urutan gambar berisi entri yang tidak dikenal." },
      { status: 400 }
    );
  }

  if (invalidRemovedEntries.length > 0) {
    return NextResponse.json(
      { error: "Permintaan menghapus gambar tidak valid." },
      { status: 400 }
    );
  }

  if (invalidCaptionEntries.length > 0) {
    return NextResponse.json(
      { error: "Deskripsi gambar tidak valid." },
      { status: 400 }
    );
  }

  const remainingIds = album.images
    .map((item) => item.id)
    .filter((id) => !removedImageIds.includes(id));
  const seen = new Set<string>();
  const normalizedOrder = [
    ...imageOrder.filter((id) => {
      const valid = remainingIds.includes(id) && !seen.has(id);
      if (valid) {
        seen.add(id);
      }
      return valid;
    }),
    ...remainingIds.filter((id) => !seen.has(id)),
  ];

  const removedMediaEntries = album.images.filter((item) =>
    removedImageIds.includes(item.id)
  );

  const uploadResults: Array<{
    file: File;
    saved: Awaited<ReturnType<typeof saveMediaFile>>;
    description: string;
  }> = [];

  if (files.length > 0) {
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file.type.startsWith("image/")) {
          throw new Error(`File ${file.name} bukan gambar yang valid.`);
        }
        const saved = await saveMediaFile(file, { directory: "album" });
        const descriptionRaw = newFileDescriptions[index] ?? "";
        uploadResults.push({
          file,
          saved,
          description: descriptionRaw.trim(),
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memproses unggahan gambar.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const status = ArticleStatus[parsed.data.status];
  const now = new Date();
  let publishedAt: Date | null | undefined;

  if (status === ArticleStatus.PUBLISHED) {
    publishedAt = album.publishedAt ?? now;
  } else if (status === ArticleStatus.SCHEDULED) {
    publishedAt = album.publishedAt ?? null;
  } else {
    publishedAt = null;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.album.update({
        where: { id: album.id },
        data: {
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          status,
          publishedAt,
        },
      });

      if (removedMediaEntries.length > 0) {
        const removedAlbumImageIds = removedMediaEntries.map((item) => item.id);
        const removedMediaIds = removedMediaEntries.map((item) => item.mediaId);
        if (removedAlbumImageIds.length > 0) {
          await tx.albumImage.deleteMany({
            where: { id: { in: removedAlbumImageIds } },
          });
        }
        if (removedMediaIds.length > 0) {
          await tx.media.deleteMany({
            where: { id: { in: removedMediaIds } },
          });
        }
      }

      if (normalizedOrder.length > 0) {
        await Promise.all(
          normalizedOrder.map((id, index) =>
            tx.albumImage.update({
              where: { id },
              data: {
                position: index,
                caption: captionMap.has(id)
                  ? captionMap.get(id)?.trim() || null
                  : undefined,
              },
            })
          )
        );
      }

      const basePosition = normalizedOrder.length;
      for (let index = 0; index < uploadResults.length; index += 1) {
        const { file, saved, description } = uploadResults[index];
        const media = await tx.media.create({
          data: {
            title:
              typeof file.name === "string" && file.name.trim().length > 0
                ? file.name.replace(/\.[^/.]+$/, "").trim() || parsed.data.title
                : `${parsed.data.title} - ${basePosition + index + 1}`,
            description: null,
            fileName: saved.fileName,
            url: saved.url,
            mimeType: "image/webp",
            size: saved.size,
            width: saved.width,
            height: saved.height,
            storageType: saved.storageType,
            createdById: session.user.id,
          },
        });

        await tx.albumImage.create({
          data: {
            albumId: album.id,
            mediaId: media.id,
            position: basePosition + index,
            caption: description.length > 0 ? description : null,
          },
        });
      }
    });
  } catch (error) {
    console.error("Gagal memperbarui album", error);
    return NextResponse.json(
      { error: "Gagal memperbarui album. Silakan coba lagi." },
      { status: 500 }
    );
  }

  if (removedMediaEntries.length > 0) {
    await Promise.all(
      removedMediaEntries.map((entry) =>
        deleteMediaFile(entry.media.storageType, entry.media.fileName).catch(() => {})
      )
    );
  }

  revalidatePath("/dashboard/albums");

  return NextResponse.json({
    data: {
      id: album.id,
      status,
    },
  });
}
