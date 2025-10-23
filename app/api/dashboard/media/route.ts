import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@prisma/client";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { saveMediaFile } from "@/lib/storage/media";

const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 20;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
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
  const where: Prisma.MediaWhereInput = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { fileName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  if (session.user.role === "AUTHOR") {
    where.createdById = session.user.id;
  }

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
      description: item.description,
      createdAt: item.createdAt,
      createdBy: item.createdBy,
    })),
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);
  const rateKey = `media_mutation:${session.user.id}`;

  if (isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
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

  const titleValue = formData.get("title");
  const title =
    typeof titleValue === "string" && titleValue.trim().length > 0
      ? titleValue.trim()
      : file.name ?? "Media";

  const saved = await saveMediaFile(file);

  const media = await prisma.media.create({
    data: {
      title,
      description: null,
      fileName: saved.fileName,
      url: saved.url,
      mimeType: file.type || "application/octet-stream",
      size: Number(file.size) || 0,
      width: null,
      height: null,
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
        createdAt: media.createdAt,
        createdBy: media.createdBy,
      },
    },
    { status: 201 }
  );
}
