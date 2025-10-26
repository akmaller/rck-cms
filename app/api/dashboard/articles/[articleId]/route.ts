import { ArticleStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { assertArticleOwnership, assertRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils/slug";
import { articleUpdateSchema } from "@/lib/validators/article";
import { writeAuditLog } from "@/lib/audit/log";
import { validateArticleRelations } from "@/lib/articles/validate-relations";


const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 20;

async function fetchArticle(articleId: string) {
  return prisma.article.findUnique({
    where: { id: articleId },
    include: {
      author: { select: { id: true, name: true, email: true } },
      categories: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
      tags: {
        include: {
          tag: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await context.params;
  const session = await assertRole(["AUTHOR", "EDITOR", "ADMIN"]);
  const article = await fetchArticle(articleId);

  if (!article) {
    return NextResponse.json({ error: "Artikel tidak ditemukan" }, { status: 404 });
  }

  if (session.user.role === "AUTHOR" && article.authorId !== session.user.id) {
    return NextResponse.json({ error: "Tidak diizinkan mengakses artikel ini" }, { status: 403 });
  }

  return NextResponse.json({
    data: {
      id: article.id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      status: article.status,
      featured: article.featured,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      author: article.author,
      categories: article.categories.map((link) => link.category),
      tags: article.tags.map((link) => link.tag),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await context.params;
  const session = await assertArticleOwnership(articleId);
  const rateKey = `article_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = articleUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload tidak valid" },
      { status: 422 }
    );
  }

  const data = parsed.data;

  const article = await fetchArticle(articleId);
  if (!article) {
    return NextResponse.json({ error: "Artikel tidak ditemukan" }, { status: 404 });
  }

  await validateArticleRelations({
    title: data.title ?? article.title,
    slug: data.slug ?? article.slug,
    excerpt: data.excerpt ?? article.excerpt ?? undefined,
    content: article.content as Record<string, unknown>,
    status: data.status ?? article.status,
    publishedAt: data.publishedAt ?? article.publishedAt ?? undefined,
    featured: data.featured ?? article.featured,
    categoryIds: data.categoryIds ?? article.categories.map((item) => item.categoryId ?? item.category.id),
    tagIds: data.tagIds ?? article.tags.map((item) => item.tagId ?? item.tag.id),
    featuredMediaId: data.featuredMediaId ?? article.featuredMediaId ?? undefined,
  });
  const updates: Prisma.ArticleUpdateInput = {};

  if (data.title) {
    updates.title = data.title;
  }

  if (typeof data.featured === "boolean") {
    updates.featured = data.featured;
  }

  if (data.excerpt !== undefined) {
    updates.excerpt = data.excerpt ?? null;
  }

  if (data.content) {
    updates.content = data.content as Prisma.InputJsonValue;
  }

  if (data.featuredMediaId !== undefined) {
    updates.featuredMedia = data.featuredMediaId
      ? { connect: { id: data.featuredMediaId } }
      : { disconnect: true };
    updates.featured = Boolean(data.featuredMediaId);
  }

  if (data.status) {
    updates.status = data.status;
    if (data.status === ArticleStatus.PUBLISHED) {
      updates.publishedAt = data.publishedAt ?? article.publishedAt ?? new Date();
    } else {
      updates.publishedAt = data.publishedAt ?? null;
    }
  } else if (data.publishedAt) {
    updates.publishedAt = data.publishedAt;
  }

  if (data.slug) {
    const baseSlug = slugify(data.slug.length > 2 ? data.slug : data.title ?? article.title);
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await prisma.article.findUnique({ where: { slug: uniqueSlug } });
      if (!existing || existing.id === article.id) {
        break;
      }
      uniqueSlug = `${baseSlug}-${counter++}`;
    }
    updates.slug = uniqueSlug;
  }

  let transactionResult;

  try {
    transactionResult = await prisma.$transaction(async (tx) => {
      if (data.categoryIds) {
        const categories = await tx.category.findMany({
          where: { id: { in: data.categoryIds } },
          select: { id: true },
        });

        if (categories.length !== data.categoryIds.length) {
          throw new Error("Beberapa kategori tidak ditemukan");
        }

        await tx.articleCategory.deleteMany({ where: { articleId: article.id } });
        if (data.categoryIds.length) {
          await tx.articleCategory.createMany({
            data: data.categoryIds.map((categoryId) => ({ articleId: article.id, categoryId })),
          });
        }
      }

      if (data.tagIds) {
        const tags = await tx.tag.findMany({
          where: { id: { in: data.tagIds } },
          select: { id: true },
        });

        if (tags.length !== data.tagIds.length) {
          throw new Error("Beberapa tag tidak ditemukan");
        }

        await tx.articleTag.deleteMany({ where: { articleId: article.id } });
        if (data.tagIds.length) {
          await tx.articleTag.createMany({
            data: data.tagIds.map((tagId) => ({ articleId: article.id, tagId })),
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        await tx.article.update({
          where: { id: article.id },
          data: updates,
        });
      }

      return tx.article.findUnique({
        where: { id: article.id },
        include: {
          author: { select: { id: true, name: true, email: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
      });
    });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal memperbarui artikel" }, { status: 400 });
  }

  if (!transactionResult) {
    return NextResponse.json({ error: "Artikel tidak ditemukan" }, { status: 404 });
  }

  await writeAuditLog({
    action: "ARTICLE_UPDATE",
    entity: "Article",
    entityId: transactionResult.id,
    metadata: { title: transactionResult.title, featuredMediaId: transactionResult.featuredMediaId },
  });

  return NextResponse.json({
    data: {
      id: transactionResult.id,
      title: transactionResult.title,
      slug: transactionResult.slug,
      excerpt: transactionResult.excerpt,
      content: transactionResult.content,
      status: transactionResult.status,
      featured: transactionResult.featured,
      publishedAt: transactionResult.publishedAt,
      createdAt: transactionResult.createdAt,
      updatedAt: transactionResult.updatedAt,
      author: transactionResult.author,
      categories: transactionResult.categories.map((link) => link.category),
      tags: transactionResult.tags.map((link) => link.tag),
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await context.params;
  const session = await assertArticleOwnership(articleId);
  const rateKey = `article_mutation:${session.user.id}`;

  if (await isRateLimited(rateKey, MUTATION_LIMIT, MUTATION_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  try {
    await prisma.article.delete({ where: { id: articleId } });
  } catch {
    return NextResponse.json({ error: "Artikel tidak ditemukan" }, { status: 404 });
  }

  await writeAuditLog({
    action: "ARTICLE_DELETE",
    entity: "Article",
    entityId: articleId,
  });

  return NextResponse.json({ message: "Artikel dihapus" });
}
