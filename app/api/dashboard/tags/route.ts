import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isRateLimited } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils/slug";
import { tagCreateSchema } from "@/lib/validators/tag";
import { writeAuditLog } from "@/lib/audit/log";

const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 50;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().optional(),
});

async function ensureUniqueSlug(base: string) {
  const safeBase = base.length > 0 ? base : `tag-${Date.now()}`;
  let candidate = safeBase;
  let counter = 1;

  while (await prisma.tag.findUnique({ where: { slug: candidate } })) {
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

  const where = search
    ? {
        name: { contains: search, mode: Prisma.QueryMode.insensitive },
      }
    : {};

  const items = await prisma.tag.findMany({
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

  const total = await prisma.tag.count({ where });

  return NextResponse.json({
    data: items.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
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
  const rateKey = `tag_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = tagCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  const baseSlug = slugify(
    parsed.data.slug && parsed.data.slug.length > 1 ? parsed.data.slug : parsed.data.name
  );
  const slug = await ensureUniqueSlug(baseSlug);

  const tag = await prisma.tag.create({
    data: {
      name: parsed.data.name,
      slug,
    },
  });

  await writeAuditLog({
    action: "TAG_CREATE",
    entity: "Tag",
    entityId: tag.id,
    metadata: { name: tag.name },
  });

  revalidateTag("content");

  return NextResponse.json(
    {
      data: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      },
    },
    { status: 201 }
  );
}
