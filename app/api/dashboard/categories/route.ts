import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { Prisma } from "@prisma/client";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { isRateLimited } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils/slug";
import { categoryCreateSchema } from "@/lib/validators/category";

const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 30;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

async function ensureUniqueSlug(base: string) {
  const safeBase = base.length > 0 ? base : `kategori-${Date.now()}`;
  let candidate = safeBase;
  let counter = 1;

  while (await prisma.category.findUnique({ where: { slug: candidate } })) {
    candidate = `${safeBase}-${counter++}`;
  }

  return candidate;
}

export async function GET(request: NextRequest) {
  await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

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

  const where: Prisma.CategoryWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  const items = await prisma.category.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      _count: {
        select: {
          articles: true,
        },
      },
    },
  });

  const total = await prisma.category.count({ where });

  return NextResponse.json({
    data: items.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      articleCount: item._count.articles,
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
  const session = await assertRole(["EDITOR", "ADMIN"]);
  const rateKey = `category_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = categoryCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  const baseSlug = slugify(
    parsed.data.slug && parsed.data.slug.length > 2 ? parsed.data.slug : parsed.data.name
  );
  const slug = await ensureUniqueSlug(baseSlug);

  const category = await prisma.category.create({
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
    },
  });

  await writeAuditLog({
    action: "CATEGORY_CREATE",
    entity: "Category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  revalidateTag("content");

  return NextResponse.json(
    {
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    },
    { status: 201 }
  );
}
