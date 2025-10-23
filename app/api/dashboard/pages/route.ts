import { ArticleStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils/slug";
import { pageCreateSchema } from "@/lib/validators/page";
import { writeAuditLog } from "@/lib/audit/log";

type PageListItem = Prisma.PageGetPayload<{
  include: {
    author: { select: { id: true; name: true; email: true } };
    featuredMedia: { select: { id: true; url: true } };
  };
}>;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(ArticleStatus).optional(),
});

function serialize(page: PageListItem) {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    excerpt: page.excerpt,
    content: page.content,
    status: page.status,
    publishedAt: page.publishedAt,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    author: page.author,
    featuredMediaId: page.featuredMediaId,
    featuredMedia: page.featuredMedia,
  };
}

async function ensureUniqueSlug(base: string, excludeId?: string) {
  const safeBase = base.length > 0 ? base : `halaman-${Date.now()}`;
  let candidate = safeBase;
  let counter = 1;

  while (true) {
    const exists = await prisma.page.findUnique({ where: { slug: candidate } });
    if (!exists || exists.id === excludeId) {
      return candidate;
    }
    candidate = `${safeBase}-${counter++}`;
  }
}

export async function GET(request: NextRequest) {
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const parsed = listQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Parameter tidak valid" },
      { status: 400 }
    );
  }

  const { page, perPage, search, status } = parsed.data;

  const where: Prisma.PageWhereInput = {};

  if (session.user.role === "AUTHOR") {
    where.authorId = session.user.id;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { excerpt: { contains: search, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const [pages, total] = await Promise.all([
    prisma.page.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
        featuredMedia: { select: { id: true, url: true } },
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.page.count({ where }),
  ]);

  return NextResponse.json({
    data: pages.map(serialize),
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

  const payload = await request.json().catch(() => null);
  const parsed = pageCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  if (parsed.data.featuredMediaId) {
    const exists = await prisma.media.findUnique({ where: { id: parsed.data.featuredMediaId } });
    if (!exists) {
      return NextResponse.json({ error: "Media unggulan tidak ditemukan" }, { status: 400 });
    }
  }

  const targetStatus = parsed.data.status ?? ArticleStatus.DRAFT;
  const baseSlug = slugify(parsed.data.slug ?? parsed.data.title);
  const slug = await ensureUniqueSlug(baseSlug);
  const publishedAt =
    targetStatus === ArticleStatus.PUBLISHED
      ? parsed.data.publishedAt ?? new Date()
      : parsed.data.publishedAt ?? null;

  const page = await prisma.page.create({
    data: {
      title: parsed.data.title,
      slug,
      excerpt: parsed.data.excerpt,
      content: parsed.data.content as Prisma.InputJsonValue,
      status: targetStatus,
      publishedAt,
      authorId: session.user.id,
      featuredMediaId: parsed.data.featuredMediaId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      featuredMedia: { select: { id: true, url: true } },
    },
  });

  await writeAuditLog({
    action: "PAGE_CREATE",
    entity: "Page",
    entityId: page.id,
    metadata: { title: page.title, featuredMediaId: page.featuredMediaId ?? null },
  });

  revalidateTag("content");
  return NextResponse.json({ data: serialize(page) }, { status: 201 });
}
