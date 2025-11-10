import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@prisma/client";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { deriveThumbnailUrl, saveMediaFile } from "@/lib/storage/media";

const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 20;
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

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  uploadedBy: z
    .union([z.literal("all"), z.literal("me"), z.string().cuid()])
    .optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(request: NextRequest) {
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const parsedQuery = listQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: parsedQuery.error.issues[0]?.message ?? "Parameter tidak valid" },
      { status: 400 }
    );
  }

  const { page, perPage, search } = parsedQuery.data;
  const rawUploadedBy = parsedQuery.data.uploadedBy;
  const dateFrom = parsedQuery.data.dateFrom ? new Date(parsedQuery.data.dateFrom) : undefined;
  const dateTo = parsedQuery.data.dateTo ? new Date(parsedQuery.data.dateTo) : undefined;
  if (dateFrom && Number.isNaN(dateFrom.getTime())) {
    return NextResponse.json({ error: "Tanggal awal tidak valid" }, { status: 400 });
  }
  if (dateTo && Number.isNaN(dateTo.getTime())) {
    return NextResponse.json({ error: "Tanggal akhir tidak valid" }, { status: 400 });
  }
  if (dateTo) {
    dateTo.setUTCHours(23, 59, 59, 999);
  }

  const role = session.user.role;
  const isAuthor = role === "AUTHOR";
  const uploadedBy = isAuthor ? "me" : rawUploadedBy ?? "me";
  const filters: Prisma.MediaWhereInput[] = [
    { NOT: { fileName: { startsWith: "album/" } } },
  ];

  if (search) {
    filters.push({
      OR: [
        { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { fileName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }

  if (isAuthor) {
    filters.push({ createdById: session.user.id });
  } else if (uploadedBy === "me") {
    filters.push({ createdById: session.user.id });
  } else if (uploadedBy && uploadedBy !== "all") {
    filters.push({ createdById: uploadedBy });
  }

  if (dateFrom) {
    filters.push({ createdAt: { gte: dateFrom } });
  }

  if (dateTo) {
    filters.push({ createdAt: { lte: dateTo } });
  }

  const where =
    filters.length === 1 ? filters[0] : { AND: filters };

  const [items, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.media.count({ where }),
  ]);

  return NextResponse.json({
    data: items.map((item) => ({
      id: item.id,
      title: item.title,
      fileName: item.fileName,
      url: item.url,
      mimeType: item.mimeType,
      size: item.size,
      storageType: item.storageType,
      width: item.width,
      height: item.height,
      duration: item.duration,
      description: item.description,
      createdAt: item.createdAt,
      createdBy: item.createdBy,
      thumbnailUrl: item.thumbnailUrl ?? deriveThumbnailUrl(item.url) ?? undefined,
      thumbnailFileName: item.thumbnailFileName ?? undefined,
      thumbnailWidth: item.thumbnailWidth ?? undefined,
      thumbnailHeight: item.thumbnailHeight ?? undefined,
    })),
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
      filters: {
        uploadedBy: isAuthor
          ? "me"
          : uploadedBy === session.user.id
            ? "me"
            : uploadedBy ?? null,
        dateFrom: parsedQuery.data.dateFrom ?? null,
        dateTo: parsedQuery.data.dateTo ?? null,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);
  const rateKey = `media_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Form data tidak valid" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Hanya format gambar atau video yang didukung" }, { status: 400 });
  }

  if (isImage && file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran gambar maksimal 5MB" }, { status: 400 });
  }

  if (isVideo && file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran video maksimal 50MB" }, { status: 400 });
  }

  if (isImage && !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Format gambar tidak didukung" }, { status: 400 });
  }

  if (isVideo && !ALLOWED_VIDEO_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Format video tidak didukung" }, { status: 400 });
  }

  const titleValue = formData.get("title");
  const title =
    typeof titleValue === "string" && titleValue.trim().length > 0
      ? titleValue.trim()
      : file.name ?? "Media";

  let saved;
  try {
    saved = await saveMediaFile(file);
  } catch (error) {
    console.error("Gagal memproses file yang diunggah", error);
    return NextResponse.json({ error: "File media tidak valid" }, { status: 400 });
  }

  const media = await prisma.media.create({
    data: {
      title,
      description: null,
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
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(
    {
      data: {
        id: media.id,
        title: media.title,
        description: media.description,
        url: media.url,
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
    },
    { status: 201 }
  );
}
