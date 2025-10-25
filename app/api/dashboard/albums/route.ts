import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ArticleStatus } from "@prisma/client";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { saveMediaFile } from "@/lib/storage/media";

const createAlbumSchema = z.object({
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

export async function POST(request: NextRequest) {
  const session = await assertRole(["EDITOR", "ADMIN"]);
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Form data tidak valid" }, { status: 400 });
  }

  const parsed = createAlbumSchema.safeParse({
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

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length > 20) {
    return NextResponse.json(
      { error: "Maksimal 20 gambar dapat diunggah sekaligus." },
      { status: 400 }
    );
  }

  const parseDescriptions = () => {
    const raw = formData.get("fileDescriptions");
    if (raw === null || raw === undefined || raw === "") {
      return [] as string[];
    }
    if (typeof raw !== "string") {
      throw new Error("Deskripsi gambar tidak valid");
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error("Deskripsi gambar tidak valid");
      }
      return parsed.map((entry) => (typeof entry === "string" ? entry : ""));
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Deskripsi gambar tidak valid"
      );
    }
  };

  let fileDescriptions: string[] = [];

  try {
    fileDescriptions = parseDescriptions();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Deskripsi gambar tidak valid.",
      },
      { status: 400 }
    );
  }

  const uploadResults: Array<{
    file: File;
    saved: Awaited<ReturnType<typeof saveMediaFile>>;
    description: string;
  }> = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file.type.startsWith("image/")) {
        throw new Error(`File ${file.name} bukan gambar yang valid.`);
      }
      const saved = await saveMediaFile(file, { directory: "album" });
      const descriptionRaw = fileDescriptions[index] ?? "";
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

  const status = ArticleStatus[parsed.data.status];
  const now = new Date();

  try {
    const album = await prisma.$transaction(async (tx) => {
      const createdAlbum = await tx.album.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          status,
          publishedAt: status === ArticleStatus.PUBLISHED ? now : null,
          createdById: session.user.id,
        },
      });

      for (let index = 0; index < uploadResults.length; index += 1) {
        const { file, saved, description } = uploadResults[index];
        const media = await tx.media.create({
          data: {
            title:
              typeof file.name === "string" && file.name.trim().length > 0
                ? file.name.replace(/\.[^/.]+$/, "").trim() || parsed.data.title
                : `${parsed.data.title} - ${index + 1}`,
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
            albumId: createdAlbum.id,
            mediaId: media.id,
            position: index,
            caption: description.length > 0 ? description : null,
          },
        });
      }

      return createdAlbum;
    });

    revalidatePath("/dashboard/albums");

    return NextResponse.json(
      {
        data: {
          id: album.id,
          status: album.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal membuat album baru", error);
    return NextResponse.json(
      { error: "Gagal membuat album. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
