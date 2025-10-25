import { prisma } from "@/lib/prisma";
import type { ArticleCreateInput } from "@/lib/validators/article";

export async function validateArticleRelations(input: ArticleCreateInput) {
  const [categories, tags, media] = await Promise.all([
    input.categoryIds.length
      ? prisma.category.findMany({ where: { id: { in: input.categoryIds } }, select: { id: true } })
      : [],
    input.tagIds.length
      ? prisma.tag.findMany({ where: { id: { in: input.tagIds } }, select: { id: true } })
      : [],
    input.featuredMediaId
      ? prisma.media.findUnique({ where: { id: input.featuredMediaId }, select: { id: true } })
      : null,
  ]);

  if (categories.length !== input.categoryIds.length) {
    throw new Error("Beberapa kategori tidak ditemukan");
  }

  if (tags.length !== input.tagIds.length) {
    throw new Error("Beberapa tag tidak ditemukan");
  }

  if (input.featuredMediaId && !media) {
    throw new Error("Media unggulan tidak ditemukan");
  }
}
