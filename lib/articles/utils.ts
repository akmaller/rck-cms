import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils/slug";
import { extractPlainTextFromContent } from "./plain-text";

export { extractPlainTextFromContent as extractPlainText };

export function generateExcerptFromContent(content: Record<string, unknown>): string | null {
  const plainText = extractPlainTextFromContent(content).replace(/\s+/g, " ").trim();
  if (!plainText) {
    return null;
  }

  const sentences = plainText.split(/(?<=[.!?])\s+/).filter(Boolean);
  let excerpt = sentences.length > 0 ? sentences.slice(0, 20).join(" ") : plainText;

  if (!excerpt) {
    return null;
  }

  if (excerpt.length > 500) {
    excerpt = `${excerpt.slice(0, 497).trimEnd()}...`;
  }

  return excerpt;
}

export async function ensureUniqueArticleSlug(source: string | undefined, ignoreId?: string) {
  const base = slugify(source ?? "");
  const safeBase = base.length > 0 ? base : `artikel-${Date.now()}`;
  let candidate = safeBase;
  let counter = 1;

  while (true) {
    const existing = await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) {
      return candidate;
    }
    candidate = `${safeBase}-${counter++}`;
  }
}
