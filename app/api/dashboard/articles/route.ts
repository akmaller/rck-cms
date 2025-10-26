import { ArticleStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { isRateLimited } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils/slug";
import { articleCreateSchema } from "@/lib/validators/article";
import { validateArticleRelations } from "@/lib/articles/validate-relations";

const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 20;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(ArticleStatus).optional(),
  search: z.string().optional(),
  authorId: z.string().cuid().optional(),
});

function normaliseSlug({ title, slug }: { title: string; slug?: string | null }) {
  const base = slugify(slug && slug.length > 2 ? slug : title);
  return base.length > 0 ? base : slugify(`${title}-${Date.now()}`);
}

async function ensureUniqueSlug(baseSlug: string) {
  let candidate = baseSlug;
  let counter = 1;

  while (await prisma.article.findUnique({ where: { slug: candidate } })) {
    candidate = `${baseSlug}-${counter++}`;
  }

  return candidate;
}


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

  const { page, perPage, status, search, authorId } = parsedQuery.data;
  const where: Prisma.ArticleWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { excerpt: { contains: search, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  if (session.user.role === "AUTHOR") {
    where.authorId = session.user.id;
  } else if (authorId) {
    where.authorId = authorId;
  }

  const [items, total] = await prisma.$transaction([
    prisma.article.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip: (page - 1) * perPage,
      include: {
        author: { select: { id: true, name: true, email: true } },
        categories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({
    data: items.map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt,
      status: item.status,
      featured: item.featured,
      featuredMediaId: item.featuredMediaId,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      author: item.author,
      categories: item.categories.map((link) => link.category),
      tags: item.tags.map((link) => link.tag),
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
  const rateKey = `article_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsedBody = articleCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  try {
    await validateArticleRelations(parsedBody.data);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Relasi tidak valid" }, { status: 400 });
  }

  const targetStatus = parsedBody.data.status ?? ArticleStatus.DRAFT;
  const baseSlug = normaliseSlug({ title: parsedBody.data.title, slug: parsedBody.data.slug });
  const uniqueSlug = await ensureUniqueSlug(baseSlug);
  const publishedAt =
    targetStatus === ArticleStatus.PUBLISHED
      ? parsedBody.data.publishedAt ?? new Date()
      : parsedBody.data.publishedAt ?? null;

  const article = await prisma.article.create({
    data: {
      title: parsedBody.data.title,
      slug: uniqueSlug,
      excerpt: parsedBody.data.excerpt,
      content: parsedBody.data.content as Prisma.InputJsonValue,
      status: targetStatus,
      featured: parsedBody.data.featured ?? false,
      featuredMediaId: parsedBody.data.featuredMediaId ?? null,
      publishedAt,
      authorId: session.user.id,
      categories: {
        create: parsedBody.data.categoryIds.map((categoryId) => ({
          category: { connect: { id: categoryId } },
        })),
      },
      tags: {
        create: parsedBody.data.tagIds.map((tagId) => ({
          tag: { connect: { id: tagId } },
        })),
      },
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      categories: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      },
      tags: {
        include: {
          tag: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  await writeAuditLog({
    action: "ARTICLE_CREATE",
    entity: "Article",
    entityId: article.id,
    metadata: { title: article.title },
  });

  revalidateTag("content");

  return NextResponse.json(
    {
      data: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        status: article.status,
      featured: article.featured,
      featuredMediaId: article.featuredMediaId,
      publishedAt: article.publishedAt,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        author: article.author,
        categories: article.categories.map((link) => link.category),
        tags: article.tags.map((link) => link.tag),
      },
    },
    { status: 201 }
  );
}
